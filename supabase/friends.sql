-- Gênesis: amigos (pesquisa, pedidos, lista e convites para a Arena online).
-- Rode no Supabase > SQL Editor depois do setup.sql e do arena_online.sql.
-- Pode rodar de novo sem problema. Não muda contas nem saves.
--
-- Segurança:
--  * cada função exige o código secreto da conta (p_code); o banco só compara a impressão digital;
--  * ninguém lê as tabelas direto (RLS ligado, sem políticas, acesso revogado);
--  * para os outros, cada jogador aparece só pelo "código de amigo" (6 letras), apelido e personagem —
--    o mesmo que já aparece no ranking. Nunca sai a impressão digital nem o código da conta.

create table if not exists public.genesis_profiles (
  code_hash text primary key references public.genesis_saves(code_hash) on delete cascade,
  tag       text not null unique,
  last_seen timestamptz not null default now()
);

create table if not exists public.genesis_friends (
  from_hash  text not null references public.genesis_profiles(code_hash) on delete cascade,
  to_hash    text not null references public.genesis_profiles(code_hash) on delete cascade,
  status     text not null default 'pending', -- pending | accepted
  created_at timestamptz not null default now(),
  primary key (from_hash, to_hash),
  check (from_hash <> to_hash)
);

create table if not exists public.genesis_invites (
  from_hash  text not null references public.genesis_profiles(code_hash) on delete cascade,
  to_hash    text not null references public.genesis_profiles(code_hash) on delete cascade,
  room_code  text not null,
  created_at timestamptz not null default now(),
  primary key (from_hash, to_hash)
);

alter table public.genesis_profiles enable row level security;
alter table public.genesis_friends enable row level security;
alter table public.genesis_invites enable row level security;
revoke all on table public.genesis_profiles, public.genesis_friends, public.genesis_invites from anon, authenticated;

-- perfil de quem chamou (cria o código de amigo na primeira vez); erro se a conta não existe
create or replace function public.genesis_me(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := public.genesis_hash(p_code);
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tag text;
begin
  if not exists (select 1 from public.genesis_saves where code_hash = v_hash) then raise exception 'conta nao encontrada'; end if;
  update public.genesis_profiles set last_seen = now() where code_hash = v_hash returning tag into v_tag;
  if v_tag is null then
    loop
      v_tag := '';
      for i in 1..6 loop v_tag := v_tag || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists (select 1 from public.genesis_profiles where tag = v_tag);
    end loop;
    insert into public.genesis_profiles (code_hash, tag) values (v_hash, v_tag);
  end if;
  return v_hash;
end $$;

-- cartão público de um jogador
create or replace function public.genesis_card(p_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tag', p.tag,
    'nick', left(coalesce(s.data ->> 'nick', ''), 16),
    'avatar', left(coalesce(s.data ->> 'avatarId', 'peregrino'), 32),
    'level', public.genesis_num(s.data -> 'level'),
    'trophies', public.genesis_num(s.data -> 'trophies'),
    'online', p.last_seen > now() - interval '3 minutes')
  from public.genesis_profiles p join public.genesis_saves s on s.code_hash = p.code_hash
  where p.code_hash = p_hash
$$;

-- tudo o que a tela de amigos precisa
create or replace function public.genesis_friends_state(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
begin
  delete from public.genesis_invites where created_at < now() - interval '10 minutes';
  return jsonb_build_object(
    'me', public.genesis_card(v_me),
    'friends', coalesce((select jsonb_agg(public.genesis_card(case when f.from_hash = v_me then f.to_hash else f.from_hash end))
                 from public.genesis_friends f where f.status = 'accepted' and v_me in (f.from_hash, f.to_hash)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(public.genesis_card(f.from_hash)) from public.genesis_friends f
                 where f.status = 'pending' and f.to_hash = v_me), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(public.genesis_card(f.to_hash)) from public.genesis_friends f
                 where f.status = 'pending' and f.from_hash = v_me), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(public.genesis_card(i.from_hash) || jsonb_build_object('room', i.room_code))
                 from public.genesis_invites i where i.to_hash = v_me), '[]'::jsonb)
  );
end $$;

-- quem aparece na pesquisa sem perfil ainda ganha um ao receber pedido
create or replace function public.genesis_profile_of(p_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tag text;
begin
  if exists (select 1 from public.genesis_profiles where code_hash = p_hash) then return; end if;
  loop
    v_tag := '';
    for i in 1..6 loop v_tag := v_tag || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.genesis_profiles where tag = v_tag);
  end loop;
  insert into public.genesis_profiles (code_hash, tag, last_seen) values (p_hash, v_tag, 'epoch') on conflict do nothing;
end $$;

-- pesquisa pelo apelido (começo do nome) ou pelo código de amigo; até 20 resultados
create or replace function public.genesis_friend_search(p_code text, p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_hashes text[];
  v_h text;
begin
  v_q := replace(replace(v_q, '\', ''), '%', '');
  if length(v_q) < 3 then raise exception 'pesquisa curta'; end if;
  v_q := replace(v_q, '_', '\_'); -- "_" vale como letra, não como coringa
  select array_agg(x.code_hash) into v_hashes from (
    select s.code_hash
      from public.genesis_saves s
      left join public.genesis_profiles p on p.code_hash = s.code_hash
     where s.code_hash <> v_me
       and not s.hidden
       and coalesce(s.data ->> 'creator', '') <> 'true'
       and coalesce(s.data ->> 'nick', '') <> ''
       and (lower(s.data ->> 'nick') like v_q || '%' or p.tag = upper(v_q))
     order by public.genesis_num(s.data -> 'trophies') desc
     limit 20) x;
  if v_hashes is null then return '[]'::jsonb; end if;
  foreach v_h in array v_hashes loop perform public.genesis_profile_of(v_h); end loop;
  return (select jsonb_agg(public.genesis_card(h)) from unnest(v_hashes) as u(h));
end $$;

create or replace function public.genesis_friend_request(p_code text, p_tag text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
  v_to text;
  v_count int;
begin
  select code_hash into v_to from public.genesis_profiles where tag = upper(btrim(p_tag));
  if v_to is null then raise exception 'jogador nao encontrado'; end if;
  if v_to = v_me then raise exception 'voce mesmo'; end if;
  select count(*) into v_count from public.genesis_friends where from_hash = v_me and status = 'pending';
  if v_count >= 30 then raise exception 'pedidos demais'; end if;
  -- se o outro já tinha pedido, vira amizade
  update public.genesis_friends set status = 'accepted' where from_hash = v_to and to_hash = v_me;
  if not found then
    insert into public.genesis_friends (from_hash, to_hash) values (v_me, v_to) on conflict do nothing;
  end if;
  return public.genesis_friends_state(p_code);
end $$;

create or replace function public.genesis_friend_respond(p_code text, p_tag text, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
  v_from text;
begin
  select code_hash into v_from from public.genesis_profiles where tag = upper(btrim(p_tag));
  if p_accept then
    update public.genesis_friends set status = 'accepted' where from_hash = v_from and to_hash = v_me and status = 'pending';
  else
    delete from public.genesis_friends where from_hash = v_from and to_hash = v_me and status = 'pending';
  end if;
  return public.genesis_friends_state(p_code);
end $$;

create or replace function public.genesis_friend_remove(p_code text, p_tag text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
  v_other text;
begin
  select code_hash into v_other from public.genesis_profiles where tag = upper(btrim(p_tag));
  delete from public.genesis_friends where (from_hash = v_me and to_hash = v_other) or (from_hash = v_other and to_hash = v_me);
  delete from public.genesis_invites where (from_hash = v_me and to_hash = v_other) or (from_hash = v_other and to_hash = v_me);
  return public.genesis_friends_state(p_code);
end $$;

-- convite para uma sala da Arena online (só entre amigos; o mais novo substitui o anterior)
create or replace function public.genesis_friend_invite(p_code text, p_tag text, p_room text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
  v_to text;
begin
  select code_hash into v_to from public.genesis_profiles where tag = upper(btrim(p_tag));
  if v_to is null or not exists (select 1 from public.genesis_friends where status = 'accepted'
       and ((from_hash = v_me and to_hash = v_to) or (from_hash = v_to and to_hash = v_me))) then
    raise exception 'nao sao amigos';
  end if;
  if upper(btrim(p_room)) !~ '^[A-HJ-NP-Z2-9]{6}$' then raise exception 'sala invalida'; end if;
  insert into public.genesis_invites (from_hash, to_hash, room_code) values (v_me, v_to, upper(btrim(p_room)))
    on conflict (from_hash, to_hash) do update set room_code = excluded.room_code, created_at = now();
  return true;
end $$;

create or replace function public.genesis_invite_clear(p_code text, p_room text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.genesis_invites where to_hash = public.genesis_hash(p_code) and room_code = upper(btrim(p_room));
end $$;

revoke all on function public.genesis_me(text) from public, anon, authenticated;
revoke all on function public.genesis_card(text) from public, anon, authenticated;
revoke all on function public.genesis_profile_of(text) from public, anon, authenticated;
revoke all on function public.genesis_friends_state(text) from public;
revoke all on function public.genesis_friend_search(text, text) from public;
revoke all on function public.genesis_friend_request(text, text) from public;
revoke all on function public.genesis_friend_respond(text, text, boolean) from public;
revoke all on function public.genesis_friend_remove(text, text) from public;
revoke all on function public.genesis_friend_invite(text, text, text) from public;
revoke all on function public.genesis_invite_clear(text, text) from public;
grant execute on function public.genesis_friends_state(text) to anon, authenticated;
grant execute on function public.genesis_friend_search(text, text) to anon, authenticated;
grant execute on function public.genesis_friend_request(text, text) to anon, authenticated;
grant execute on function public.genesis_friend_respond(text, text, boolean) to anon, authenticated;
grant execute on function public.genesis_friend_remove(text, text) to anon, authenticated;
grant execute on function public.genesis_friend_invite(text, text, text) to anon, authenticated;
grant execute on function public.genesis_invite_clear(text, text) to anon, authenticated;
