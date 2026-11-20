-- Gênesis: relatório dos jogadores (só leitura). Cole no Supabase > SQL Editor e clique em Run.
-- Tempo de jogo começou a ser medido na versão 2.0.1 (antes disso aparece 0).

select
  left(coalesce(data ->> 'nick', '?'), 16)                                         as jogador,
  to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')               as criou_conta,
  to_char(updated_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')            as ultima_vez,
  round(public.genesis_num(data #> '{play,total}') / 60)                            as minutos_total,
  round(public.genesis_num(data -> 'play' -> 'days' -> to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')) / 60) as minutos_hoje,
  coalesce((select round(sum(public.genesis_num(v)) / 60) from jsonb_each(coalesce(data #> '{play,days}', '{}'::jsonb)) as d(k, v)
             where k >= to_char(now() at time zone 'America/Sao_Paulo' - interval '6 days', 'YYYY-MM-DD')), 0) as minutos_7_dias,
  public.genesis_num(data #> '{lamp,count}')                                       as lamparina_dias,
  public.genesis_num(data -> 'level')                                              as nivel,
  public.genesis_num(data -> 'trophies')                                           as trofeus,
  exists (select 1 from public.genesis_push p where p.code_hash = s.code_hash)     as lembretes
from public.genesis_saves s
where coalesce(data ->> 'creator', '') <> 'true'
order by minutos_total desc, updated_at desc;

-- resumo:
-- select count(*) as contas,
--        count(*) filter (where updated_at > now() - interval '1 day') as ativos_24h,
--        (select count(*) from public.genesis_push) as com_lembretes
--   from public.genesis_saves;
