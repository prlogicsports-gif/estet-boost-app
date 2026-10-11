-- Fidelidade: funções que o app chama.
--  Cliente: my_loyalty, loyalty_ranking, set_ranking_optin (só lê o próprio resultado; ranking só com apelido e por opção dela).
--  Gestora: loyalty_admin, save_loyalty_config, save_badge, delete_badge, grant_badge, award_manual, loyalty_backfill.
-- Pode ser rodada mais de uma vez.

-- níveis: até 8, nomes de 1 a 24 letras, o primeiro sempre começa em 0 pontos
create or replace function app.clean_levels(p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  out_ jsonb;
  first_min int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', slug, 'name', nm, 'min', mn) order by mn, nm), '[]')
    into out_
    from (
      select left(trim(l ->> 'name'), 24) as nm,
             greatest(0, least(coalesce((l ->> 'min')::int, 0), 1000000)) as mn,
             trim(both '-' from lower(regexp_replace(left(trim(l ->> 'name'), 24), '[^A-Za-z0-9]+', '-', 'g'))) as slug
        from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) l
       where trim(coalesce(l ->> 'name', '')) <> ''
       limit 8
    ) t;
  if jsonb_array_length(out_) = 0 then
    return '[{"id":"bronze","name":"Bronze","min":0}]'::jsonb;
  end if;
  first_min := (out_ -> 0 ->> 'min')::int;
  if first_min > 0 then
    out_ := jsonb_set(out_, '{0,min}', '0');
  end if;
  return out_;
end $$;

create or replace function app.clean_points(p jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'session_done', greatest(0, least(coalesce((p ->> 'session_done')::int, 10), 1000)),
    'first_visit', greatest(0, least(coalesce((p ->> 'first_visit')::int, 20), 1000)),
    'return_on_time', greatest(0, least(coalesce((p ->> 'return_on_time')::int, 10), 1000)),
    'confirmed', greatest(0, least(coalesce((p ->> 'confirmed')::int, 3), 1000)),
    'signup', greatest(0, least(coalesce((p ->> 'signup')::int, 5), 1000)),
    'return_days', greatest(1, least(coalesce((p ->> 'return_days')::int, 45), 365)))
$$;

-- ---------------------------------------------------------------- cliente
create or replace function public.my_loyalty() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  total int;
  lvl jsonb;
  nxt jsonb;
  pos int;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('enabled', false); end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled then return jsonb_build_object('enabled', false); end if;

  total := coalesce((select sum(points) from public.loyalty_ledger where client_id = me.client_id), 0);
  lvl := app.loyalty_level(cfg.levels, total);
  nxt := app.loyalty_next_level(cfg.levels, total);

  select r.pos into pos from (
    select t.client_id, rank() over (order by t.pts desc) as pos from (
      select rm.client_id, coalesce((select sum(points) from public.loyalty_ledger l where l.client_id = rm.client_id), 0) as pts
        from public.ranking_members rm where rm.clinic_id = me.clinic_id) t) r
   where r.client_id = me.client_id;

  return jsonb_build_object(
    'enabled', true,
    'points', total,
    'level', lvl,
    'next', case when nxt is null then null
                 else jsonb_build_object('name', nxt ->> 'name', 'min', (nxt ->> 'min')::int, 'remaining', (nxt ->> 'min')::int - total) end,
    'levels', cfg.levels,
    'badges', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', b.id, 'name', b.name, 'icon', b.icon, 'criteria', b.criteria, 'threshold', b.threshold,
                 'earned', cb.client_id is not null, 'earned_at', cb.earned_at,
                 'progress', case when cb.client_id is not null or b.criteria = 'manual' then null
                                  else least(app.badge_value(me.client_id, b.criteria, total), b.threshold) end)
               order by b.position, b.created_at), '[]')
                 from public.badges b
                 left join public.client_badges cb on cb.badge_id = b.id and cb.client_id = me.client_id
                where b.clinic_id = me.clinic_id and b.active),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('event', h.event, 'points', h.points, 'note', h.note, 'at', h.created_at)
                 order by h.created_at desc), '[]')
                  from (select event, points, note, created_at from public.loyalty_ledger
                         where client_id = me.client_id order by created_at desc limit 30) h),
    'ranking', jsonb_build_object(
      'enabled', cfg.ranking_enabled,
      'optin', exists (select 1 from public.ranking_members where client_id = me.client_id),
      'nickname', (select nickname from public.ranking_members where client_id = me.client_id),
      'position', pos));
end $$;

-- ranking da clínica: só apelido, posição e pontos; só para quem entrou nele
create or replace function public.loyalty_ranking() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return '[]'::jsonb; end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled or not cfg.ranking_enabled then return '[]'::jsonb; end if;
  if not exists (select 1 from public.ranking_members where client_id = me.client_id) then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('position', r.pos, 'nickname', r.nickname, 'points', r.pts, 'me', r.client_id = me.client_id)
             order by r.pos, r.nickname), '[]')
      from (
        select t.client_id, t.nickname, t.pts, rank() over (order by t.pts desc) as pos from (
          select rm.client_id, rm.nickname, coalesce((select sum(points) from public.loyalty_ledger l where l.client_id = rm.client_id), 0) as pts
            from public.ranking_members rm where rm.clinic_id = me.clinic_id) t) r
       where r.pos <= 20 or r.client_id = me.client_id);
end $$;

create or replace function public.set_ranking_optin(p_optin boolean, p_nickname text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  nick text := trim(coalesce(p_nickname, ''));
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if not p_optin then
    delete from public.ranking_members where client_id = me.client_id;
    return jsonb_build_object('ok', true);
  end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled or not cfg.ranking_enabled then return jsonb_build_object('ok', false, 'reason', 'ranking_desligado'); end if;
  if nick !~ '^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._-]{1,23}$' then return jsonb_build_object('ok', false, 'reason', 'apelido_invalido'); end if;
  begin
    insert into public.ranking_members (client_id, clinic_id, nickname) values (me.client_id, me.clinic_id, nick)
    on conflict (client_id) do update set nickname = excluded.nickname;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'apelido_em_uso');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- gestora
create or replace function public.loyalty_admin() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  cfg public.loyalty_config;
  clinic uuid := app.clinic_id();
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = clinic;
  return jsonb_build_object(
    'ok', true,
    'config', jsonb_build_object(
      'enabled', coalesce(cfg.enabled, false),
      'ranking_enabled', coalesce(cfg.ranking_enabled, false),
      'points', coalesce(cfg.points, '{"session_done":10,"first_visit":20,"return_on_time":10,"confirmed":3,"signup":5,"return_days":45}'::jsonb),
      'levels', coalesce(cfg.levels, '[{"id":"bronze","name":"Bronze","min":0},{"id":"prata","name":"Prata","min":100},{"id":"ouro","name":"Ouro","min":300},{"id":"diamante","name":"Diamante","min":700}]'::jsonb)),
    'badges', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', b.id, 'name', b.name, 'icon', b.icon, 'criteria', b.criteria, 'threshold', b.threshold, 'active', b.active,
                 'earned_by', (select count(*) from public.client_badges cb where cb.badge_id = b.id))
               order by b.position, b.created_at), '[]')
                 from public.badges b where b.clinic_id = clinic),
    'overview', (
      with pts as (
        select c.id as client_id, c.name, coalesce((select sum(points) from public.loyalty_ledger l where l.client_id = c.id), 0) as total
          from public.clients c where c.clinic_id = clinic)
      select jsonb_build_object(
        'clients', (select count(*) from pts),
        'participants', (select count(*) from pts where total > 0),
        'points_issued', coalesce((select sum(points) from public.loyalty_ledger where clinic_id = clinic and points > 0), 0),
        'ranking_members', (select count(*) from public.ranking_members where clinic_id = clinic),
        'top', (select coalesce(jsonb_agg(jsonb_build_object('client_id', t.client_id, 'name', t.name, 'points', t.total)
                  order by t.total desc, t.name), '[]')
                  from (select * from pts where total > 0 order by total desc, name limit 10) t))));
end $$;

create or replace function public.save_loyalty_config(p_enabled boolean, p_ranking boolean, p_points jsonb, p_levels jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare clinic uuid := app.clinic_id();
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  insert into public.loyalty_config (clinic_id, enabled, ranking_enabled, points, levels)
  values (clinic, coalesce(p_enabled, false), coalesce(p_ranking, false), app.clean_points(coalesce(p_points, '{}')), app.clean_levels(p_levels))
  on conflict (clinic_id) do update set
    enabled = excluded.enabled, ranking_enabled = excluded.ranking_enabled,
    points = excluded.points, levels = excluded.levels, updated_at = now();
  if coalesce(p_enabled, false) then perform app.loyalty_seed(clinic); end if;
  if not coalesce(p_ranking, false) then
    delete from public.ranking_members where clinic_id = clinic;
  end if;
  perform app.log(clinic, 'gestor', auth.uid(), 'cadastro', null, 'Alterou o programa de fidelidade');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.save_badge(p_id uuid, p_name text, p_icon text, p_criteria text, p_threshold int, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  nm text := left(trim(coalesce(p_name, '')), 40);
  ic text := case when coalesce(p_icon, '') in ('Star','Trophy','Medal','Crown','Heart','Flame','Gift','Award','Sparkles','Gem') then p_icon else 'Star' end;
  cr text := coalesce(p_criteria, 'manual');
  th int := greatest(0, least(coalesce(p_threshold, 0), 100000));
  new_id uuid;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'reason', 'nome_vazio'); end if;
  if cr not in ('sessions_count', 'confirmed_count', 'points_total', 'streak', 'manual') then return jsonb_build_object('ok', false, 'reason', 'criterio_invalido'); end if;
  if cr <> 'manual' and th = 0 then return jsonb_build_object('ok', false, 'reason', 'limite_invalido'); end if;
  if p_id is null then
    if (select count(*) from public.badges where clinic_id = clinic) >= 30 then return jsonb_build_object('ok', false, 'reason', 'limite_de_selos'); end if;
    insert into public.badges (clinic_id, name, icon, criteria, threshold, active, position)
    values (clinic, nm, ic, cr, th, coalesce(p_active, true), coalesce((select max(position) from public.badges where clinic_id = clinic), 0) + 1)
    returning id into new_id;
  else
    update public.badges set name = nm, icon = ic, criteria = cr, threshold = th, active = coalesce(p_active, true)
     where id = p_id and clinic_id = clinic returning id into new_id;
    if new_id is null then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.delete_badge(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  delete from public.badges where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- entrega um selo "manual" (ex.: Embaixadora) a uma cliente
create or replace function public.grant_badge(p_badge uuid, p_client uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  b public.badges;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into b from public.badges where id = p_badge and clinic_id = clinic;
  if not found or not exists (select 1 from public.clients where id = p_client and clinic_id = clinic) then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;
  insert into public.client_badges (badge_id, client_id) values (b.id, p_client) on conflict do nothing;
  perform app.notify_client(clinic, p_client, 'reward', 'Novo selo: ' || b.name,
    'A clínica te deu o selo ' || b.name || '.', '/cliente/conquistas', 'badge:' || b.id);
  return jsonb_build_object('ok', true);
end $$;

-- ajuste manual de pontos (com motivo), registrado no histórico
create or replace function public.award_manual(p_client uuid, p_points int, p_note text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  note text := left(trim(coalesce(p_note, '')), 120);
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if coalesce(p_points, 0) = 0 or abs(p_points) > 1000 then return jsonb_build_object('ok', false, 'reason', 'pontos_invalidos'); end if;
  if not exists (select 1 from public.clients where id = p_client and clinic_id = clinic) then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;
  if not coalesce((select enabled from public.loyalty_config where clinic_id = clinic), false) then
    return jsonb_build_object('ok', false, 'reason', 'programa_desligado');
  end if;
  perform app.award(clinic, p_client, 'manual', p_points, null, 'manual:' || gen_random_uuid(), nullif(note, ''));
  perform app.log(clinic, 'gestor', auth.uid(), 'cadastro', p_client, 'Ajustou pontos de fidelidade: ' || p_points);
  return jsonb_build_object('ok', true);
end $$;

-- calcula os pontos do que já aconteceu (atendimentos finalizados e cadastros), sem duplicar
create or replace function public.loyalty_backfill() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  cfg public.loyalty_config;
  s record;
  before_ int;
  after_ int;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = clinic;
  if not found or not cfg.enabled then return jsonb_build_object('ok', false, 'reason', 'programa_desligado'); end if;
  before_ := (select count(*) from public.loyalty_ledger where clinic_id = clinic);
  for s in select id from public.sessions where clinic_id = clinic and status = 'done' order by finished_at, id loop
    perform app.award_session(s.id);
  end loop;
  for s in select p.clinic_id, p.client_id from public.profiles p where p.clinic_id = clinic and p.role = 'cliente' and p.client_id is not null loop
    perform app.award(clinic, s.client_id, 'signup', coalesce((cfg.points ->> 'signup')::int, 0), null, 'signup', 'cadastro');
  end loop;
  after_ := (select count(*) from public.loyalty_ledger where clinic_id = clinic);
  return jsonb_build_object('ok', true, 'created', after_ - before_);
end $$;

revoke all on function app.clean_levels(jsonb), app.clean_points(jsonb) from public, anon, authenticated;
revoke execute on function public.my_loyalty(), public.loyalty_ranking(), public.set_ranking_optin(boolean, text),
  public.loyalty_admin(), public.save_loyalty_config(boolean, boolean, jsonb, jsonb),
  public.save_badge(uuid, text, text, text, int, boolean), public.delete_badge(uuid), public.grant_badge(uuid, uuid),
  public.award_manual(uuid, int, text), public.loyalty_backfill() from public, anon;
grant execute on function public.my_loyalty(), public.loyalty_ranking(), public.set_ranking_optin(boolean, text),
  public.loyalty_admin(), public.save_loyalty_config(boolean, boolean, jsonb, jsonb),
  public.save_badge(uuid, text, text, text, int, boolean), public.delete_badge(uuid), public.grant_badge(uuid, uuid),
  public.award_manual(uuid, int, text), public.loyalty_backfill() to authenticated;
