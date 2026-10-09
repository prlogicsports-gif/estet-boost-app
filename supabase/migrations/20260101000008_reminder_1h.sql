-- Lembrete 1 hora antes de cada atendimento (equipe já recebia; agora a cliente também).
-- Pode ser rodada mais de uma vez.

create or replace function app.run_reminders() returns int
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

  -- cliente: lembrete 1 hora antes do atendimento (uma vez por horário)
  for r in select id, clinic_id, client_id, procedure, time from public.appointments
           where date = today and status <> 'cancelled' and not done and not request
             and time >= nowt and time <= nowt + interval '60 minutes' loop
    perform app.notify_client(r.clinic_id, r.client_id, 'reminder', 'Seu atendimento é daqui a pouco',
      r.procedure || ' · às ' || to_char(r.time, 'HH24:MI') || ' (em cerca de 1 hora)', '/cliente/agenda', 'r1h:' || r.id);
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

revoke all on function app.run_reminders() from public, anon, authenticated;
