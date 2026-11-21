-- Gênesis · Fuga: salas abertas (lista pública), sala pública/privada, remover jogador,
-- trocar personagem na sala de espera. Rode no Supabase > SQL Editor DEPOIS do fuga.sql.
-- Só ACRESCENTA (uma tabela nova e funções). Não apaga nada, não mexe em contas, saves,
-- rankings nem na Arena. Pode rodar de novo sem problema.

-- quem o anfitrião removeu não volta para aquela sala
create table if not exists public.genesis_fuga_kicked (
  room_id    bigint not null references public.genesis_fuga_rooms(id) on delete cascade,
  token_hash text not null,
  primary key (room_id, token_hash)
);
alter table public.genesis_fuga_kicked enable row level security;

-- anfitrião = menor lugar presente (o mesmo critério de genesis_fuga_start)
create or replace function public.genesis_fuga_is_host(p_room bigint, p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.token_hash = public.genesis_fuga_tok(p_token)
                     from public.genesis_fuga_players p
                    where p.room_id = p_room and p.left_at is null
                    order by p.seat limit 1), false)
$$;

-- salas públicas esperando jogadores (anfitrião ativo, com vaga), para todos verem
create or replace function public.genesis_fuga_list()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'code', r.code, 'difficulty', r.difficulty, 'max', r.max_players, 'at', r.created_at,
      'players', (select count(*) from public.genesis_fuga_players p where p.room_id = r.id and p.left_at is null),
      'host', (select p.nick from public.genesis_fuga_players p where p.room_id = r.id and p.left_at is null order by p.seat limit 1),
      'avatars', (select jsonb_agg(p.avatar order by p.seat) from public.genesis_fuga_players p where p.room_id = r.id and p.left_at is null)) as x
      from public.genesis_fuga_rooms r
     where r.public and r.status = 'waiting' and r.created_at > now() - interval '20 minutes'
       and (select count(*) from public.genesis_fuga_players p where p.room_id = r.id and p.left_at is null) < r.max_players
       and exists (select 1 from public.genesis_fuga_players p where p.room_id = r.id and p.left_at is null and p.last_seen > now() - interval '20 seconds')
     order by r.created_at desc limit 30) s
$$;

-- anfitrião deixa a sala pública ou privada (só antes de começar)
create or replace function public.genesis_fuga_set_public(p_code text, p_token text, p_public boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.genesis_fuga_rooms;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  if not public.genesis_fuga_is_host(r.id, p_token) then raise exception 'so o anfitriao'; end if;
  if r.status <> 'waiting' then raise exception 'sala ja comecou'; end if;
  update public.genesis_fuga_rooms set public = coalesce(p_public, false) where id = r.id;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- anfitrião remove um jogador (só antes de começar); ele não consegue voltar a essa sala
create or replace function public.genesis_fuga_kick(p_code text, p_token text, p_seat int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.genesis_fuga_rooms; v_hash text;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  if not public.genesis_fuga_is_host(r.id, p_token) then raise exception 'so o anfitriao'; end if;
  if r.status <> 'waiting' then raise exception 'sala ja comecou'; end if;
  select token_hash into v_hash from public.genesis_fuga_players where room_id = r.id and seat = p_seat;
  if v_hash is null or v_hash = public.genesis_fuga_tok(p_token) then return public.genesis_fuga_state(r.code, p_token); end if;
  insert into public.genesis_fuga_kicked (room_id, token_hash) values (r.id, v_hash) on conflict do nothing;
  delete from public.genesis_fuga_players where room_id = r.id and seat = p_seat;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- trocar de personagem na sala de espera
create or replace function public.genesis_fuga_avatar(p_code text, p_token text, p_avatar text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.genesis_fuga_rooms;
begin
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code));
  if r.id is null then raise exception 'sala nao existe'; end if;
  if r.status = 'waiting' then
    update public.genesis_fuga_players set avatar = left(p_avatar, 40)
     where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token);
  end if;
  return public.genesis_fuga_state(r.code, p_token);
end $$;

-- entrar numa sala: igual ao fuga.sql, mais o bloqueio de quem foi removido
create or replace function public.genesis_fuga_join(p_code text, p_token text, p_nick text, p_avatar text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.genesis_fuga_rooms;
  v_n int;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'token invalido'; end if;
  select * into r from public.genesis_fuga_rooms where code = upper(btrim(p_code)) for update;
  if r.id is null then raise exception 'sala nao existe'; end if;
  if exists (select 1 from public.genesis_fuga_kicked where room_id = r.id and token_hash = public.genesis_fuga_tok(p_token)) then
    raise exception 'removido da sala';
  end if;
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

-- partida rápida: igual ao fuga.sql, mas pula salas de onde você foi removido
create or replace function public.genesis_fuga_quick(p_token text, p_nick text, p_avatar text default null, p_difficulty int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  select r.code into v_code from public.genesis_fuga_rooms r
   where r.public and r.status = 'waiting' and r.difficulty = coalesce(p_difficulty, 1) and r.created_at > now() - interval '10 minutes'
     and (select count(*) from public.genesis_fuga_players p where p.room_id = r.id) < r.max_players
     and exists (select 1 from public.genesis_fuga_players p where p.room_id = r.id and p.seat = 0 and p.last_seen > now() - interval '20 seconds')
     and not exists (select 1 from public.genesis_fuga_kicked k where k.room_id = r.id and k.token_hash = public.genesis_fuga_tok(p_token))
   order by r.created_at limit 1;
  if v_code is null then return public.genesis_fuga_create(p_token, p_nick, p_avatar, true, p_difficulty); end if;
  return public.genesis_fuga_join(v_code, p_token, p_nick, p_avatar);
end $$;

revoke all on function public.genesis_fuga_is_host(bigint, text) from public, anon, authenticated;
revoke all on function public.genesis_fuga_list() from public;
revoke all on function public.genesis_fuga_set_public(text, text, boolean) from public;
revoke all on function public.genesis_fuga_kick(text, text, int) from public;
revoke all on function public.genesis_fuga_avatar(text, text, text) from public;
revoke all on function public.genesis_fuga_join(text, text, text, text) from public;
grant execute on function public.genesis_fuga_list() to anon, authenticated;
grant execute on function public.genesis_fuga_set_public(text, text, boolean) to anon, authenticated;
grant execute on function public.genesis_fuga_kick(text, text, int) to anon, authenticated;
grant execute on function public.genesis_fuga_avatar(text, text, text) to anon, authenticated;
grant execute on function public.genesis_fuga_join(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
