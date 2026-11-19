-- Gênesis: códigos de prêmio que valem UMA vez no total (sorteios, promessas).
-- Rode no Supabase > SQL Editor. Pode rodar de novo sem problema.
--
-- O banco guarda só a "impressão digital" (SHA-256) de cada código, nunca o código.
-- O primeiro jogador que resgatar gasta o código para todo mundo.
-- Para criar um código novo: insert into public.genesis_codes (code_hash, prize, note)
--   values ('<sha256 de "genesis-presente|CODIGO">', '{"character":"daniel","fallbackCoins":1000}', 'para quem');

create table if not exists public.genesis_codes (
  code_hash  text primary key,
  prize      jsonb not null,
  note       text,
  used_at    timestamptz,
  used_by    text,            -- impressão digital da conta que resgatou (se tiver conta)
  created_at timestamptz not null default now()
);

alter table public.genesis_codes enable row level security;
revoke all on table public.genesis_codes from anon, authenticated;

-- devolve o prêmio e marca o código como usado; erro se não existe ou já foi usado
create or replace function public.genesis_redeem(p_code text, p_account text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_prize jsonb;
begin
  update public.genesis_codes
     set used_at = now(),
         used_by = case when p_account is null then null else public.genesis_hash(p_account) end
   where code_hash = encode(sha256(convert_to('genesis-presente|' || upper(btrim(p_code)), 'UTF8')), 'hex')
     and used_at is null
  returning prize into v_prize;
  if v_prize is null then
    if exists (select 1 from public.genesis_codes
                where code_hash = encode(sha256(convert_to('genesis-presente|' || upper(btrim(p_code)), 'UTF8')), 'hex')) then
      raise exception 'codigo ja usado';
    end if;
    raise exception 'codigo invalido';
  end if;
  return v_prize;
end $$;

revoke all on function public.genesis_redeem(text, text) from public;
grant execute on function public.genesis_redeem(text, text) to anon, authenticated;
