-- Gênesis · Amigos: sugestões de jogadores para adicionar sem digitar.
-- Rode no Supabase > SQL Editor DEPOIS do friends.sql. Só ACRESCENTA uma função
-- (só leitura). Não apaga nada, não mexe em contas, saves, rankings nem amizades.

create or replace function public.genesis_friend_suggest(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me text := public.genesis_me(p_code);
  v_hashes text[];
  v_h text;
begin
  select array_agg(x.code_hash) into v_hashes from (
    select s.code_hash
      from public.genesis_saves s
     where s.code_hash <> v_me
       and not s.hidden
       and coalesce(s.data ->> 'creator', '') <> 'true'
       and coalesce(s.data ->> 'nick', '') <> ''
       and s.updated_at > now() - interval '14 days'
       and not exists (select 1 from public.genesis_friends f
                        where (f.from_hash = v_me and f.to_hash = s.code_hash)
                           or (f.to_hash = v_me and f.from_hash = s.code_hash))
     order by s.updated_at desc
     limit 12) x;
  if v_hashes is null then return '[]'::jsonb; end if;
  foreach v_h in array v_hashes loop perform public.genesis_profile_of(v_h); end loop;
  return (select jsonb_agg(public.genesis_card(h)) from unnest(v_hashes) as u(h));
end $$;

revoke all on function public.genesis_friend_suggest(text) from public;
grant execute on function public.genesis_friend_suggest(text) to anon, authenticated;

notify pgrst, 'reload schema';
