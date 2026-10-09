-- Dados compartilhados entre pessoas: colunas de apoio, funções de servidor e tempo real.
-- Operações que mexem em várias tabelas (fechar atendimento) ou que a cliente faz sobre dados da clínica
-- (avisos, histórico) passam por funções SECURITY DEFINER que validam papel e permissão dentro da função.

alter table public.clients add column if not exists last_visit date;
alter table public.appointments add column if not exists client_name text not null default '';
alter table public.appointments add column if not exists session_no int;
alter table public.appointments add column if not exists sessions_total int;
alter table public.appointments add column if not exists alert text;
alter table public.sessions add column if not exists data jsonb not null default '{}';
alter table public.activity add column if not exists client_name text;

-- o registro de eventos guarda o nome da cliente (para a tela de histórico)
create or replace function app.log(p_clinic uuid, p_by text, p_actor uuid, p_kind text, p_client uuid, p_text text, p_sensitive boolean default false)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.activity (clinic_id, by_role, actor_id, kind, client_id, client_name, text, sensitive)
  values (p_clinic, p_by, p_actor, p_kind, p_client, (select name from public.clients where id = p_client), p_text, p_sensitive)
$$;

-- ---------------------------------------------------------------- avisos por função (o app não escreve em notifications)
create function public.push_notification(
  p_audience text, p_client_id uuid, p_kind text, p_title text, p_body text, p_href text, p_rule text, p_perm text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  perm text := case when p_perm in ('clientes', 'agenda', 'atendimentos', 'estoque', 'financeiro', 'historico', 'admin') then p_perm else 'agenda' end;
  rule text := coalesce(nullif(trim(p_rule), ''), gen_random_uuid()::text);
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if p_audience = 'cliente' then
    -- a cliente só avisa a si mesma; a equipe avisa qualquer cliente da própria clínica
    if p_client_id is null or (me.role = 'cliente' and me.client_id is distinct from p_client_id) then
      return jsonb_build_object('ok', false, 'reason', 'sem_permissao');
    end if;
    insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
    select me.clinic_id, pr.id, rule, p_kind, p_title, coalesce(p_body, ''), p_href
    from public.profiles pr where pr.clinic_id = me.clinic_id and pr.client_id = p_client_id and pr.active
    on conflict (recipient_id, rule_key) do nothing;
  elsif p_audience in ('gestor', 'equipe') then
    if perm = 'admin' then
      insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
      select me.clinic_id, id, rule, p_kind, p_title, coalesce(p_body, ''), p_href
      from public.profiles where clinic_id = me.clinic_id and active and role = 'gestor'
      on conflict (recipient_id, rule_key) do nothing;
    else
      perform app.notify_perm(me.clinic_id, perm, p_kind, p_title, coalesce(p_body, ''), p_href, rule);
    end if;
  else
    return jsonb_build_object('ok', false, 'reason', 'invalido');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.log_activity(p_kind text, p_client_id uuid, p_text text, p_sensitive boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or p_kind not in ('horario', 'pagamento', 'cadastro', 'atendimento', 'equipe') or coalesce(trim(p_text), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalido');
  end if;
  -- a cliente só registra o que ela mesma faz, sobre ela mesma
  if me.role = 'cliente' and (p_client_id is distinct from me.client_id or p_kind not in ('horario', 'pagamento')) then
    return jsonb_build_object('ok', false, 'reason', 'sem_permissao');
  end if;
  perform app.log(me.clinic_id, me.role, me.id, p_kind, p_client_id, left(p_text, 300), coalesce(p_sensitive, false) or p_kind = 'pagamento');
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- fechar atendimento (atômico)
create function public.complete_session(p_session_id uuid, p_cuidados jsonb, p_retorno jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_variable
declare
  me public.profiles;
  s public.sessions;
  c public.clients;
  d jsonb;
  item jsonb;
  names text[] := '{}';
  v_items jsonb := '[]';
  label text;
  can_fin boolean;
  total numeric(12, 2) := 0;
  cost numeric(12, 2) := 0;
  price numeric(12, 2);
  catalog numeric(12, 2);
  qty numeric(10, 2);
  unit_cost numeric(12, 2);
  st public.stock;
  new_qty numeric(10, 2);
  paid_now boolean;
  pay text;
  due date;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  now_time time := (now() at time zone 'America/Sao_Paulo')::time(0);
  appt uuid;
  auto_appt boolean := false;
  txt text;
  rdate date;
  rtime time;
  cares int := 0;
  clean_products jsonb := '[]';
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or not app.has_perm('atendimentos') then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into s from public.sessions where id = p_session_id and clinic_id = me.clinic_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  if s.status = 'done' then return jsonb_build_object('ok', true, 'already', true); end if;
  select * into c from public.clients where id = s.client_id;
  d := s.data;
  can_fin := app.has_perm('financeiro');

  -- procedimentos: quem não tem permissão financeira só usa o preço de tabela
  for item in select * from jsonb_array_elements(coalesce(d -> 'procedures', '[]')) loop
    names := names || (item ->> 'name');
    price := coalesce((item ->> 'price')::numeric, 0);
    if not can_fin then
      select p.price into catalog from public.procedures p where p.clinic_id = me.clinic_id and lower(p.name) = lower(item ->> 'name') limit 1;
      price := coalesce(catalog, 0);
    end if;
    total := total + price;
    v_items := v_items || jsonb_build_array(jsonb_build_object('name', item ->> 'name', 'price', price));
  end loop;
  label := coalesce(nullif(array_to_string(names, ' + '), ''), nullif(s.procedure, ''), 'Atendimento');

  -- produtos: baixa no estoque e custo
  for item in select * from jsonb_array_elements(coalesce(d -> 'products', '[]')) loop
    qty := coalesce((item ->> 'qty')::numeric, 0);
    continue when qty <= 0 or coalesce(item ->> 'stockId', '') = '';
    select * into st from public.stock where id = (item ->> 'stockId')::uuid and clinic_id = me.clinic_id for update;
    continue when not found;
    select coalesce(sc.cost, 0) into unit_cost from public.stock_costs sc where sc.stock_id = st.id;
    cost := cost + qty * coalesce(unit_cost, 0);
    new_qty := greatest(0, st.quantity - qty);
    update public.stock set quantity = new_qty where id = st.id;
    if st.quantity > st.min and new_qty <= st.min then
      perform app.notify_perm(me.clinic_id, 'estoque', 'stock', 'Estoque baixo',
        st.name || ' · ' || new_qty || ' ' || st.unit || ' (mínimo ' || st.min || ')', '/gestao?aba=estoque', 'stock:' || st.id || ':' || new_qty);
    end if;
    clean_products := clean_products || jsonb_build_array(jsonb_build_object('stockId', st.id, 'name', st.name, 'qty', qty));
  end loop;

  -- agenda: o horário vira realizado (ou nasce um, quando o atendimento foi aberto na hora)
  if s.appt_id is not null then
    update public.appointments set done = true, status = 'confirmed', procedure = label where id = s.appt_id and clinic_id = me.clinic_id;
    appt := s.appt_id;
  else
    insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status, kind, origin, done, created_by)
    values (me.clinic_id, s.client_id, c.name, label, today, now_time, 'confirmed', 'retorno', 'gestor', true, me.id)
    returning id into appt;
    auto_appt := true;
  end if;
  insert into public.appointment_finance (appt_id, clinic_id, price, payment)
  values (appt, me.clinic_id, total, coalesce(d ->> 'payment', 'Pix'))
  on conflict (appt_id) do update set price = excluded.price, payment = excluded.payment;

  -- caixa: sem permissão financeira, o valor fica "a receber" para a gestora conferir
  paid_now := can_fin and coalesce((d ->> 'paidNow')::boolean, true);
  pay := coalesce(nullif(d ->> 'payment', ''), 'Pix');
  due := coalesce(nullif(d ->> 'dueDate', '')::date, today + 7);
  if not can_fin then due := today; end if;
  if total > 0 then
    insert into public.ledger (clinic_id, kind, date, due, label, origin, method, value, client_id, ref_id, created_by)
    values (me.clinic_id, case when paid_now then 'entradas' else 'receber' end, today, case when paid_now then null else due end,
            c.name, label, pay, total, s.client_id, s.id, me.id);
  end if;
  insert into public.session_finance (session_id, clinic_id, items, paid_now, payment, due_date, cost_total)
  values (s.id, me.clinic_id, v_items, paid_now, pay, due, cost)
  on conflict (session_id) do update set items = excluded.items, paid_now = excluded.paid_now, payment = excluded.payment, due_date = excluded.due_date, cost_total = excluded.cost_total;
  if total > 0 and cost / total > 0.35 then
    perform app.notify_perm(me.clinic_id, 'financeiro', 'stock', 'Produtos pesaram no atendimento',
      split_part(c.name, ' ', 1) || ' · ' || label || ': ' || round(cost / total * 100) || '% do valor foi custo de produto', '/gestao', 'margin:' || s.id);
  end if;

  -- cuidados para a cliente (com lembrete diário quando o texto fala de manhã ou noite)
  for txt in select jsonb_array_elements_text(coalesce(p_cuidados, '[]')) loop
    continue when coalesce(trim(txt), '') = '';
    insert into public.care (clinic_id, client_id, text, reminder_time, until)
    values (me.clinic_id, s.client_id, left(txt, 500),
            case when txt ~* 'manh|protetor' then '08:00'::time when txt ~* 'noite|dormir' then '21:00'::time end,
            case when txt ~* 'manh|protetor|noite|dormir' then today + 30 end);
    cares := cares + 1;
  end loop;
  if cares > 0 then
    insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
    select me.clinic_id, pr.id, 'care:' || s.id, 'recommendation', 'Novos cuidados da sua clínica',
           cares || (case when cares = 1 then ' recomendação' else ' recomendações' end) || ' para você', '/cliente/evolucao'
    from public.profiles pr where pr.clinic_id = me.clinic_id and pr.client_id = s.client_id and pr.active
    on conflict (recipient_id, rule_key) do nothing;
  end if;

  -- retorno sugerido: fica aguardando a confirmação da cliente
  if p_retorno is not null and coalesce(p_retorno ->> 'data', '') <> '' then
    begin
      rdate := (p_retorno ->> 'data')::date;
      rtime := coalesce(nullif(p_retorno ->> 'hora', ''), '14:00')::time;
      insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status, kind, origin, created_by)
      values (me.clinic_id, s.client_id, c.name, label, rdate, rtime, 'pending', 'retorno', 'gestor', me.id);
      insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
      select me.clinic_id, pr.id, 'return:' || s.id, 'reminder', 'Retorno sugerido',
             label || ' · ' || to_char(rdate, 'DD/MM') || ' às ' || to_char(rtime, 'HH24:MI') || '. Confirme sua presença.', '/cliente/agenda'
      from public.profiles pr where pr.clinic_id = me.clinic_id and pr.client_id = s.client_id and pr.active
      on conflict (recipient_id, rule_key) do nothing;
    exception when unique_violation then
      null; -- horário do retorno já ocupado: o atendimento fecha mesmo assim
    end;
  end if;

  update public.clients set last_visit = today, main_procedure = coalesce(names[1], main_procedure) where id = s.client_id;
  update public.sessions set
    status = 'done', finished_at = now(), staff_id = me.id, procedure = label,
    appt_id = coalesce(s.appt_id, appt),
    -- depois de fechado, a parte clínica não guarda dinheiro: preços e pagamento ficam só em session_finance
    data = jsonb_build_object('procedures', (select coalesce(jsonb_agg(jsonb_build_object('name', n)), '[]') from unnest(names) n),
                              'products', clean_products, 'client', d -> 'client', 'initials', d -> 'initials', 'autoAppt', auto_appt)
  where id = s.id;
  perform app.log(me.clinic_id, me.role, me.id, 'atendimento', s.client_id, 'Atendimento finalizado: ' || label);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- corrigir atendimento finalizado
create function public.edit_finished_session(p_session_id uuid, p_procedures jsonb, p_notes jsonb, p_payment text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_variable
declare
  me public.profiles;
  s public.sessions;
  item jsonb;
  names text[] := '{}';
  v_items jsonb := '[]';
  total numeric(12, 2) := 0;
  price numeric(12, 2);
  label text;
  can_fin boolean;
  old_items jsonb;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or not app.has_perm('atendimentos') then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into s from public.sessions where id = p_session_id and clinic_id = me.clinic_id and status = 'done' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  can_fin := app.has_perm('financeiro');
  select sf.items into old_items from public.session_finance sf where sf.session_id = s.id;

  for item in select * from jsonb_array_elements(coalesce(p_procedures, '[]')) loop
    continue when coalesce(trim(item ->> 'name'), '') = '';
    names := names || trim(item ->> 'name');
    price := case when can_fin then coalesce((item ->> 'price')::numeric, 0)
                  else coalesce((select (o ->> 'price')::numeric from jsonb_array_elements(coalesce(old_items, '[]')) o where lower(o ->> 'name') = lower(trim(item ->> 'name')) limit 1), 0) end;
    total := total + price;
    v_items := v_items || jsonb_build_array(jsonb_build_object('name', trim(item ->> 'name'), 'price', price));
  end loop;
  label := coalesce(nullif(array_to_string(names, ' + '), ''), s.procedure);

  update public.sessions set procedure = label, notes = coalesce(p_notes, notes),
    data = jsonb_set(data, '{procedures}', (select coalesce(jsonb_agg(jsonb_build_object('name', n)), '[]') from unnest(names) n))
  where id = s.id;
  update public.appointments set procedure = label where id = s.appt_id and clinic_id = me.clinic_id;
  if can_fin then
    update public.session_finance set items = v_items, payment = coalesce(nullif(p_payment, ''), payment) where session_id = s.id;
    update public.ledger set origin = label, value = total, method = coalesce(nullif(p_payment, ''), method) where ref_id = s.id and clinic_id = me.clinic_id;
    update public.appointment_finance set price = total, payment = coalesce(nullif(p_payment, ''), payment) where appt_id = s.appt_id;
  else
    update public.ledger set origin = label where ref_id = s.id and clinic_id = me.clinic_id;
  end if;
  perform app.log(me.clinic_id, me.role, me.id, 'atendimento', s.client_id, 'Corrigiu o atendimento: ' || label);
  return jsonb_build_object('ok', true);
end $$;

create function public.delete_finished_session(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_variable
declare
  me public.profiles;
  s public.sessions;
  item jsonb;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or not app.has_perm('financeiro') then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into s from public.sessions where id = p_session_id and clinic_id = me.clinic_id and status = 'done' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  delete from public.ledger where ref_id = s.id and clinic_id = me.clinic_id;
  for item in select * from jsonb_array_elements(coalesce(s.data -> 'products', '[]')) loop
    update public.stock set quantity = quantity + coalesce((item ->> 'qty')::numeric, 0)
     where id = (item ->> 'stockId')::uuid and clinic_id = me.clinic_id;
  end loop;
  if coalesce((s.data ->> 'autoAppt')::boolean, false) then
    delete from public.appointments where id = s.appt_id and clinic_id = me.clinic_id;
  elsif s.appt_id is not null then
    update public.appointments set done = false where id = s.appt_id and clinic_id = me.clinic_id;
  end if;
  perform app.log(me.clinic_id, me.role, me.id, 'atendimento', s.client_id, 'Apagou o atendimento: ' || s.procedure);
  delete from public.sessions where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- mapa facial (marcações por cliente)
create table public.face_maps (
  client_id uuid primary key references public.clients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  marks jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.face_maps enable row level security;
grant select, insert, update, delete on public.face_maps to authenticated;
create policy face_maps_team on public.face_maps for all to authenticated
  using (clinic_id = app.clinic_id() and (app.has_perm('clientes') or app.has_perm('atendimentos')))
  with check (clinic_id = app.clinic_id() and (app.has_perm('clientes') or app.has_perm('atendimentos')));

-- a cliente vê o mapa dela sem as observações internas da esteticista
create function public.my_face_map() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select jsonb_agg(m - 'observacao')
    from public.face_maps f, jsonb_array_elements(f.marks) m
    where f.client_id = app.client_id() and f.clinic_id = app.clinic_id() and app.is_cliente()), '[]'::jsonb)
$$;

-- ---------------------------------------------------------------- cliente confirma presença no próprio horário
create function public.confirm_my_appointment(p_appt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  update public.appointments set status = 'confirmed', alert = null
   where id = p_appt_id and clinic_id = me.clinic_id and client_id = me.client_id and not done and status <> 'cancelled';
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- horários ocupados (sem expor quem marcou)
create function public.busy_times(p_from date, p_to date) returns table (day date, slot time)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.date, a.time from public.appointments a
  where a.clinic_id = app.clinic_id() and a.date between p_from and p_to and a.status <> 'cancelled' and not a.done
$$;

-- ---------------------------------------------------------------- execução
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_clinic_public(text) to anon, authenticated;
grant execute on function
  public.create_clinic(text, text, text, text, text, text),
  public.create_invite(text, text),
  public.create_staff_invite(text, text, jsonb),
  public.list_invites(),
  public.revoke_invite(uuid),
  public.accept_invite(text, text, text, text),
  public.accept_staff_invite(text, text),
  public.set_staff_active(uuid, boolean),
  public.set_staff_permissions(uuid, jsonb),
  public.update_my_profile(jsonb),
  public.update_my_name(text),
  public.report_payment(uuid, text),
  public.request_cancel(uuid),
  public.request_reschedule(uuid, date, time),
  public.push_notification(text, uuid, text, text, text, text, text, text),
  public.log_activity(text, uuid, text, boolean),
  public.complete_session(uuid, jsonb, jsonb),
  public.edit_finished_session(uuid, jsonb, jsonb, text),
  public.delete_finished_session(uuid),
  public.my_face_map(),
  public.confirm_my_appointment(uuid),
  public.busy_times(date, date)
to authenticated;

-- ---------------------------------------------------------------- tempo real (só existe no Supabase)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['clients', 'appointments', 'appointment_finance', 'sessions', 'ledger', 'bills', 'stock', 'stock_costs', 'care', 'procedures', 'anamnesis', 'blocks', 'clinic_config', 'notifications', 'activity', 'photos', 'face_maps', 'profiles'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;
