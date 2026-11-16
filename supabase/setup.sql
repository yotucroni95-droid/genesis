-- Gênesis: contas salvas na nuvem (Supabase).
-- Cole tudo isto no Supabase > SQL Editor > New query e clique em Run.
-- Pode rodar de novo sem problema.
--
-- Como funciona: cada conta é um código secreto (GEN-XXXX-XXXX-XXXX).
-- O banco guarda só a "impressão digital" (SHA-256) do código, nunca o código.
-- Ninguém lê a tabela diretamente: o jogo só usa as 3 funções abaixo, e cada
-- uma exige o código certo. Nenhum dado pessoal (e-mail, nome, telefone).

create table if not exists public.genesis_saves (
  code_hash  text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tabela trancada: sem políticas, ninguém de fora lê ou escreve direto nela
alter table public.genesis_saves enable row level security;
revoke all on table public.genesis_saves from anon, authenticated;

create or replace function public.genesis_hash(p_code text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(btrim(p_code)), 'UTF8')), 'hex')
$$;

-- cria uma conta nova com o progresso atual do celular
create or replace function public.genesis_create(p_code text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if upper(btrim(p_code)) !~ '^GEN-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$' then
    raise exception 'codigo invalido';
  end if;
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 300000 then
    raise exception 'dados invalidos';
  end if;
  insert into public.genesis_saves (code_hash, data) values (public.genesis_hash(p_code), p_data);
  return true;
end $$;

-- devolve o progresso da conta (ou nada, se o código não existe)
create or replace function public.genesis_load(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select data from public.genesis_saves where code_hash = public.genesis_hash(p_code)
$$;

-- guarda o progresso novo da conta
create or replace function public.genesis_save(p_code text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 300000 then
    raise exception 'dados invalidos';
  end if;
  update public.genesis_saves set data = p_data, updated_at = now()
   where code_hash = public.genesis_hash(p_code);
  return found;
end $$;

revoke all on function public.genesis_hash(text) from public, anon, authenticated;
revoke all on function public.genesis_create(text, jsonb) from public;
revoke all on function public.genesis_load(text) from public;
revoke all on function public.genesis_save(text, jsonb) from public;
grant execute on function public.genesis_create(text, jsonb) to anon, authenticated;
grant execute on function public.genesis_load(text) to anon, authenticated;
grant execute on function public.genesis_save(text, jsonb) to anon, authenticated;
