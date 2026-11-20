-- Gênesis: Arena online (salas privadas). Rode no Supabase > SQL Editor.
-- Pode rodar de novo sem problema. Não mexe em contas nem em saves.
--
-- Como funciona:
--  * uma sala tem um código de 6 letras; quem cria ocupa o lugar 0, quem entra o lugar 1;
--  * quando a sala enche, a partida começa em 4 s; as perguntas saem da "semente" (seed),
--    então os dois celulares mostram as mesmas perguntas na mesma ordem;
--  * o relógio é do SERVIDOR: cada pergunta tem uma janela (q_ms). Resposta fora da janela
--    não vale, e cada jogador só pontua UMA vez por pergunta (chave primária);
--  * quem fica 20 s sem dar sinal (ou sai) abandona: o outro vence;
--  * cada jogador é um "token" aleatório do aparelho (o banco guarda só o SHA-256).
-- Modos: '1x1' (2 jogadores) e '2x2' (4 jogadores; lugares 0 e 2 = dupla 0, lugares 1 e 3 = dupla 1).

create table if not exists public.genesis_rooms (
  id          bigserial primary key,
  code        text not null unique,
  seed        int  not null,
  mode        text not null default '1x1',
  max_players int  not null default 2,
  questions   int  not null default 10,
  q_ms        int  not null default 13000,  -- 10 s para responder + 3 s mostrando o resultado
  answer_ms   int  not null default 10000,
  status      text not null default 'waiting', -- waiting | playing | finished
  starts_at   timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.genesis_room_players (
  room_id    bigint not null references public.genesis_rooms(id) on delete cascade,
  seat       int  not null,
  team       int  not null,
  token_hash text not null,
  nick       text not null,
  avatar     text,
  score      int  not null default 0,
  correct    int  not null default 0,
  last_seen  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (room_id, seat),
  unique (room_id, token_hash)
);

create table if not exists public.genesis_room_answers (
  room_id bigint not null references public.genesis_rooms(id) on delete cascade,
  seat    int not null,
  q       int not null,
  ok      boolean not null,
  points  int not null,
  at      timestamptz not null default now(),
  primary key (room_id, seat, q)
);

alter table public.genesis_rooms enable row level security;
alter table public.genesis_room_players enable row level security;
alter table public.genesis_room_answers enable row level security;
revoke all on table public.genesis_rooms, public.genesis_room_players, public.genesis_room_answers from anon, authenticated;

create or replace function public.genesis_room_tok(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to('genesis-sala|' || coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- estado da sala visto por um jogador (e faz a "faxina": abandono e fim de partida)
create or replace function public.genesis_room_state(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_rooms;
  v_me int;
  v_teams int;
begin
  select * into r from public.genesis_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  select seat into v_me from public.genesis_room_players where room_id = r.id and token_hash = public.genesis_room_tok(p_token);
  if v_me is null then raise exception 'voce nao esta nesta sala'; end if;

  update public.genesis_room_players set last_seen = now() where room_id = r.id and seat = v_me and left_at is null;

  if r.status = 'playing' then
    -- quem sumiu há mais de 20 s abandonou
    update public.genesis_room_players set left_at = now()
     where room_id = r.id and left_at is null and last_seen < now() - interval '20 seconds';
    select count(distinct team) into v_teams from public.genesis_room_players where room_id = r.id and left_at is null;
    if v_teams < 2 or now() >= r.starts_at + make_interval(secs => r.questions * r.q_ms / 1000.0) then
      update public.genesis_rooms set status = 'finished', finished_at = now() where id = r.id returning * into r;
    end if;
  elsif r.status = 'waiting' and r.created_at < now() - interval '30 minutes' then
    update public.genesis_rooms set status = 'finished', finished_at = now() where id = r.id returning * into r;
  end if;

  return jsonb_build_object(
    'code', r.code, 'seed', r.seed, 'mode', r.mode, 'status', r.status,
    'max', r.max_players, 'questions', r.questions, 'q_ms', r.q_ms, 'answer_ms', r.answer_ms,
    'starts_at', r.starts_at, 'now', now(), 'me', v_me,
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'seat', p.seat, 'team', p.team, 'nick', p.nick, 'avatar', p.avatar,
        'score', p.score, 'correct', p.correct, 'left', p.left_at is not null,
        'answers', (select coalesce(jsonb_object_agg(a.q::text, a.ok), '{}'::jsonb)
                      from public.genesis_room_answers a where a.room_id = r.id and a.seat = p.seat)
      ) order by p.seat), '[]'::jsonb) from public.genesis_room_players p where p.room_id = r.id)
  );
end $$;

create or replace function public.genesis_room_create(p_token text, p_nick text, p_avatar text default null, p_mode text default '1x1')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id bigint;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'token invalido'; end if;
  if p_mode not in ('1x1', '2x2') then raise exception 'modo indisponivel'; end if;
  delete from public.genesis_rooms where created_at < now() - interval '2 days';
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.genesis_rooms where code = v_code);
  end loop;
  insert into public.genesis_rooms (code, seed, mode, max_players)
       values (v_code, 1 + floor(random() * 999999)::int, p_mode, case when p_mode = '2x2' then 4 else 2 end) returning id into v_id;
  insert into public.genesis_room_players (room_id, seat, team, token_hash, nick, avatar)
       values (v_id, 0, 0, public.genesis_room_tok(p_token), left(coalesce(nullif(btrim(p_nick), ''), 'jogador'), 16), left(p_avatar, 40));
  return public.genesis_room_state(v_code, p_token);
end $$;

create or replace function public.genesis_room_join(p_code text, p_token text, p_nick text, p_avatar text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_rooms;
  v_n int;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'token invalido'; end if;
  select * into r from public.genesis_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  -- quem já está na sala só volta (caiu a internet, recarregou a página)
  if exists (select 1 from public.genesis_room_players where room_id = r.id and token_hash = public.genesis_room_tok(p_token)) then
    update public.genesis_room_players set left_at = null, last_seen = now()
     where room_id = r.id and token_hash = public.genesis_room_tok(p_token) and r.status <> 'finished';
    return public.genesis_room_state(r.code, p_token);
  end if;
  if r.status <> 'waiting' then raise exception 'sala ja comecou'; end if;
  -- primeiro lugar livre (alguém pode ter saído antes de começar)
  select min(s) into v_n from generate_series(0, r.max_players - 1) s
   where not exists (select 1 from public.genesis_room_players where room_id = r.id and seat = s);
  if v_n is null then raise exception 'sala cheia'; end if;
  insert into public.genesis_room_players (room_id, seat, team, token_hash, nick, avatar)
       values (r.id, v_n, v_n % 2, public.genesis_room_tok(p_token), left(coalesce(nullif(btrim(p_nick), ''), 'jogador'), 16), left(p_avatar, 40));
  if (select count(*) from public.genesis_room_players where room_id = r.id) >= r.max_players then
    update public.genesis_rooms set status = 'playing', starts_at = now() + interval '4 seconds' where id = r.id;
  end if;
  return public.genesis_room_state(r.code, p_token);
end $$;

-- uma resposta por pergunta; pontos pelo relógio do servidor
create or replace function public.genesis_room_answer(p_code text, p_token text, p_q int, p_ok boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_rooms;
  v_me int;
  v_ms double precision;
  v_pts int;
  v_rows int;
begin
  select * into r from public.genesis_rooms where code = upper(btrim(p_code));
  if r.id is null then raise exception 'sala nao existe'; end if;
  select seat into v_me from public.genesis_room_players
   where room_id = r.id and token_hash = public.genesis_room_tok(p_token) and left_at is null;
  if v_me is null then raise exception 'voce nao esta nesta sala'; end if;
  if r.status = 'playing' and p_q between 0 and r.questions - 1 then
    v_ms := extract(epoch from (now() - r.starts_at)) * 1000 - p_q * r.q_ms;
    if v_ms >= -500 and v_ms <= r.answer_ms + 1500 then  -- 1,5 s de tolerância para a internet
      v_pts := case when p_ok then 10 + greatest(0, floor((r.answer_ms - greatest(v_ms, 0)) / 1000))::int else 0 end;
      insert into public.genesis_room_answers (room_id, seat, q, ok, points)
           values (r.id, v_me, p_q, p_ok, v_pts) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 1 then
        update public.genesis_room_players set score = score + v_pts, correct = correct + (case when p_ok then 1 else 0 end)
         where room_id = r.id and seat = v_me;
      end if;
    end if;
  end if;
  return public.genesis_room_state(r.code, p_token);
end $$;

create or replace function public.genesis_room_leave(p_code text, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_rooms;
begin
  select * into r from public.genesis_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then return; end if;
  if r.status = 'waiting' then
    -- antes de começar: quem criou fecha a sala; os outros só liberam o lugar
    if exists (select 1 from public.genesis_room_players where room_id = r.id and seat = 0 and token_hash = public.genesis_room_tok(p_token)) then
      update public.genesis_rooms set status = 'finished', finished_at = now() where id = r.id;
    else
      delete from public.genesis_room_players where room_id = r.id and token_hash = public.genesis_room_tok(p_token);
      return;
    end if;
  end if;
  update public.genesis_room_players set left_at = now()
   where room_id = r.id and token_hash = public.genesis_room_tok(p_token) and left_at is null;
end $$;

revoke all on function public.genesis_room_tok(text) from public, anon, authenticated;
revoke all on function public.genesis_room_state(text, text) from public;
revoke all on function public.genesis_room_create(text, text, text, text) from public;
revoke all on function public.genesis_room_join(text, text, text, text) from public;
revoke all on function public.genesis_room_answer(text, text, int, boolean) from public;
revoke all on function public.genesis_room_leave(text, text) from public;
grant execute on function public.genesis_room_state(text, text) to anon, authenticated;
grant execute on function public.genesis_room_create(text, text, text, text) to anon, authenticated;
grant execute on function public.genesis_room_join(text, text, text, text) to anon, authenticated;
grant execute on function public.genesis_room_answer(text, text, int, boolean) to anon, authenticated;
grant execute on function public.genesis_room_leave(text, text) to anon, authenticated;
