-- Prêmios e resgate: a gestora cria os prêmios (custo em pontos); a cliente pede o resgate no app e a gestora
-- aprova, recusa e marca como entregue. Os pontos só saem do saldo quando a gestora aprova. Pode ser rodada mais de uma vez.

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  cost int not null check (cost > 0 and cost <= 1000000),
  valid_until date,
  quantity int check (quantity is null or quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  reward_name text not null,
  cost int not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'entregue', 'cancelado')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create unique index if not exists redemptions_one_pending on public.redemptions (client_id, reward_id) where status = 'pendente';
create index if not exists redemptions_clinic on public.redemptions (clinic_id, status, requested_at desc);

alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
grant select on public.rewards, public.redemptions to authenticated;
drop policy if exists rewards_gestor on public.rewards;
create policy rewards_gestor on public.rewards for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());
drop policy if exists redemptions_gestor on public.redemptions;
create policy redemptions_gestor on public.redemptions for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());

-- saldo que ainda pode ser gasto: saldo menos o que está em pedidos pendentes
create or replace function app.loyalty_available(p_client uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select app.loyalty_balance(p_client) - coalesce((select sum(cost) from public.redemptions where client_id = p_client and status = 'pendente'), 0)::int
$$;
revoke all on function app.loyalty_available(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- cliente
create or replace function public.my_rewards() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  avail int;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('enabled', false); end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled then return jsonb_build_object('enabled', false); end if;
  avail := app.loyalty_available(me.client_id);
  return jsonb_build_object(
    'enabled', true,
    'available', avail,
    'rewards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'description', r.description, 'cost', r.cost, 'valid_until', r.valid_until,
        'remaining', case when r.quantity is null then null
                          else greatest(0, r.quantity - (select count(*) from public.redemptions x where x.reward_id = r.id and x.status in ('pendente', 'aprovado', 'entregue'))) end,
        'pending', exists (select 1 from public.redemptions x where x.reward_id = r.id and x.client_id = me.client_id and x.status = 'pendente'),
        'can_redeem', avail >= r.cost) order by r.cost, r.name), '[]')
        from public.rewards r
       where r.clinic_id = me.clinic_id and r.active
         and (r.valid_until is null or r.valid_until >= (now() at time zone 'America/Sao_Paulo')::date)
         and (r.quantity is null or r.quantity > (select count(*) from public.redemptions x where x.reward_id = r.id and x.status in ('pendente', 'aprovado', 'entregue')))),
    'requests', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'reward', x.reward_name, 'cost', x.cost, 'status', x.status, 'at', x.requested_at)
               order by x.requested_at desc), '[]')
        from (select * from public.redemptions where client_id = me.client_id order by requested_at desc limit 20) x));
end $$;

create or replace function public.request_redeem(p_reward uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  r public.rewards;
  c public.clients;
  new_id uuid;
  used int;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled then return jsonb_build_object('ok', false, 'reason', 'programa_desligado'); end if;
  select * into r from public.rewards where id = p_reward and clinic_id = me.clinic_id and active for update;
  if not found or (r.valid_until is not null and r.valid_until < (now() at time zone 'America/Sao_Paulo')::date) then
    return jsonb_build_object('ok', false, 'reason', 'premio_indisponivel');
  end if;
  if r.quantity is not null then
    select count(*) into used from public.redemptions where reward_id = r.id and status in ('pendente', 'aprovado', 'entregue');
    if used >= r.quantity then return jsonb_build_object('ok', false, 'reason', 'premio_esgotado'); end if;
  end if;
  if app.loyalty_available(me.client_id) < r.cost then return jsonb_build_object('ok', false, 'reason', 'pontos_insuficientes'); end if;
  begin
    insert into public.redemptions (clinic_id, client_id, reward_id, reward_name, cost)
    values (me.clinic_id, me.client_id, r.id, r.name, r.cost) returning id into new_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'ja_pedido');
  end;
  select * into c from public.clients where id = me.client_id;
  perform app.notify_clinic(me.clinic_id, array['gestor'], 'redeem', 'Pedido de resgate',
    split_part(c.name, ' ', 1) || ' quer resgatar ' || r.name || ' (' || r.cost || ' pontos)',
    '/fidelidade?aba=premios', 'redeem:' || new_id);
  perform app.log(me.clinic_id, 'cliente', me.id, 'cadastro', me.client_id, 'Pediu o resgate de ' || r.name);
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.cancel_my_redeem(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  update public.redemptions set status = 'cancelado', decided_at = now()
   where id = p_id and client_id = me.client_id and status = 'pendente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- gestora
create or replace function public.rewards_admin() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare clinic uuid := app.clinic_id();
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  return jsonb_build_object(
    'ok', true,
    'rewards', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'name', r.name, 'description', r.description, 'cost', r.cost,
                  'valid_until', r.valid_until, 'quantity', r.quantity, 'active', r.active,
                  'used', (select count(*) from public.redemptions x where x.reward_id = r.id and x.status in ('pendente', 'aprovado', 'entregue')))
                order by r.cost, r.name), '[]')
                  from public.rewards r where r.clinic_id = clinic),
    'redemptions', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', x.id, 'client_id', x.client_id, 'client', c.name, 'reward', x.reward_name, 'cost', x.cost,
                  'status', x.status, 'at', x.requested_at, 'decided_at', x.decided_at,
                  'balance', app.loyalty_balance(x.client_id))
                order by (x.status = 'pendente') desc, x.requested_at desc), '[]')
                  from (select * from public.redemptions where clinic_id = clinic order by (status = 'pendente') desc, requested_at desc limit 60) x
                  join public.clients c on c.id = x.client_id));
end $$;

create or replace function public.save_reward(
  p_id uuid, p_name text, p_description text, p_cost int, p_valid_until date, p_quantity int, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  nm text := left(trim(coalesce(p_name, '')), 60);
  new_id uuid;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'reason', 'nome_vazio'); end if;
  if coalesce(p_cost, 0) <= 0 or p_cost > 1000000 then return jsonb_build_object('ok', false, 'reason', 'custo_invalido'); end if;
  if p_quantity is not null and p_quantity < 0 then return jsonb_build_object('ok', false, 'reason', 'quantidade_invalida'); end if;
  if p_id is null then
    if (select count(*) from public.rewards where clinic_id = clinic) >= 50 then return jsonb_build_object('ok', false, 'reason', 'limite_de_premios'); end if;
    insert into public.rewards (clinic_id, name, description, cost, valid_until, quantity, active)
    values (clinic, nm, left(trim(coalesce(p_description, '')), 240), p_cost, p_valid_until, p_quantity, coalesce(p_active, true))
    returning id into new_id;
  else
    update public.rewards set name = nm, description = left(trim(coalesce(p_description, '')), 240), cost = p_cost,
           valid_until = p_valid_until, quantity = p_quantity, active = coalesce(p_active, true)
     where id = p_id and clinic_id = clinic returning id into new_id;
    if new_id is null then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.delete_reward(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if exists (select 1 from public.redemptions where reward_id = p_id and status in ('pendente', 'aprovado')) then
    return jsonb_build_object('ok', false, 'reason', 'tem_pedidos_abertos');
  end if;
  delete from public.rewards where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- aprovar (tira os pontos), recusar, marcar como entregue ou cancelar um aprovado (devolve os pontos)
create or replace function public.decide_redeem(p_id uuid, p_decision text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  x public.redemptions;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into x from public.redemptions where id = p_id and clinic_id = clinic for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;

  if p_decision = 'aprovar' and x.status = 'pendente' then
    if app.loyalty_balance(x.client_id) < x.cost then return jsonb_build_object('ok', false, 'reason', 'pontos_insuficientes'); end if;
    insert into public.loyalty_ledger (clinic_id, client_id, event, points, ref_id, idem_key, note)
    values (clinic, x.client_id, 'redeem', -x.cost, x.id, 'redeem:' || x.id, 'resgate: ' || x.reward_name)
    on conflict (client_id, idem_key) do nothing;
    update public.redemptions set status = 'aprovado', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Resgate aprovado',
      x.reward_name || ' foi aprovado. Combine a entrega com a clínica.', '/cliente/conquistas', 'redeem-ok:' || x.id);
  elsif p_decision = 'recusar' and x.status = 'pendente' then
    update public.redemptions set status = 'recusado', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Resgate não aprovado',
      'Seu pedido de ' || x.reward_name || ' não foi aprovado. Seus pontos continuam com você.', '/cliente/conquistas', 'redeem-no:' || x.id);
  elsif p_decision = 'entregar' and x.status = 'aprovado' then
    update public.redemptions set status = 'entregue', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Prêmio entregue',
      x.reward_name || ' foi entregue. Aproveite!', '/cliente/conquistas', 'redeem-done:' || x.id);
  elsif p_decision = 'cancelar' and x.status = 'aprovado' then
    delete from public.loyalty_ledger where client_id = x.client_id and idem_key = 'redeem:' || x.id;
    update public.redemptions set status = 'cancelado', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Resgate cancelado',
      'O resgate de ' || x.reward_name || ' foi cancelado e seus pontos voltaram.', '/cliente/conquistas', 'redeem-cancel:' || x.id);
  else
    return jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  end if;
  perform app.log(clinic, 'gestor', auth.uid(), 'cadastro', x.client_id, 'Resgate ' || p_decision || ': ' || x.reward_name);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.my_rewards(), public.request_redeem(uuid), public.cancel_my_redeem(uuid),
  public.rewards_admin(), public.save_reward(uuid, text, text, int, date, int, boolean), public.delete_reward(uuid),
  public.decide_redeem(uuid, text) from public, anon;
grant execute on function public.my_rewards(), public.request_redeem(uuid), public.cancel_my_redeem(uuid),
  public.rewards_admin(), public.save_reward(uuid, text, text, int, date, int, boolean), public.delete_reward(uuid),
  public.decide_redeem(uuid, text) to authenticated;
