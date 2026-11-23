-- Gênesis: quem jogou HOJE e ONTEM (só leitura, não altera nada).
-- Cole no Supabase > SQL Editor e clique em Run. Horário de Brasília.

with dia as (
  select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as hoje,
         to_char(now() at time zone 'America/Sao_Paulo' - interval '1 day', 'YYYY-MM-DD') as ontem
)
select
  left(coalesce(s.data ->> 'nick', '?'), 16)                                         as jogador,
  round(public.genesis_num(s.data -> 'play' -> 'days' -> dia.hoje) / 60)             as minutos_hoje,
  round(public.genesis_num(s.data -> 'play' -> 'days' -> dia.ontem) / 60)            as minutos_ontem,
  to_char(s.updated_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')            as ultima_vez,
  public.genesis_num(s.data -> 'level')                                              as nivel,
  public.genesis_num(s.data -> 'trophies')                                           as trofeus,
  to_char(s.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')               as criou_conta
from public.genesis_saves s, dia
where coalesce(s.data ->> 'creator', '') <> 'true'
  and ( public.genesis_num(s.data -> 'play' -> 'days' -> dia.hoje) > 0
     or public.genesis_num(s.data -> 'play' -> 'days' -> dia.ontem) > 0
     or s.updated_at > now() - interval '2 days' )
order by minutos_hoje desc, minutos_ontem desc, s.updated_at desc;

-- totais (rode separado se quiser):
-- with dia as (select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as hoje,
--                     to_char(now() at time zone 'America/Sao_Paulo' - interval '1 day', 'YYYY-MM-DD') as ontem)
-- select count(*) filter (where public.genesis_num(data -> 'play' -> 'days' -> dia.hoje) > 0)  as jogaram_hoje,
--        count(*) filter (where public.genesis_num(data -> 'play' -> 'days' -> dia.ontem) > 0) as jogaram_ontem,
--        (select count(*) from public.genesis_push) as com_lembretes_ligados
--   from public.genesis_saves, dia;
