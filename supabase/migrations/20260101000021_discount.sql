-- Desconto no pagamento do atendimento (a gestora escolhe valor ou porcentagem ao finalizar).
-- O valor cobrado (caixa, a receber, agenda) já vai com o desconto; o bruto continua nos itens.
alter table public.session_finance
  add column if not exists discount_kind text check (discount_kind in ('valor', 'percent')),
  add column if not exists discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  add column if not exists discount numeric(12, 2) not null default 0 check (discount >= 0);

create or replace function public.complete_session(p_session_id uuid, p_cuidados jsonb, p_retorno jsonb) returns jsonb
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
  v_gross numeric(12, 2);
  v_disc numeric(12, 2) := 0;
  v_dkind text;
  v_dval numeric := 0;
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

  -- desconto (só quem tem permissão financeira): em valor ou em porcentagem, nunca acima do total
  v_gross := total;
  if can_fin and jsonb_typeof(d -> 'discount') = 'object' and coalesce(d -> 'discount' ->> 'value', '') ~ '^[0-9]+(\.[0-9]+)?$' then
    v_dkind := case when d -> 'discount' ->> 'kind' = 'percent' then 'percent' else 'valor' end;
    v_dval := (d -> 'discount' ->> 'value')::numeric;
    v_disc := case when v_dkind = 'percent' then round(v_gross * least(v_dval, 100) / 100, 2) else least(v_dval, v_gross) end;
    total := v_gross - v_disc;
  end if;

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
        st.name || ' · ' || new_qty || ' ' || st.unit || ' (mínimo ' || st.min || ')', '/gestao?aba=estoque', 'stock:' || st.id || ':' || trim_scale(new_qty));
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
  insert into public.session_finance (session_id, clinic_id, items, paid_now, payment, due_date, cost_total, discount_kind, discount_value, discount)
  values (s.id, me.clinic_id, v_items, paid_now, pay, due, cost, case when v_disc > 0 then v_dkind end, case when v_disc > 0 then v_dval else 0 end, v_disc)
  on conflict (session_id) do update set items = excluded.items, paid_now = excluded.paid_now, payment = excluded.payment, due_date = excluded.due_date, cost_total = excluded.cost_total,
    discount_kind = excluded.discount_kind, discount_value = excluded.discount_value, discount = excluded.discount;
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
  perform app.log(me.clinic_id, me.role, me.id, 'atendimento', s.client_id, 'Atendimento finalizado: ' || label || case when v_disc > 0 then ' (desconto aplicado)' else '' end);
  return jsonb_build_object('ok', true);
end $$;


-- ---------------------------------------------------------------- corrigir atendimento finalizado
create or replace function public.edit_finished_session(p_session_id uuid, p_procedures jsonb, p_notes jsonb, p_payment text) returns jsonb
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
  v_gross numeric(12, 2);
  v_disc numeric(12, 2) := 0;
  v_dkind text;
  v_dval numeric := 0;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or not app.has_perm('atendimentos') then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into s from public.sessions where id = p_session_id and clinic_id = me.clinic_id and status = 'done' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  can_fin := app.has_perm('financeiro');
  select sf.items, sf.discount_kind, coalesce(sf.discount_value, 0) into old_items, v_dkind, v_dval from public.session_finance sf where sf.session_id = s.id;

  for item in select * from jsonb_array_elements(coalesce(p_procedures, '[]')) loop
    continue when coalesce(trim(item ->> 'name'), '') = '';
    names := names || trim(item ->> 'name');
    price := case when can_fin then coalesce((item ->> 'price')::numeric, 0)
                  else coalesce((select (o ->> 'price')::numeric from jsonb_array_elements(coalesce(old_items, '[]')) o where lower(o ->> 'name') = lower(trim(item ->> 'name')) limit 1), 0) end;
    total := total + price;
    v_items := v_items || jsonb_build_array(jsonb_build_object('name', trim(item ->> 'name'), 'price', price));
  end loop;
  label := coalesce(nullif(array_to_string(names, ' + '), ''), s.procedure);

  -- o desconto que já existia acompanha o novo total (em % recalcula, em valor nunca passa do total)
  v_gross := total;
  if v_dkind is not null and v_dval > 0 then
    v_disc := case when v_dkind = 'percent' then round(v_gross * least(v_dval, 100) / 100, 2) else least(v_dval, v_gross) end;
    total := v_gross - v_disc;
  end if;

  update public.sessions set procedure = label, notes = coalesce(p_notes, notes),
    data = jsonb_set(data, '{procedures}', (select coalesce(jsonb_agg(jsonb_build_object('name', n)), '[]') from unnest(names) n))
  where id = s.id;
  update public.appointments set procedure = label where id = s.appt_id and clinic_id = me.clinic_id;
  if can_fin then
    update public.session_finance set items = v_items, discount = v_disc, payment = coalesce(nullif(p_payment, ''), payment) where session_id = s.id;
    update public.ledger set origin = label, value = total, method = coalesce(nullif(p_payment, ''), method) where ref_id = s.id and clinic_id = me.clinic_id;
    update public.appointment_finance set price = total, payment = coalesce(nullif(p_payment, ''), payment) where appt_id = s.appt_id;
  else
    update public.ledger set origin = label where ref_id = s.id and clinic_id = me.clinic_id;
  end if;
  perform app.log(me.clinic_id, me.role, me.id, 'atendimento', s.client_id, 'Corrigiu o atendimento: ' || label);
  return jsonb_build_object('ok', true);
end $$;

