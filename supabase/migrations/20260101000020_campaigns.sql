-- Campanhas para as clientes (retenção e adesão), todas definidas pela gestora:
--  * segmento (quem recebe), texto, destino, frequência e vigência;
--  * limites gerais: máximo de campanhas por cliente por semana e horário permitido (São Paulo);
--  * envio automático pelo agendador (pg_cron) ou "Enviar agora"; cada aviso sai uma vez por janela (rule_key);
--  * a cliente que desligou "Campanhas e novidades" em Configurações → Avisos não recebe;
--  * resultado por campanha: enviadas, lidas e clientes que marcaram horário em até 14 dias.
-- Pode ser rodada mais de uma vez.

alter table public.loyalty_config add column if not exists campaign_max_per_week int not null default 2;
alter table public.loyalty_config add column if not exists campaign_from time not null default '09:00';
alter table public.loyalty_config add column if not exists campaign_to time not null default '20:00';

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  template text not null default 'custom',
  segment jsonb not null default '{"type":"all"}',
  title text not null check (char_length(title) between 1 and 60),
  body text not null default '' check (char_length(body) <= 200),
  href text not null default '/cliente',
  status text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'encerrada')),
  starts_on date,
  ends_on date,
  every_days int not null default 30 check (every_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_clinic on public.campaigns (clinic_id, status);

create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  period bigint not null,
  sent_at timestamptz not null default now(),
  unique (campaign_id, client_id, period)
);
create index if not exists campaign_sends_campaign on public.campaign_sends (campaign_id);

alter table public.campaigns enable row level security;
alter table public.campaign_sends enable row level security;
grant select on public.campaigns, public.campaign_sends to authenticated;
drop policy if exists campaigns_gestor on public.campaigns;
create policy campaigns_gestor on public.campaigns for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());
drop policy if exists campaign_sends_gestor on public.campaign_sends;
create policy campaign_sends_gestor on public.campaign_sends for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());

-- ---------------------------------------------------------------- quem recebe
-- tipos: inactive (sem atendimento há N dias e sem horário marcado), birthday (aniversário nos próximos N dias),
-- new (cadastrada há até N dias e sem atendimento), confirm (horário pendente nas próximas 48 h),
-- near_reward (faltam até N pontos para um prêmio), near_level (faltam até N pontos para o próximo nível), all.
-- Só entram clientes que têm acesso ao app (perfil ativo): sem acesso não há como avisar.
create or replace function app.campaign_audience(p_clinic uuid, p_segment jsonb) returns table (client_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  t text := coalesce(p_segment ->> 'type', 'all');
  d int := greatest(0, least(coalesce((p_segment ->> 'days')::int, 0), 3650));
  pts int := greatest(0, least(coalesce((p_segment ->> 'points')::int, 0), 100000));
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  cfg public.loyalty_config;
begin
  select * into cfg from public.loyalty_config where clinic_id = p_clinic;
  return query
  select c.id
    from public.clients c
   where c.clinic_id = p_clinic
     and exists (select 1 from public.profiles p where p.client_id = c.id and p.role = 'cliente' and p.active)
     and case t
       when 'inactive' then
         c.last_visit is not null and today - c.last_visit >= greatest(d, 1)
         and not exists (select 1 from public.appointments a
                          where a.client_id = c.id and a.date >= today and a.status <> 'cancelled' and not a.done)
       when 'birthday' then
         c.birth is not null and (
           select case when o < today then (o + interval '1 year')::date else o end
             from (select (c.birth + ((extract(year from today)::int - extract(year from c.birth)::int) * interval '1 year'))::date as o) x
         ) between today and today + d
       when 'new' then
         c.created_at >= now() - make_interval(days => greatest(d, 1))
         and not exists (select 1 from public.sessions s where s.client_id = c.id and s.status = 'done')
       when 'confirm' then
         exists (select 1 from public.appointments a
                  where a.client_id = c.id and a.status = 'pending' and not a.done and a.date between today and today + 2)
       when 'near_reward' then
         coalesce(cfg.enabled, false) and exists (
           select 1 from public.rewards r
            where r.clinic_id = p_clinic and r.active and r.cost > app.loyalty_balance(c.id)
              and r.cost - app.loyalty_balance(c.id) <= pts)
       when 'near_level' then
         coalesce(cfg.enabled, false)
         and app.loyalty_next_level(cfg.levels, app.loyalty_earned(c.id)) is not null
         and (app.loyalty_next_level(cfg.levels, app.loyalty_earned(c.id)) ->> 'min')::int - app.loyalty_earned(c.id) <= pts
       when 'all' then true
       else false end;
end $$;

-- campanhas já recebidas nos últimos 7 dias por um perfil
create or replace function app.campaigns_this_week(p_recipient uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.notifications where recipient_id = p_recipient and kind = 'campaign' and created_at > now() - interval '7 days'
$$;

-- ---------------------------------------------------------------- envio
create or replace function app.send_campaign(p_campaign uuid, p_ignore_window boolean default false) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.campaigns;
  cfg public.loyalty_config;
  lt time := (now() at time zone 'America/Sao_Paulo')::time;
  period bigint;
  r record;
  pr record;
  cl public.clients;
  sent int := 0;
  maxw int;
  bal int;
  earned int;
  lvl jsonb;
  nxt jsonb;
  rw_name text;
  rw_cost int;
  left_ int;
  ttl text;
  bdy text;
  nid uuid;
begin
  select * into c from public.campaigns where id = p_campaign;
  if not found then return 0; end if;
  select * into cfg from public.loyalty_config where clinic_id = c.clinic_id;
  maxw := coalesce(cfg.campaign_max_per_week, 2);
  if not p_ignore_window and not (lt between coalesce(cfg.campaign_from, '09:00') and coalesce(cfg.campaign_to, '20:00')) then
    return 0;
  end if;
  period := floor(extract(epoch from now()) / (c.every_days * 86400))::bigint;

  for r in select a.client_id from app.campaign_audience(c.clinic_id, c.segment) a limit 500 loop
    select * into cl from public.clients where id = r.client_id;
    bal := app.loyalty_balance(r.client_id);
    earned := app.loyalty_earned(r.client_id);
    lvl := case when cfg.levels is null then null else app.loyalty_level(cfg.levels, earned) end;
    nxt := case when cfg.levels is null then null else app.loyalty_next_level(cfg.levels, earned) end;
    rw_name := null;
    rw_cost := null;
    select name, cost into rw_name, rw_cost from public.rewards
     where clinic_id = c.clinic_id and active and cost > bal order by cost limit 1;
    if rw_name is null then
      select name, cost into rw_name, rw_cost from public.rewards where clinic_id = c.clinic_id and active order by cost limit 1;
    end if;
    left_ := case when (c.segment ->> 'type') = 'near_level' and nxt is not null then (nxt ->> 'min')::int - earned
                  when rw_cost is not null then greatest(rw_cost - bal, 0) else 0 end;

    for pr in select id from public.profiles where client_id = r.client_id and role = 'cliente' and active loop
      continue when not coalesce((select (data -> 'cliente' ->> 'campaigns')::boolean from public.prefs where user_id = pr.id), true);
      continue when maxw <= 0 or app.campaigns_this_week(pr.id) >= maxw;
      ttl := c.title; bdy := c.body;
      ttl := replace(replace(replace(replace(replace(ttl, '{nome}', split_part(cl.name, ' ', 1)), '{pontos}', bal::text), '{nivel}', coalesce(lvl ->> 'name', '')), '{premio}', coalesce(rw_name, '')), '{faltam}', left_::text);
      bdy := replace(replace(replace(replace(replace(bdy, '{nome}', split_part(cl.name, ' ', 1)), '{pontos}', bal::text), '{nivel}', coalesce(lvl ->> 'name', '')), '{premio}', coalesce(rw_name, '')), '{faltam}', left_::text);
      insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
      values (c.clinic_id, pr.id, 'camp:' || c.id || ':' || period, 'campaign', ttl, bdy, c.href)
      on conflict (recipient_id, rule_key) do nothing
      returning id into nid;
      if nid is not null then
        sent := sent + 1;
        insert into public.campaign_sends (campaign_id, clinic_id, client_id, period) values (c.id, c.clinic_id, r.client_id, period)
        on conflict do nothing;
      end if;
      nid := null;
    end loop;
  end loop;
  return sent;
end $$;

-- agendador: campanhas ativas e dentro da vigência
create or replace function app.run_campaigns(p_force boolean default false) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c record;
  total int := 0;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.campaigns set status = 'encerrada', updated_at = now() where status = 'ativa' and ends_on is not null and ends_on < today;
  for c in select id from public.campaigns
            where status = 'ativa' and (starts_on is null or starts_on <= today) and (ends_on is null or ends_on >= today) loop
    total := total + app.send_campaign(c.id, p_force);
  end loop;
  return total;
end $$;

revoke all on function app.campaign_audience(uuid, jsonb), app.campaigns_this_week(uuid),
  app.send_campaign(uuid, boolean), app.run_campaigns(boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- gestora
create or replace function app.clean_segment(p jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'type', case when (p ->> 'type') in ('inactive', 'birthday', 'new', 'confirm', 'near_reward', 'near_level', 'all') then p ->> 'type' else 'all' end,
    'days', greatest(0, least(coalesce((p ->> 'days')::int, 0), 3650)),
    'points', greatest(0, least(coalesce((p ->> 'points')::int, 0), 100000)))
$$;
revoke all on function app.clean_segment(jsonb) from public, anon, authenticated;

create or replace function public.campaigns_admin() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  cfg public.loyalty_config;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = clinic;
  return jsonb_build_object(
    'ok', true,
    'loyalty_enabled', coalesce(cfg.enabled, false),
    'limits', jsonb_build_object(
      'max_per_week', coalesce(cfg.campaign_max_per_week, 2),
      'from', to_char(coalesce(cfg.campaign_from, '09:00'::time), 'HH24:MI'),
      'to', to_char(coalesce(cfg.campaign_to, '20:00'::time), 'HH24:MI')),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'template', c.template, 'segment', c.segment, 'title', c.title, 'body', c.body,
        'href', c.href, 'status', c.status, 'starts_on', c.starts_on, 'ends_on', c.ends_on, 'every_days', c.every_days,
        'audience', (select count(*) from app.campaign_audience(clinic, c.segment)),
        'sent', (select count(*) from public.campaign_sends s where s.campaign_id = c.id),
        'read', (select count(*) from public.campaign_sends s
                  where s.campaign_id = c.id and exists (
                    select 1 from public.notifications n join public.profiles p on p.id = n.recipient_id
                     where p.client_id = s.client_id and n.rule_key = 'camp:' || s.campaign_id || ':' || s.period and n.read)),
        'booked', (select count(*) from public.campaign_sends s
                    where s.campaign_id = c.id and exists (
                      select 1 from public.appointments a
                       where a.client_id = s.client_id and a.status <> 'cancelled'
                         and a.created_at >= s.sent_at and a.created_at <= s.sent_at + interval '14 days'))
      ) order by (c.status = 'ativa') desc, c.created_at desc), '[]')
        from public.campaigns c where c.clinic_id = clinic));
end $$;

create or replace function public.save_campaign(
  p_id uuid, p_name text, p_template text, p_segment jsonb, p_title text, p_body text, p_href text,
  p_status text, p_starts_on date, p_ends_on date, p_every_days int
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  nm text := left(trim(coalesce(p_name, '')), 60);
  ti text := left(trim(coalesce(p_title, '')), 60);
  bo text := left(trim(coalesce(p_body, '')), 200);
  hr text := case when p_href in ('/cliente', '/cliente/agenda', '/cliente/conquistas', '/cliente/evolucao') then p_href else '/cliente' end;
  st text := case when p_status in ('rascunho', 'ativa', 'pausada', 'encerrada') then p_status else 'rascunho' end;
  ev int := greatest(1, least(coalesce(p_every_days, 30), 365));
  new_id uuid;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'reason', 'nome_vazio'); end if;
  if ti = '' then return jsonb_build_object('ok', false, 'reason', 'titulo_vazio'); end if;
  if p_starts_on is not null and p_ends_on is not null and p_ends_on < p_starts_on then
    return jsonb_build_object('ok', false, 'reason', 'datas_invalidas');
  end if;
  if p_id is null then
    if (select count(*) from public.campaigns where clinic_id = clinic) >= 60 then
      return jsonb_build_object('ok', false, 'reason', 'limite_de_campanhas');
    end if;
    insert into public.campaigns (clinic_id, name, template, segment, title, body, href, status, starts_on, ends_on, every_days)
    values (clinic, nm, left(coalesce(p_template, 'custom'), 30), app.clean_segment(coalesce(p_segment, '{}')), ti, bo, hr, st, p_starts_on, p_ends_on, ev)
    returning id into new_id;
  else
    update public.campaigns set name = nm, template = left(coalesce(p_template, template), 30), segment = app.clean_segment(coalesce(p_segment, segment)),
           title = ti, body = bo, href = hr, status = st, starts_on = p_starts_on, ends_on = p_ends_on, every_days = ev, updated_at = now()
     where id = p_id and clinic_id = clinic returning id into new_id;
    if new_id is null then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.set_campaign_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if p_status not in ('rascunho', 'ativa', 'pausada', 'encerrada') then return jsonb_build_object('ok', false, 'reason', 'estado_invalido'); end if;
  update public.campaigns set status = p_status, updated_at = now() where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_campaign(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  delete from public.campaigns where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- quantas clientes receberiam (sem enviar nada) e quantas já estão no limite da semana
create or replace function public.preview_campaign_audience(p_segment jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  seg jsonb := app.clean_segment(coalesce(p_segment, '{}'));
  maxw int;
  total int;
  blocked int;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  maxw := coalesce((select campaign_max_per_week from public.loyalty_config where clinic_id = clinic), 2);
  select count(*) into total from app.campaign_audience(clinic, seg);
  select count(*) into blocked from app.campaign_audience(clinic, seg) a
   where exists (select 1 from public.profiles p where p.client_id = a.client_id and p.role = 'cliente' and p.active
                   and (maxw <= 0 or app.campaigns_this_week(p.id) >= maxw));
  return jsonb_build_object(
    'ok', true, 'count', total, 'blocked', blocked,
    'sample', (select coalesce(jsonb_agg(split_part(c.name, ' ', 1)), '[]')
                 from (select cc.name from public.clients cc where cc.id in (select client_id from app.campaign_audience(clinic, seg)) order by cc.name limit 5) c));
end $$;

create or replace function public.send_campaign_now(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.campaigns;
  n int;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into c from public.campaigns where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  if c.status = 'encerrada' then return jsonb_build_object('ok', false, 'reason', 'campanha_encerrada'); end if;
  n := app.send_campaign(c.id, true);
  perform app.log(c.clinic_id, 'gestor', auth.uid(), 'cadastro', null, 'Enviou a campanha "' || c.name || '" (' || n || ' clientes)');
  return jsonb_build_object('ok', true, 'sent', n);
end $$;

create or replace function public.save_campaign_limits(p_max int, p_from text, p_to text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  f time;
  t time;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  begin
    f := p_from::time;
    t := p_to::time;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'horario_invalido');
  end;
  if t <= f then return jsonb_build_object('ok', false, 'reason', 'horario_invalido'); end if;
  insert into public.loyalty_config (clinic_id, campaign_max_per_week, campaign_from, campaign_to)
  values (clinic, greatest(0, least(coalesce(p_max, 2), 14)), f, t)
  on conflict (clinic_id) do update set
    campaign_max_per_week = excluded.campaign_max_per_week, campaign_from = excluded.campaign_from,
    campaign_to = excluded.campaign_to, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.campaigns_admin(), public.save_campaign(uuid, text, text, jsonb, text, text, text, text, date, date, int),
  public.set_campaign_status(uuid, text), public.delete_campaign(uuid), public.preview_campaign_audience(jsonb),
  public.send_campaign_now(uuid), public.save_campaign_limits(int, text, text) from public, anon;
grant execute on function public.campaigns_admin(), public.save_campaign(uuid, text, text, jsonb, text, text, text, text, date, date, int),
  public.set_campaign_status(uuid, text), public.delete_campaign(uuid), public.preview_campaign_audience(jsonb),
  public.send_campaign_now(uuid), public.save_campaign_limits(int, text, text) to authenticated;

-- ---------------------------------------------------------------- agendador (só existe no Supabase com pg_cron ligado)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('eb-campaigns');
    exception when others then null;
    end;
    perform cron.schedule('eb-campaigns', '*/15 * * * *', 'select app.run_campaigns()');
  end if;
end $$;
