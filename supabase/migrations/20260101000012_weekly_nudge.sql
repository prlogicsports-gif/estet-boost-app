-- Aviso semanal para todas as clientes: convida a abrir o app e marcar (ou lembra o próximo horário).
-- Sai nas segundas-feiras a partir das 10h (horário de Brasília), uma vez por semana por cliente.
-- Base para a futura gamificação (a chave 'weekly:AAAA-SS' identifica a semana). Pode ser rodada mais de uma vez.

create or replace function app.weekly_nudge(p_force boolean default false) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lt timestamp := now() at time zone 'America/Sao_Paulo';
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  wk text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
  v int := (extract(week from now() at time zone 'America/Sao_Paulo')::int) % 5;
  titles text[] := array[
    'Que tal cuidar de você esta semana?',
    'Sua pele agradece',
    'Semana nova, pele nova',
    'Seu momento de autocuidado',
    'Já pensou no seu próximo atendimento?'];
  bodies text[] := array[
    'Veja os horários disponíveis e solicite o seu em poucos toques.',
    'Reserve um horário e mantenha a sua rotina de cuidados em dia.',
    'Escolha o melhor dia para o seu atendimento direto no app.',
    'Marque o seu próximo atendimento em poucos toques.',
    'Veja a agenda e peça o seu horário pelo app.'];
  n int;
begin
  if not p_force and not (extract(isodow from lt) = 1 and lt::time >= time '10:00') then return 0; end if;
  with ins as (
    insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
    select p.clinic_id, p.id, 'weekly:' || wk, 'followup',
      case when nx.d is null then titles[v + 1] else 'Sua semana de cuidado' end,
      case when nx.d is null then bodies[v + 1]
           else 'Seu próximo atendimento é ' || to_char(nx.d, 'DD/MM') || ' às ' || to_char(nx.t, 'HH24:MI') || '. Abra o app e confira seus cuidados.' end,
      case when nx.d is null then '/cliente/agenda' else '/cliente' end
    from public.profiles p
    left join lateral (
      select a.date as d, a.time as t from public.appointments a
       where a.client_id = p.client_id and a.status <> 'cancelled' and not a.done and a.date >= today
       order by a.date, a.time limit 1) nx on true
    where p.role = 'cliente' and p.active
    on conflict (recipient_id, rule_key) do nothing
    returning 1)
  select count(*) into n from ins;
  return n;
end $$;

revoke all on function app.weekly_nudge(boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('eb-weekly');
    exception when others then null;
    end;
    perform cron.schedule('eb-weekly', '*/15 * * * *', 'select app.weekly_nudge()');
  end if;
end $$;
