-- Gênesis — banco de dados (Supabase / Postgres)
-- Como usar: no Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
--
-- Regras de segurança (Row Level Security):
--   * cada jogador lê e grava só as próprias linhas;
--   * quem tem is_admin = true (o líder) pode LER tudo;
--   * ninguém consegue se promover a líder pelo jogo.

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nick        text not null unique check (nick ~ '^[a-z0-9_]{3,16}$'),
  avatar_id   text not null default 'peregrino' check (char_length(avatar_id) <= 40),
  level       integer not null default 1 check (level between 1 and 100),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create table if not exists public.progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  stop_id       text not null check (char_length(stop_id) <= 60),
  completed_at  timestamptz not null default now(),
  score         integer not null default 0 check (score between 0 and 100000),
  primary key (user_id, stop_id)
);

create table if not exists public.unlocked_characters (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  character_id  text not null check (char_length(character_id) <= 40),
  unlocked_at   timestamptz not null default now(),
  primary key (user_id, character_id)
);

create table if not exists public.achievements (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  achievement_id  text not null check (char_length(achievement_id) <= 60),
  earned_at       timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------
-- Quem é líder? (usada pelas regras abaixo)
-- ---------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------
-- Perfil criado automaticamente quando a conta é criada.
-- O apelido vem do cadastro (nick@genesis.local) e é conferido aqui de novo.
-- ---------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_nick text := lower(coalesce(new.raw_user_meta_data ->> 'nick', split_part(new.email, '@', 1)));
begin
  if new_nick !~ '^[a-z0-9_]{3,16}$' then
    raise exception 'Apelido inválido';
  end if;
  insert into public.profiles (id, nick) values (new.id, new_nick);
  insert into public.unlocked_characters (user_id, character_id) values (new.id, 'peregrino')
    on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Permissões básicas: visitantes sem login não acessam nada.
-- Jogadores só podem mudar avatar, nível e "visto por último" no perfil.
-- ---------------------------------------------------------------

revoke all on public.profiles, public.progress, public.unlocked_characters, public.achievements from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (avatar_id, level, last_seen) on public.profiles to authenticated;
grant select, insert, update on public.progress, public.unlocked_characters, public.achievements to authenticated;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.progress            enable row level security;
alter table public.unlocked_characters enable row level security;
alter table public.achievements        enable row level security;

-- profiles
drop policy if exists "profiles: ler o próprio ou líder lê todos" on public.profiles;
create policy "profiles: ler o próprio ou líder lê todos" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profiles: atualizar só o próprio" on public.profiles;
create policy "profiles: atualizar só o próprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- progress
drop policy if exists "progress: ler o próprio ou líder lê todos" on public.progress;
create policy "progress: ler o próprio ou líder lê todos" on public.progress
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "progress: gravar só o próprio" on public.progress;
create policy "progress: gravar só o próprio" on public.progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "progress: atualizar só o próprio" on public.progress;
create policy "progress: atualizar só o próprio" on public.progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- unlocked_characters
drop policy if exists "personagens: ler o próprio ou líder lê todos" on public.unlocked_characters;
create policy "personagens: ler o próprio ou líder lê todos" on public.unlocked_characters
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "personagens: gravar só o próprio" on public.unlocked_characters;
create policy "personagens: gravar só o próprio" on public.unlocked_characters
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "personagens: atualizar só o próprio" on public.unlocked_characters;
create policy "personagens: atualizar só o próprio" on public.unlocked_characters
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- achievements
drop policy if exists "medalhas: ler o próprio ou líder lê todos" on public.achievements;
create policy "medalhas: ler o próprio ou líder lê todos" on public.achievements
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "medalhas: gravar só o próprio" on public.achievements;
create policy "medalhas: gravar só o próprio" on public.achievements
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "medalhas: atualizar só o próprio" on public.achievements;
create policy "medalhas: atualizar só o próprio" on public.achievements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------
-- Para tornar alguém líder (rode à parte, trocando o apelido):
--   update public.profiles set is_admin = true where nick = 'apelido_do_lider';
-- ---------------------------------------------------------------
