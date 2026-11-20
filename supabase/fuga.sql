-- Gênesis: Fuga da Tentação (cooperativo, 1 a 5 jogadores). Rode no Supabase > SQL Editor.
-- Pode rodar de novo sem problema. Não mexe em contas, saves nem na Arena.
--
-- O SERVIDOR decide o que vale: entrada na sala, início, tarefas concluídas (uma vez cada,
-- só por jogador vivo), captura (pergunta, prazo e resposta conferidos aqui), eliminação,
-- fuga e resultado. O movimento vai pelo Supabase Realtime (canal "fuga-CODIGO"),
-- que só desenha os personagens: nada decisivo passa por ele.
-- Cada aparelho é um "token" aleatório (o banco guarda só o SHA-256), como na Arena.

create table if not exists public.genesis_fuga_rooms (
  id          bigserial primary key,
  code        text not null unique,
  seed        int  not null,
  public      boolean not null default false,
  difficulty  int  not null default 1,      -- 0 fácil, 1 médio, 2 difícil
  max_players int  not null default 5,
  tasks_total int  not null default 0,
  limit_s     int  not null default 600,
  status      text not null default 'waiting', -- waiting | playing | won | lost
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.genesis_fuga_players (
  room_id         bigint not null references public.genesis_fuga_rooms(id) on delete cascade,
  seat            int  not null,
  token_hash      text not null,
  nick            text not null,
  avatar          text,
  alive           boolean not null default true,
  escaped         boolean not null default false,
  tasks           int  not null default 0,
  protected_until timestamptz,
  chal_q          int,
  chal_rot        int,
  chal_until      timestamptz,
  last_task_at    timestamptz,
  last_seen       timestamptz not null default now(),
  left_at         timestamptz,
  primary key (room_id, seat),
  unique (room_id, token_hash)
);

create table if not exists public.genesis_fuga_done (
  room_id bigint not null references public.genesis_fuga_rooms(id) on delete cascade,
  task    int not null,
  seat    int not null,
  at      timestamptz not null default now(),
  primary key (room_id, task)
);

create table if not exists public.genesis_fuga_q (
  id      int primary key,
  q       text not null,
  options text[] not null,
  answer  int not null,
  verse   text
);

alter table public.genesis_fuga_rooms enable row level security;
alter table public.genesis_fuga_players enable row level security;
alter table public.genesis_fuga_done enable row level security;
alter table public.genesis_fuga_q enable row level security;
revoke all on table public.genesis_fuga_rooms, public.genesis_fuga_players, public.genesis_fuga_done, public.genesis_fuga_q from anon, authenticated;

-- perguntas da captura (geradas de content/fuga.json por tools/build_fuga_sql.py)
-- @QUESTIONS-BEGIN@
delete from public.genesis_fuga_q;
insert into public.genesis_fuga_q (id, q, options, answer, verse) values
  (0, 'A serpente diz: "Deus não disse isso de verdade..." O que Eva devia lembrar?', array['A palavra exata que Deus falou', 'Que a serpente era esperta', 'Que ninguém estava olhando'], 0, 'Gênesis 3:1-3'),
  (1, '"É só um pouquinho, ninguém vai saber." Qual princípio vence essa tentação?', array['Deus vê tudo e eu quero agradá-lo', 'Se ninguém vê, pode', 'Fazer escondido é mais seguro'], 0, 'Provérbios 15:3'),
  (2, 'Jesus foi tentado a transformar pedras em pão. O que ele respondeu?', array['Nem só de pão viverá o homem', 'Estou com muita fome', 'Farei só desta vez'], 0, 'Mateus 4:4'),
  (3, 'Quando a tentação aparece, o que Deus sempre oferece?', array['Uma saída para suportarmos', 'Nada, é preciso ceder', 'Um castigo imediato'], 0, '1 Coríntios 10:13'),
  (4, 'José fugiu da mulher de Potifar. O que isso ensina?', array['Às vezes vencer é fugir do pecado', 'Fugir é covardia', 'Melhor conversar com a tentação'], 0, 'Gênesis 39:12'),
  (5, '"Você será como Deus!" Essa promessa da serpente era:', array['Uma mentira que levou ao orgulho', 'Uma verdade escondida', 'Um presente de Deus'], 0, 'Gênesis 3:5'),
  (6, 'Qual é a arma do cristão contra as mentiras do inimigo?', array['A espada do Espírito, a Palavra de Deus', 'A força dos braços', 'Gritar mais alto'], 0, 'Efésios 6:17'),
  (7, '"Resista ao diabo, e ele..."', array['fugirá de vocês', 'ficará mais forte', 'voltará amanhã'], 0, 'Tiago 4:7'),
  (8, 'Seus amigos zombam de quem ora. O que Daniel faria?', array['Continuaria orando fielmente', 'Pararia de orar', 'Oraria só escondido de Deus'], 0, 'Daniel 6:10'),
  (9, 'Você ficou com raiva e quer se vingar. O que a Bíblia ensina?', array['Vencer o mal com o bem', 'Pagar na mesma moeda', 'Guardar rancor para sempre'], 0, 'Romanos 12:21'),
  (10, 'Mentir para escapar de uma bronca é:', array['Pecado; a verdade liberta', 'Permitido se for pequeno', 'Esperteza'], 0, 'Efésios 4:25'),
  (11, 'Acã escondeu o que pegou de Jericó. Qual foi o erro dele?', array['Cobiçar e desobedecer escondido', 'Ser muito generoso', 'Ajudar o povo'], 0, 'Josué 7:21'),
  (12, 'Qual fruto do Espírito ajuda a dizer "não" à tentação?', array['Domínio próprio', 'Pressa', 'Orgulho'], 0, 'Gálatas 5:22-23'),
  (13, 'Jesus no deserto respondeu toda tentação com:', array['"Está escrito..."', 'Uma discussão longa', 'Silêncio e medo'], 0, 'Mateus 4:4-10'),
  (14, '"Todos estão fazendo, faça também." O que os jovens hebreus na Babilônia fizeram?', array['Não se curvaram à estátua', 'Curvaram-se para não ter problemas', 'Fugiram da cidade'], 0, 'Daniel 3:18'),
  (15, 'Ter inveja do que o outro tem quebra qual mandamento?', array['Não cobiçarás', 'Honra teu pai e tua mãe', 'Lembra-te do sábado'], 0, 'Êxodo 20:17'),
  (16, 'Quem confessa seus pecados a Deus recebe:', array['Perdão e purificação', 'Mais culpa', 'Nada'], 0, '1 João 1:9'),
  (17, 'Pedro negou Jesus por medo. Qual foi a atitude certa depois?', array['Arrepender-se e voltar para Jesus', 'Esconder-se para sempre', 'Fingir que nada aconteceu'], 0, 'Lucas 22:62'),
  (18, 'Davi enfrentou Golias confiando em quê?', array['No nome do Senhor', 'Na própria armadura', 'No tamanho do exército'], 0, '1 Samuel 17:45'),
  (19, 'Onde devo guardar a Palavra para não pecar?', array['No coração', 'Só na estante', 'No celular, sem ler'], 0, 'Salmo 119:11'),
  (20, 'O escudo da fé serve para:', array['Apagar as setas inflamadas do maligno', 'Atacar os amigos', 'Enfeitar a armadura'], 0, 'Efésios 6:16'),
  (21, '"Vigiem e orem para não caírem em..."', array['tentação', 'sono profundo', 'tristeza'], 0, 'Mateus 26:41'),
  (22, 'Más companhias corrompem:', array['os bons costumes', 'só os adultos', 'ninguém'], 0, '1 Coríntios 15:33'),
  (23, 'Esaú trocou o direito de primogenitura por:', array['Um prato de comida', 'Uma espada', 'Um camelo'], 0, 'Gênesis 25:33');
-- @QUESTIONS-END@

create or replace function public.genesis_fuga_tok(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to('genesis-fuga|' || coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- estado visto por um jogador; faz a "faxina": prazo de captura vencido, quem sumiu, fim da rodada
create or replace function public.genesis_fuga_state(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  me public.genesis_fuga_players;
  v_done int;
  v_alive int;
  v_out int;
  v_chal jsonb := null;
  q public.genesis_fuga_q;
  n int;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  select * into me from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token);
  if me.seat is null then raise exception 'voce nao esta nesta sala'; end if;
  update public.genesis_fuga_players set last_seen = now() where room_id = r.id and seat = me.seat and left_at is null;

  if r.status = 'playing' then
    -- resposta não veio no prazo (+2 s de internet): eliminado
    update public.genesis_fuga_players set alive = false, chal_q = null, chal_until = null
     where room_id = r.id and chal_q is not null and chal_until < now() - interval '2 seconds';
    -- 25 s sem sinal = saiu (pode voltar entrando de novo)
    update public.genesis_fuga_players set left_at = now()
     where room_id = r.id and left_at is null and last_seen < now() - interval '25 seconds';
    select count(*) into v_done from public.genesis_fuga_done where room_id = r.id;
    select count(*) filter (where alive and not escaped and left_at is null),
           count(*) filter (where escaped)
      into v_alive, v_out from public.genesis_fuga_players where room_id = r.id;
    if v_done >= r.tasks_total and v_alive = 0 and v_out > 0 then
      update public.genesis_fuga_rooms set status = 'won', finished_at = now() where id = r.id returning * into r;
    elsif v_alive = 0 and v_out = 0 and now() > r.started_at then
      update public.genesis_fuga_rooms set status = 'lost', finished_at = now() where id = r.id returning * into r;
    elsif now() > r.started_at + make_interval(secs => r.limit_s) then
      update public.genesis_fuga_rooms set status = case when v_out > 0 and v_done >= r.tasks_total then 'won' else 'lost' end,
             finished_at = now() where id = r.id returning * into r;
    end if;
    select * into me from public.genesis_fuga_players where room_id = r.id and seat = me.seat;
  end if;

  if me.chal_q is not null then
    select * into q from public.genesis_fuga_q where id = me.chal_q;
    n := array_length(q.options, 1);
    v_chal := jsonb_build_object('q', q.q, 'verse', q.verse,
      'options', (select jsonb_agg(q.options[1 + ((k + me.chal_rot) % n)] order by k) from generate_series(0, n - 1) k),
      'ms', greatest(0, floor(extract(epoch from (me.chal_until - now())) * 1000)));
  end if;

  return jsonb_build_object(
    'code', r.code, 'seed', r.seed, 'public', r.public, 'difficulty', r.difficulty, 'status', r.status,
    'tasksTotal', r.tasks_total, 'limit', r.limit_s, 'me', me.seat,
    'startsIn', case when r.started_at is null then null else floor(extract(epoch from (r.started_at - now())) * 1000) end,
    'done', coalesce((select jsonb_agg(task order by task) from public.genesis_fuga_done where room_id = r.id), '[]'::jsonb),
    'challenge', v_chal,
    'players', (select jsonb_agg(jsonb_build_object('seat', p.seat, 'nick', p.nick, 'avatar', p.avatar, 'alive', p.alive,
        'escaped', p.escaped, 'tasks', p.tasks, 'left', p.left_at is not null, 'caught', p.chal_q is not null,
        'protected', coalesce(p.protected_until > now(), false)) order by p.seat)
      from public.genesis_fuga_players p where p.room_id = r.id));
end $$;

create or replace function public.genesis_fuga_create(p_token text, p_nick text, p_avatar text default null, p_public boolean default false, p_difficulty int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id bigint;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'token invalido'; end if;
  delete from public.genesis_fuga_rooms where created_at < now() - interval '1 day';
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.genesis_fuga_rooms where code = v_code);
  end loop;
  insert into public.genesis_fuga_rooms (code, seed, public, difficulty)
       values (v_code, 1 + floor(random() * 999999)::int, coalesce(p_public, false), least(2, greatest(0, coalesce(p_difficulty, 1))))
    returning id into v_id;
  insert into public.genesis_fuga_players (room_id, seat, token_hash, nick, avatar)
       values (v_id, 0, public.genesis_fuga_tok(p_token), left(coalesce(nullif(btrim(p_nick), ''), 'jogador'), 16), left(p_avatar, 40));
  return public.genesis_fuga_state(v_code, p_token);
end $$;

create or replace function public.genesis_fuga_join(p_code text, p_token text, p_nick text, p_avatar text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  v_n int;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'token invalido'; end if;
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  -- quem já está na sala volta (caiu a internet, recarregou)
  if exists (select 1 from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token)) then
    update public.genesis_fuga_players set left_at = null, last_seen = now()
     where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token) and r.status in ('waiting', 'playing');
    return public.genesis_fuga_state(r.code, p_token);
  end if;
  if r.status <> 'waiting' then raise exception 'sala ja comecou'; end if;
  select min(s) into v_n from generate_series(0, r.max_players - 1) s
   where not exists (select 1 from public.genesis_fuga_players where room_id = r.id and seat = s);
  if v_n is null then raise exception 'sala cheia'; end if;
  insert into public.genesis_fuga_players (room_id, seat, token_hash, nick, avatar)
       values (r.id, v_n, public.genesis_fuga_tok(p_token), left(coalesce(nullif(btrim(p_nick), ''), 'jogador'), 16), left(p_avatar, 40));
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- sala pública: entra numa que está esperando (criada há pouco, com vaga) ou cria uma
create or replace function public.genesis_fuga_quick(p_token text, p_nick text, p_avatar text default null, p_difficulty int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  select r.code into v_code from public.genesis_fuga_rooms r
   where r.public and r.status = 'waiting' and r.difficulty = coalesce(p_difficulty, 1) and r.created_at > now() - interval '10 minutes'
     and (select count(*) from public.genesis_fuga_players p where p.room_id = r.id) < r.max_players
     and exists (select 1 from public.genesis_fuga_players p where p.room_id = r.id and p.seat = 0 and p.last_seen > now() - interval '20 seconds')
   order by r.created_at limit 1;
  if v_code is null then return public.genesis_fuga_create(p_token, p_nick, p_avatar, true, p_difficulty); end if;
  return public.genesis_fuga_join(v_code, p_token, p_nick, p_avatar);
end $$;

-- o anfitrião (menor lugar presente) começa; tarefas crescem com o número de jogadores
create or replace function public.genesis_fuga_start(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  v_me int;
  v_n int;
  v_base int;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  select seat into v_me from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token) and left_at is null;
  if v_me is null then raise exception 'voce nao esta nesta sala'; end if;
  if r.status <> 'waiting' then return public.genesis_fuga_state(r.code, p_token); end if;
  if v_me <> (select min(seat) from public.genesis_fuga_players where room_id = r.id and left_at is null) then raise exception 'so o anfitriao comeca'; end if;
  select count(*) into v_n from public.genesis_fuga_players where room_id = r.id and left_at is null;
  v_base := (array[7, 9, 11, 12, 14])[least(5, greatest(1, v_n))];   -- igual a taskCount() em src/fuga/tasks.js
  update public.genesis_fuga_rooms
     set status = 'playing', started_at = now() + interval '3 seconds',
         tasks_total = round(v_base * (array[0.85, 1, 1.15])[r.difficulty + 1])::int,
         limit_s = case when v_n <= 2 then 540 else 600 end
   where id = r.id;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- tarefa concluída: uma vez por sala, só por jogador vivo, no máximo uma a cada 3 s
create or replace function public.genesis_fuga_task(p_code text, p_token text, p_task int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  me public.genesis_fuga_players;
  v_rows int;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  select * into me from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token) and left_at is null;
  if me.seat is null then raise exception 'voce nao esta nesta sala'; end if;
  if r.status = 'playing' and now() >= r.started_at and me.alive and not me.escaped and me.chal_q is null
     and p_task between 0 and r.tasks_total - 1
     and (me.last_task_at is null or me.last_task_at < now() - interval '3 seconds') then
    insert into public.genesis_fuga_done (room_id, task, seat) values (r.id, p_task, me.seat) on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      update public.genesis_fuga_players set tasks = tasks + 1, last_task_at = now() where room_id = r.id and seat = me.seat;
    end if;
  end if;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- o inimigo alcançou alguém (avisado pelo aparelho que move os inimigos): começa o desafio com prazo
create or replace function public.genesis_fuga_caught(p_code text, p_token text, p_seat int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  v_me int;
  v_q int;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  select seat into v_me from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token);
  if v_me is null then raise exception 'voce nao esta nesta sala'; end if;
  if r.status = 'playing' and now() >= r.started_at then
    select id into v_q from public.genesis_fuga_q order by random() limit 1;
    update public.genesis_fuga_players
       set chal_q = v_q, chal_rot = floor(random() * 3)::int,
           chal_until = now() + make_interval(secs => (array[12, 9, 6])[r.difficulty + 1] + 1)
     where room_id = r.id and seat = p_seat and alive and not escaped and left_at is null and chal_q is null
       and (protected_until is null or protected_until < now());
  end if;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- resposta do capturado: acerto = escapa com 6 s de proteção; erro ou prazo = eliminado
create or replace function public.genesis_fuga_answer(p_code text, p_token text, p_choice int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  me public.genesis_fuga_players;
  q public.genesis_fuga_q;
  v_ok boolean;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  select * into me from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token);
  if me.seat is null then raise exception 'voce nao esta nesta sala'; end if;
  if me.chal_q is null then return public.genesis_fuga_state(r.code, p_token) || jsonb_build_object('ok', me.alive); end if;
  select * into q from public.genesis_fuga_q where id = me.chal_q;
  v_ok := coalesce(p_choice >= 0 and now() <= me.chal_until + interval '1.5 seconds'
      and ((p_choice + me.chal_rot) % array_length(q.options, 1)) = q.answer, false);
  update public.genesis_fuga_players
     set chal_q = null, chal_until = null, alive = v_ok,
         protected_until = case when v_ok then now() + interval '6 seconds' else protected_until end
   where room_id = r.id and seat = me.seat;
  return public.genesis_fuga_state(r.code, p_token) || jsonb_build_object('ok', v_ok, 'verse', q.verse, 'right', q.options[q.answer + 1]);
end $$;

-- chegou à saída: só vale com todas as tarefas feitas e vivo
create or replace function public.genesis_fuga_escape(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  if r.status = 'playing' and (select count(*) from public.genesis_fuga_done where room_id = r.id) >= r.tasks_total then
    update public.genesis_fuga_players set escaped = true
     where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token) and alive and chal_q is null and left_at is null;
  end if;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

create or replace function public.genesis_fuga_leave(p_code text, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then return; end if;
  if r.status = 'waiting' then
    delete from public.genesis_fuga_players where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token);
    if not exists (select 1 from public.genesis_fuga_players where room_id = r.id) then
      update public.genesis_fuga_rooms set status = 'lost', finished_at = now() where id = r.id;
    end if;
    return;
  end if;
  update public.genesis_fuga_players set left_at = now()
   where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token) and left_at is null;
end $$;

revoke all on function public.genesis_fuga_tok(text) from public, anon, authenticated;
revoke all on function public.genesis_fuga_state(text, text) from public;
revoke all on function public.genesis_fuga_create(text, text, text, boolean, int) from public;
revoke all on function public.genesis_fuga_join(text, text, text, text) from public;
revoke all on function public.genesis_fuga_quick(text, text, text, int) from public;
revoke all on function public.genesis_fuga_start(text, text) from public;
revoke all on function public.genesis_fuga_task(text, text, int) from public;
revoke all on function public.genesis_fuga_caught(text, text, int) from public;
revoke all on function public.genesis_fuga_answer(text, text, int) from public;
revoke all on function public.genesis_fuga_escape(text, text) from public;
revoke all on function public.genesis_fuga_leave(text, text) from public;
grant execute on function public.genesis_fuga_state(text, text) to anon, authenticated;
grant execute on function public.genesis_fuga_create(text, text, text, boolean, int) to anon, authenticated;
grant execute on function public.genesis_fuga_join(text, text, text, text) to anon, authenticated;
grant execute on function public.genesis_fuga_quick(text, text, text, int) to anon, authenticated;
grant execute on function public.genesis_fuga_start(text, text) to anon, authenticated;
grant execute on function public.genesis_fuga_task(text, text, int) to anon, authenticated;
grant execute on function public.genesis_fuga_caught(text, text, int) to anon, authenticated;
grant execute on function public.genesis_fuga_answer(text, text, int) to anon, authenticated;
grant execute on function public.genesis_fuga_escape(text, text) to anon, authenticated;
grant execute on function public.genesis_fuga_leave(text, text) to anon, authenticated;
