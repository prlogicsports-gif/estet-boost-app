-- Avisos que não dependem do app aberto:
-- 1) cada aviso novo dispara o envio de push pela Edge Function `send-push` (Firebase Cloud Messaging);
-- 2) os lembretes (horários, contas, estoque, validade, cuidados) rodam sozinhos no servidor a cada 5 minutos.
-- As regras e os textos são os mesmos de src/services/notification-events.ts.

do $$ begin create extension if not exists pg_net; exception when others then null; end $$;
do $$ begin create extension if not exists pg_cron; exception when others then null; end $$;

-- ---------------------------------------------------------------- envio de push a cada aviso novo
create function app.push_on_notification() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from app.secrets where name = 'push_url';
  select value into v_secret from app.secrets where name = 'push_secret';
  if v_url is null or v_secret is null then return new; end if; -- push ainda não configurado
  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      body := jsonb_build_object('id', new.id));
  exception when others then
    null; -- o aviso entra no app mesmo se o envio do push falhar
  end;
  return new;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function app.push_on_notification();

-- ---------------------------------------------------------------- lembretes agendados
create function app.due_text(d int) returns text language sql immutable as $$
  select case when d = 0 then 'vence hoje' when d = 1 then 'vence amanhã' else 'vence em ' || d || ' dias' end
$$;

create function app.money(v numeric) returns text language sql immutable as $$
  select 'R$ ' || replace(to_char(round(v), 'FM999,999,999,999'), ',', '.')
$$;

create function app.notify_client(p_clinic uuid, p_client uuid, p_kind text, p_title text, p_body text, p_href text, p_rule text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
  select p_clinic, id, p_rule, p_kind, p_title, p_body, p_href
  from public.profiles where clinic_id = p_clinic and client_id = p_client and active
  on conflict (recipient_id, rule_key) do nothing
$$;

create function app.run_reminders() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  nowt time := (now() at time zone 'America/Sao_Paulo')::time;
  r record;
  n int := 0;
  days int;
  mins int;
begin
  -- equipe: horário de hoje sem confirmação
  for r in select id, clinic_id, client_name, procedure, time from public.appointments
           where date = today and status = 'pending' and not request and not done loop
    perform app.notify_perm(r.clinic_id, 'agenda', 'reminder', split_part(r.client_name, ' ', 1) || ' ainda não confirmou',
      r.procedure || ' · hoje ' || to_char(r.time, 'HH24:MI'), '/atendimentos/' || r.id, 'unconf:' || r.id || ':' || today);
    n := n + 1;
  end loop;

  -- equipe: próximo atendimento em até 60 minutos
  for r in select id, clinic_id, client_name, procedure, time from public.appointments
           where date = today and status <> 'cancelled' and not done and time >= nowt and time <= nowt + interval '60 minutes' loop
    mins := floor(extract(epoch from (r.time - nowt)) / 60);
    perform app.notify_perm(r.clinic_id, 'agenda', 'reminder', 'Próximo atendimento em ' || mins || ' min',
      r.client_name || ' · ' || r.procedure, '/atendimentos/' || r.id, 'soon:' || r.id);
    n := n + 1;
  end loop;

  -- cliente: atendimento amanhã e hoje
  for r in select id, clinic_id, client_id, procedure, time, date from public.appointments
           where date in (today, today + 1) and status <> 'cancelled' and not done loop
    if r.date = today then
      perform app.notify_client(r.clinic_id, r.client_id, 'reminder', 'Seu atendimento é hoje', r.procedure || ' · às ' || to_char(r.time, 'HH24:MI'), '/cliente/agenda', 'r0:' || r.id);
    else
      perform app.notify_client(r.clinic_id, r.client_id, 'reminder', 'Seu atendimento é amanhã', r.procedure || ' · ' || to_char(r.time, 'HH24:MI'), '/cliente/agenda', 'r24:' || r.id);
    end if;
    n := n + 1;
  end loop;

  -- financeiro: contas a pagar (3 dias antes até o vencimento) e atrasadas
  for r in select id, clinic_id, name, value, due, recurrence from public.bills where not paid and due <= today + 3 loop
    days := r.due - today;
    if days >= 0 then
      perform app.notify_perm(r.clinic_id, 'financeiro', 'bill', r.name || ' ' || app.due_text(days),
        app.money(r.value) || ' · ' || lower(r.recurrence), '/gestao?aba=contas', 'bill:' || r.id || ':' || today);
    else
      perform app.notify_perm(r.clinic_id, 'financeiro', 'bill', r.name || ' está atrasada',
        app.money(r.value) || ' · venceu há ' || (-days) || case when -days = 1 then ' dia' else ' dias' end, '/gestao?aba=contas', 'bill-late:' || r.id || ':' || today);
    end if;
    n := n + 1;
  end loop;

  -- cobranças a receber (equipe e cliente), de 3 dias antes até o vencimento
  for r in select l.id, l.clinic_id, l.client_id, l.label, l.origin, l.value, coalesce(l.due, l.date) as due
           from public.ledger l where l.kind = 'receber' and l.reported is null and coalesce(l.due, l.date) between today and today + 3 loop
    days := r.due - today;
    perform app.notify_perm(r.clinic_id, 'financeiro', 'bill', 'Cobrança de ' || split_part(r.label, ' ', 1) || ' ' || app.due_text(days),
      app.money(r.value) || ' · ' || r.origin, '/gestao?aba=receber', 'recv:' || r.id || ':' || today);
    if r.client_id is not null then
      perform app.notify_client(r.clinic_id, r.client_id, 'bill', 'Pagamento ' || app.due_text(days), app.money(r.value) || ' · ' || r.origin, '/cliente', 'crecv:' || r.id || ':' || today);
    end if;
    n := n + 1;
  end loop;

  -- estoque: baixo, perto de vencer e vencido
  for r in select id, clinic_id, name, quantity, unit, min, expiry from public.stock loop
    if r.quantity <= r.min then
      perform app.notify_perm(r.clinic_id, 'estoque', 'stock', 'Estoque baixo',
        r.name || ' · ' || trim_scale(r.quantity) || ' ' || r.unit || ' (mínimo ' || trim_scale(r.min) || ')', '/gestao?aba=estoque', 'stock:' || r.id || ':' || trim_scale(r.quantity));
      n := n + 1;
    end if;
    if r.expiry is not null then
      days := r.expiry - today;
      if days < 0 then
        perform app.notify_perm(r.clinic_id, 'estoque', 'stock', r.name || ' está vencido', trim_scale(r.quantity) || ' ' || r.unit || ' não devem ser usados', '/gestao?aba=estoque', 'expired:' || r.id || ':' || r.expiry);
        n := n + 1;
      elsif days <= 30 then
        perform app.notify_perm(r.clinic_id, 'estoque', 'stock', r.name || ' ' || app.due_text(days), 'Validade de ' || trim_scale(r.quantity) || ' ' || r.unit || ' · use primeiro', '/gestao?aba=estoque', 'expiring:' || r.id || ':' || r.expiry);
        n := n + 1;
      end if;
    end if;
  end loop;

  -- equipe: cliente no período de retorno (uma vez por cliente parada)
  for r in select id, clinic_id, name, last_visit from public.clients where last_visit is not null and today - last_visit >= 60 loop
    perform app.notify_perm(r.clinic_id, 'clientes', 'followup', 'Cliente no período de retorno',
      r.name || ' · há ' || (today - r.last_visit) || ' dias sem atendimento', '/clientes/' || r.id, 'cold:' || r.id);
    n := n + 1;
  end loop;

  -- cliente: lembrete diário dos cuidados, no horário combinado
  for r in select id, clinic_id, client_id, text, reminder_time from public.care
           where reminder_time is not null and (until is null or until >= today) and nowt >= reminder_time loop
    perform app.notify_client(r.clinic_id, r.client_id, 'recommendation', 'Lembrete das ' || to_char(r.reminder_time, 'HH24:MI'),
      trim(split_part(r.text, '.', 1)), '/cliente/evolucao', 'care:' || r.id || ':' || today);
    n := n + 1;
  end loop;

  return n;
end $$;

revoke all on function app.push_on_notification(), app.due_text(int), app.money(numeric),
  app.notify_client(uuid, uuid, text, text, text, text, text), app.run_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------- agendador (só existe no Supabase com pg_cron ligado)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('eb-reminders');
    exception when others then null;
    end;
    perform cron.schedule('eb-reminders', '*/5 * * * *', 'select app.run_reminders()');
  end if;
end $$;
