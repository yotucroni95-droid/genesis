-- Gênesis: ranking (rode depois do setup.sql). Pode rodar de novo sem problema.
--
-- Mostra só apelido, personagem, moldura e números do jogo (nenhum dado pessoal).
-- Para tirar um trapaceiro do ranking: Table Editor > genesis_saves > marque "hidden".
-- A conta do criador do jogo (data.creator = true) nunca aparece.
-- Números impossíveis (Arena > 20.000, estrelas > 2.000, troféus > 5.000.000, semana > 20.000) ficam de fora.
-- 'semana' = Pontos de Temporada (PT) desde a última segunda-feira; 'semana_passada' = a semana anterior (prêmio do top 3).
-- Saves antigos sem 'points' usam os troféus da semana.

alter table public.genesis_saves add column if not exists hidden boolean not null default false;

-- número de um campo do progresso; 0 se vier qualquer coisa estranha
create or replace function public.genesis_num(j jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'number' then least(greatest((j #>> '{}')::numeric, 0), 10000000) else 0 end
$$;

create or replace function public.genesis_stars(j jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'object'
    then coalesce((select sum(public.genesis_num(v)) from jsonb_each(j) as e(k, v) where k not like '%#heroi'), 0)
    else 0 end
$$;

-- a segunda-feira que começa a semana (horário de Brasília); p_back = 1 é a semana passada
create or replace function public.genesis_week(p_back int)
returns text language sql stable set search_path = '' as $$
  select to_char(date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)::date - 7 * p_back, 'YYYY-MM-DD')
$$;

-- p_kind: 'trofeus' | 'arena' | 'estrelas' | 'semana' | 'semana_passada'. Devolve o top 50 e a posição de quem pediu.
create or replace function public.genesis_ranking(p_kind text, p_code text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select code_hash,
           left(coalesce(data ->> 'nick', ''), 16) as nick,
           left(coalesce(data ->> 'avatarId', 'peregrino'), 32) as avatar,
           left(coalesce(data #>> '{equipped,frame}', 'madeira'), 32) as frame,
           public.genesis_num(data -> 'level') as level,
           case p_kind
             when 'arena' then public.genesis_num(data -> 'arenaBest')
             when 'estrelas' then public.genesis_stars(data -> 'stars')
             when 'semana' then case when data #>> '{week,id}' = public.genesis_week(0) then public.genesis_num(coalesce(data #> '{week,points}', data #> '{week,trophies}')) else 0 end
             when 'semana_passada' then case
               when data #>> '{week,id}' = public.genesis_week(1) then public.genesis_num(coalesce(data #> '{week,points}', data #> '{week,trophies}'))
               when data #>> '{lastWeek,id}' = public.genesis_week(1) then public.genesis_num(coalesce(data #> '{lastWeek,points}', data #> '{lastWeek,trophies}'))
               else 0 end
             else public.genesis_num(data -> 'trophies')
           end as value,
           updated_at
      from public.genesis_saves
     where not hidden
       and coalesce(data ->> 'creator', '') <> 'true'
       and coalesce(data ->> 'nick', '') <> ''
  ),
  ranked as (
    select *, row_number() over (order by value desc, level desc, updated_at asc) as pos
      from base
     where value > 0
       and value <= case p_kind when 'arena' then 20000 when 'estrelas' then 2000 when 'semana' then 60000 when 'semana_passada' then 60000 else 5000000 end
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('pos', pos, 'nick', nick, 'avatar', avatar, 'frame', frame, 'level', level, 'value', value) order by pos)
                       from ranked where pos <= 50), '[]'::jsonb),
    'me', (select jsonb_build_object('pos', pos, 'value', value) from ranked
            where p_code is not null and code_hash = public.genesis_hash(p_code)),
    'total', (select count(*) from ranked)
  )
$$;

revoke all on function public.genesis_num(jsonb) from public, anon, authenticated;
revoke all on function public.genesis_stars(jsonb) from public, anon, authenticated;
revoke all on function public.genesis_week(int) from public, anon, authenticated;
revoke all on function public.genesis_ranking(text, text) from public;
grant execute on function public.genesis_ranking(text, text) to anon, authenticated;
