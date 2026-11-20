-- Gênesis: lembretes (notificações) estilo "não deixe a lamparina apagar".
-- Rode no Supabase > SQL Editor depois do setup.sql e do ranking.sql. Pode rodar de novo.
--
-- Como funciona:
--  * o jogador toca em "Ativar lembretes"; o celular devolve um endereço de entrega,
--    guardado aqui junto da conta (genesis_push_subscribe, exige o código secreto);
--  * todo dia às 18h (Brasília) o agendador chama a função "genesis-push" (Edge Function),
--    que pede a lista a genesis_push_batch() e entrega as mensagens;
--  * no máximo 1 lembrete por dia por jogador, só entre 17h e 21h;
--  * quem ficou mais de 30 dias sem jogar não recebe mais;
--  * ninguém lê a tabela direto (RLS ligado, sem políticas, acesso revogado).

create table if not exists public.genesis_push (
  code_hash  text primary key references public.genesis_saves(code_hash) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_sent  text,          -- dia (AAAA-MM-DD) do último lembrete
  last_rank  int            -- posição no ranking da temporada na última checagem
);
alter table public.genesis_push enable row level security;
revoke all on table public.genesis_push from anon, authenticated;

create or replace function public.genesis_push_subscribe(p_code text, p_sub jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := public.genesis_hash(p_code);
  v_end text := p_sub ->> 'endpoint';
  v_p text := p_sub #>> '{keys,p256dh}';
  v_a text := p_sub #>> '{keys,auth}';
begin
  if not exists (select 1 from public.genesis_saves where code_hash = v_hash) then raise exception 'conta nao encontrada'; end if;
  if v_end is null or v_end !~ '^https://' or length(v_end) > 1000
     or v_p is null or length(v_p) > 200 or v_a is null or length(v_a) > 100 then
    raise exception 'inscricao invalida';
  end if;
  insert into public.genesis_push (code_hash, endpoint, p256dh, auth) values (v_hash, v_end, v_p, v_a)
    on conflict (code_hash) do update set endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  return true;
end $$;

create or replace function public.genesis_push_unsubscribe(p_code text)
returns void language sql security definer set search_path = '' as $$
  delete from public.genesis_push where code_hash = public.genesis_hash(p_code)
$$;

-- lista do dia: um lembrete por jogador, escolhido pelo que mais importa para ele
create or replace function public.genesis_push_batch()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_today text := to_char(v_now, 'YYYY-MM-DD');
  v_yday text := to_char(v_now - interval '1 day', 'YYYY-MM-DD');
  v_week text := public.genesis_week(0);
  v_out jsonb := '[]'::jsonb;
  r record;
  v_kind text;
begin
  if extract(hour from v_now) < 17 or extract(hour from v_now) >= 21 then return v_out; end if;
  for r in
    with pts as (
      select s.code_hash, left(coalesce(s.data ->> 'nick', ''), 16) as nick,
             case when s.data #>> '{week,id}' = v_week
                  then public.genesis_num(coalesce(s.data #> '{week,points}', s.data #> '{week,trophies}')) else 0 end as points
        from public.genesis_saves s
       where not s.hidden and coalesce(s.data ->> 'creator', '') <> 'true' and coalesce(s.data ->> 'nick', '') <> ''
    ),
    ranked as (
      select code_hash, nick, points, row_number() over (order by points desc, code_hash) as pos from pts where points > 0
    )
    select p.code_hash, p.endpoint, p.p256dh, p.auth, p.last_rank,
           left(coalesce(s.data ->> 'nick', ''), 16) as nick,
           public.genesis_num(s.data #> '{lamp,count}') as lamp,
           coalesce(s.data #>> '{lamp,last}', '') as lamp_last,
           coalesce(s.data #>> '{daily,date}', '') as daily_date,
           (select count(*) from jsonb_array_elements(case when jsonb_typeof(s.data #> '{daily,missions}') = 'array' then s.data #> '{daily,missions}' else '[]'::jsonb end) m
             where coalesce(m ->> 'claimed', 'false') <> 'true') as missions_left,
           s.updated_at,
           k.pos,
           (select a.nick from ranked a where a.pos = k.pos - 1) as above
      from public.genesis_push p
      join public.genesis_saves s on s.code_hash = p.code_hash
      left join ranked k on k.code_hash = p.code_hash
     where p.last_sent is distinct from v_today
  loop
    v_kind := null;
    if r.updated_at < now() - interval '30 days' then
      v_kind := null;                                            -- parou de jogar: não insiste
    elsif r.lamp_last = v_yday and r.lamp >= 1 then
      v_kind := 'lamp';                                          -- vai apagar hoje à noite
    elsif r.pos is not null and r.last_rank is not null and r.pos > r.last_rank and r.above is not null then
      v_kind := 'rank';                                          -- alguém passou na frente
    elsif r.lamp_last <> v_today and r.daily_date <> v_today then
      v_kind := 'comeback';                                      -- ainda não jogou hoje
    elsif r.daily_date = v_today and r.missions_left > 0 then
      v_kind := 'missions';                                      -- jogou, mas faltam missões
    end if;
    update public.genesis_push set last_sent = v_today, last_rank = r.pos where code_hash = r.code_hash;
    if v_kind is not null then
      v_out := v_out || jsonb_build_object('endpoint', r.endpoint, 'p256dh', r.p256dh, 'auth', r.auth, 'kind', v_kind,
        'nick', r.nick, 'lamp', r.lamp, 'missions', r.missions_left, 'pos', r.pos, 'above', r.above);
    end if;
  end loop;
  return v_out;
end $$;

-- endereço que o celular desativou (desinstalou, bloqueou): sai da lista
create or replace function public.genesis_push_gone(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.genesis_push where endpoint = p_endpoint
$$;

revoke all on function public.genesis_push_batch() from public, anon, authenticated;
revoke all on function public.genesis_push_gone(text) from public, anon, authenticated;
revoke all on function public.genesis_push_subscribe(text, jsonb) from public;
revoke all on function public.genesis_push_unsubscribe(text) from public;
grant execute on function public.genesis_push_subscribe(text, jsonb) to anon, authenticated;
grant execute on function public.genesis_push_unsubscribe(text) to anon, authenticated;

-- agendador: todo dia às 18h de Brasília (21h UTC) chama a função genesis-push
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'genesis-push';
select cron.schedule('genesis-push', '0 21 * * *', $$
  select net.http_post(
    url := 'https://iayxomffudrtgyhgvuci.supabase.co/functions/v1/genesis-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
