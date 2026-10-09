-- Permissões da equipe: a gestora escolhe o que cada funcionária pode acessar.
-- Chaves: clientes, agenda, atendimentos, estoque, financeiro, historico.
-- A gestora tem tudo; cliente nunca tem permissões de equipe. Administração (equipe, credenciais,
-- configurações da clínica, preços de procedimentos) continua só da gestora.

alter table public.profiles add column permissions jsonb not null default '{}';
alter table public.invites add column permissions jsonb not null default '{}';

-- ---------------------------------------------------------------- auxiliares
create function app.clean_perms(p jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'clientes',    coalesce((p -> 'clientes') = 'true'::jsonb, false),
    'agenda',      coalesce((p -> 'agenda') = 'true'::jsonb, false),
    'atendimentos',coalesce((p -> 'atendimentos') = 'true'::jsonb, false),
    'estoque',     coalesce((p -> 'estoque') = 'true'::jsonb, false),
    'financeiro',  coalesce((p -> 'financeiro') = 'true'::jsonb, false),
    'historico',   coalesce((p -> 'historico') = 'true'::jsonb, false))
$$;

create function app.has_perm(p text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case role
      when 'gestor' then true
      when 'funcionario' then coalesce((permissions ->> p)::boolean, false)
      else false end
    from public.profiles where id = auth.uid() and active), false)
$$;

grant execute on function app.has_perm(text) to authenticated;
revoke all on function app.clean_perms(jsonb) from public, anon, authenticated;

-- avisa a gestora e as funcionárias que têm a permissão informada
create function app.notify_perm(p_clinic uuid, p_perm text, p_kind text, p_title text, p_body text, p_href text, p_rule text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
  select p_clinic, id, coalesce(p_rule, gen_random_uuid()::text), p_kind, p_title, p_body, p_href
  from public.profiles
  where clinic_id = p_clinic and active
    and (role = 'gestor' or (role = 'funcionario' and coalesce((permissions ->> p_perm)::boolean, false)))
  on conflict (recipient_id, rule_key) do nothing
$$;
revoke all on function app.notify_perm(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- políticas por permissão
-- clientes: ler com clientes/agenda/atendimentos (a agenda e o atendimento mostram nomes); escrever só com clientes
drop policy clients_team on public.clients;
create policy clients_team_read on public.clients for select to authenticated
  using (clinic_id = app.clinic_id() and (app.has_perm('clientes') or app.has_perm('agenda') or app.has_perm('atendimentos')));
create policy clients_team_insert on public.clients for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.has_perm('clientes'));
create policy clients_team_update on public.clients for update to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('clientes')) with check (clinic_id = app.clinic_id() and app.has_perm('clientes'));
create policy clients_team_delete on public.clients for delete to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('clientes'));

drop policy anamnesis_team on public.anamnesis;
create policy anamnesis_team on public.anamnesis for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('clientes')) with check (clinic_id = app.clinic_id() and app.has_perm('clientes'));

drop policy care_team on public.care;
create policy care_team on public.care for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('clientes')) with check (clinic_id = app.clinic_id() and app.has_perm('clientes'));

drop policy photos_team on public.photos;
create policy photos_team on public.photos for all to authenticated
  using (clinic_id = app.clinic_id() and (app.has_perm('clientes') or app.has_perm('atendimentos')))
  with check (clinic_id = app.clinic_id() and (app.has_perm('clientes') or app.has_perm('atendimentos')));

-- agenda: ler com agenda/atendimentos; escrever com agenda
drop policy appt_team on public.appointments;
create policy appt_team_read on public.appointments for select to authenticated
  using (clinic_id = app.clinic_id() and (app.has_perm('agenda') or app.has_perm('atendimentos')));
create policy appt_team_insert on public.appointments for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.has_perm('agenda'));
create policy appt_team_update on public.appointments for update to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('agenda')) with check (clinic_id = app.clinic_id() and app.has_perm('agenda'));
create policy appt_team_delete on public.appointments for delete to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('agenda'));

-- atendimentos (rascunho)
drop policy sessions_read on public.sessions;
drop policy sessions_insert on public.sessions;
drop policy sessions_update on public.sessions;
drop policy sessions_delete on public.sessions;
create policy sessions_read on public.sessions for select to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos'));
create policy sessions_insert on public.sessions for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and status = 'draft');
create policy sessions_update on public.sessions for update to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and status = 'draft')
  with check (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and status = 'draft');
create policy sessions_delete on public.sessions for delete to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and status = 'draft');

drop policy sproc_read on public.session_procedures;
drop policy sproc_write on public.session_procedures;
create policy sproc_read on public.session_procedures for select to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos'));
create policy sproc_write on public.session_procedures for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'))
  with check (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'));

drop policy sprod_read on public.session_products;
drop policy sprod_write on public.session_products;
create policy sprod_read on public.session_products for select to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos'));
create policy sprod_write on public.session_products for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'))
  with check (clinic_id = app.clinic_id() and app.has_perm('atendimentos') and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'));

-- estoque: ler com estoque/atendimentos; escrever com estoque
drop policy stock_team on public.stock;
create policy stock_team_read on public.stock for select to authenticated
  using (clinic_id = app.clinic_id() and (app.has_perm('estoque') or app.has_perm('atendimentos')));
create policy stock_team_write on public.stock for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('estoque')) with check (clinic_id = app.clinic_id() and app.has_perm('estoque'));

-- financeiro: gestora, ou funcionária com a permissão "financeiro"
drop policy stock_costs_gestor on public.stock_costs;
drop policy bills_gestor on public.bills;
drop policy sfin_gestor on public.session_finance;
drop policy afin_gestor on public.appointment_finance;
drop policy ledger_gestor on public.ledger;
create policy stock_costs_fin on public.stock_costs for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('financeiro')) with check (clinic_id = app.clinic_id() and app.has_perm('financeiro'));
create policy bills_fin on public.bills for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('financeiro')) with check (clinic_id = app.clinic_id() and app.has_perm('financeiro'));
create policy sfin_fin on public.session_finance for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('financeiro')) with check (clinic_id = app.clinic_id() and app.has_perm('financeiro'));
create policy afin_fin on public.appointment_finance for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('financeiro')) with check (clinic_id = app.clinic_id() and app.has_perm('financeiro'));
create policy ledger_fin on public.ledger for all to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('financeiro')) with check (clinic_id = app.clinic_id() and app.has_perm('financeiro'));

-- histórico de eventos: gestora, ou funcionária com "historico" (eventos financeiros só com "financeiro")
drop policy activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated
  using (clinic_id = app.clinic_id() and app.has_perm('historico') and (not sensitive or app.has_perm('financeiro')));

-- ---------------------------------------------------------------- credencial de equipe com permissões
drop function public.create_staff_invite(text, text);
create function public.create_staff_invite(p_name text, p_email text, p_permissions jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  mail text := lower(trim(coalesce(p_email, '')));
  code text;
  exp timestamptz := now() + interval '48 hours';
begin
  if app.role() is distinct from 'gestor' then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'reason', 'email_invalido'); end if;
  cid := app.clinic_id();
  update public.invites set revoked = true
   where clinic_id = cid and role = 'funcionario' and lower(email_hint) = mail and used_at is null and not revoked;
  code := app.new_code();
  insert into public.invites (code_hash, clinic_id, role, name_hint, email_hint, expires_at, created_by, permissions)
  values (app.hash_code(code), cid, 'funcionario', nullif(trim(p_name), ''), mail, exp, uid, app.clean_perms(coalesce(p_permissions, '{}')));
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', exp);
end $$;

create or replace function public.accept_staff_invite(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  mail text;
  confirmed timestamptz;
  recent int;
  inv public.invites;
  display text := coalesce(nullif(trim(p_name), ''), 'Profissional');
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  if exists (select 1 from public.profiles where id = uid) then return jsonb_build_object('ok', true, 'already', true); end if;
  select email, email_confirmed_at into mail, confirmed from auth.users where id = uid;
  if confirmed is null then return jsonb_build_object('ok', false, 'reason', 'email_nao_confirmado'); end if;

  select count(*) into recent from public.invite_attempts where user_id = uid and at > now() - interval '1 hour' and not ok;
  if recent >= 5 then return jsonb_build_object('ok', false, 'reason', 'bloqueado'); end if;

  select * into inv from public.invites where code_hash = app.hash_code(coalesce(p_code, '')) and role = 'funcionario' for update;
  if not found or inv.revoked or inv.used_at is not null or inv.expires_at < now() or lower(inv.email_hint) <> lower(mail) then
    insert into public.invite_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('ok', false, 'reason', 'invalido');
  end if;

  insert into public.profiles (id, clinic_id, role, name, email, terms_accepted_at, terms_version, permissions)
  values (uid, inv.clinic_id, 'funcionario', display, lower(mail), now(), 'v1', app.clean_perms(inv.permissions));
  update public.invites set used_at = now(), used_by = uid where id = inv.id;
  insert into public.invite_attempts (user_id, ok) values (uid, true);

  perform app.notify_clinic(inv.clinic_id, array['gestor'], 'followup', 'Nova profissional na equipe', display || ' entrou na clínica', '/configuracoes', 'staff:' || uid);
  perform app.log(inv.clinic_id, 'funcionario', uid, 'equipe', null, display || ' entrou na equipe');
  return jsonb_build_object('ok', true, 'clinic_id', inv.clinic_id);
end $$;

create function public.set_staff_permissions(p_staff_id uuid, p_permissions jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.profiles;
begin
  if app.role() is distinct from 'gestor' then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into target from public.profiles where id = p_staff_id and clinic_id = app.clinic_id() and role = 'funcionario';
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrada'); end if;
  update public.profiles set permissions = app.clean_perms(coalesce(p_permissions, '{}')) where id = p_staff_id;
  perform app.log(target.clinic_id, 'gestor', auth.uid(), 'equipe', null, 'Alterou as permissões de ' || target.name);
  return jsonb_build_object('ok', true);
end $$;

-- a lista de credenciais agora mostra as permissões
drop function public.list_invites();
create function public.list_invites() returns table (id uuid, role text, name_hint text, phone_hint text, email_hint text, permissions jsonb, expires_at timestamptz, used_at timestamptz, revoked boolean, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.id, i.role, i.name_hint, i.phone_hint, i.email_hint, i.permissions, i.expires_at, i.used_at, i.revoked, i.created_at
  from public.invites i
  where app.role() = 'gestor' and i.clinic_id = app.clinic_id()
  order by i.created_at desc
$$;

-- ---------------------------------------------------------------- avisos respeitam permissões
create or replace function public.accept_invite(p_code text, p_slug text, p_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  mail text;
  confirmed timestamptz;
  recent int;
  inv public.invites;
  cid uuid;
  clid uuid;
  display text := coalesce(nullif(trim(p_name), ''), 'Cliente');
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  if exists (select 1 from public.profiles where id = uid) then return jsonb_build_object('ok', true, 'already', true); end if;
  select email, email_confirmed_at into mail, confirmed from auth.users where id = uid;
  if confirmed is null then return jsonb_build_object('ok', false, 'reason', 'email_nao_confirmado'); end if;

  select count(*) into recent from public.invite_attempts where user_id = uid and at > now() - interval '1 hour' and not ok;
  if recent >= 5 then return jsonb_build_object('ok', false, 'reason', 'bloqueado'); end if;

  if coalesce(trim(p_code), '') <> '' then
    select * into inv from public.invites where code_hash = app.hash_code(p_code) and role = 'cliente' for update;
    if not found or inv.revoked or inv.used_at is not null or inv.expires_at < now() then
      insert into public.invite_attempts (user_id, ok) values (uid, false);
      return jsonb_build_object('ok', false, 'reason', 'invalido');
    end if;
    cid := inv.clinic_id;
  else
    select id into cid from public.clinics where slug = p_slug;
    if cid is null then
      insert into public.invite_attempts (user_id, ok) values (uid, false);
      return jsonb_build_object('ok', false, 'reason', 'invalido');
    end if;
  end if;

  select id into clid from public.clients where clinic_id = cid and lower(email) = lower(mail) and user_id is null limit 1;
  if clid is null then
    insert into public.clients (clinic_id, user_id, name, phone, email)
    values (cid, uid, display, coalesce(trim(p_phone), ''), lower(mail)) returning id into clid;
  else
    update public.clients set user_id = uid, phone = coalesce(nullif(trim(p_phone), ''), phone) where id = clid;
  end if;

  insert into public.profiles (id, clinic_id, role, client_id, name, email, terms_accepted_at, terms_version)
  values (uid, cid, 'cliente', clid, display, lower(mail), now(), 'v1');

  if inv.code_hash is not null then
    update public.invites set used_at = now(), used_by = uid where code_hash = inv.code_hash;
  end if;
  insert into public.invite_attempts (user_id, ok) values (uid, true);

  perform app.notify_perm(cid, 'clientes', 'followup', 'Nova cliente na carteira', display || ' se cadastrou pelo link', '/clientes/' || clid, 'client:' || clid);
  perform app.log(cid, 'cliente', uid, 'cadastro', clid, 'Se cadastrou pelo link da clínica');
  return jsonb_build_object('ok', true, 'clinic_id', cid, 'client_id', clid);
end $$;

create or replace function public.report_payment(p_entry_id uuid, p_method text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  entry public.ledger;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into entry from public.ledger where id = p_entry_id and clinic_id = me.clinic_id and client_id = me.client_id and kind = 'receber' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrada'); end if;
  if entry.reported is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  update public.ledger set method = coalesce(nullif(trim(p_method), ''), method),
    reported = jsonb_build_object('at', now(), 'method', coalesce(nullif(trim(p_method), ''), entry.method))
  where id = entry.id;
  perform app.notify_perm(me.clinic_id, 'financeiro', 'payment', me.name || ' informou um pagamento',
    'R$ ' || entry.value || ' · ' || coalesce(nullif(trim(p_method), ''), entry.method) || ' · confirme o recebimento',
    '/gestao?aba=receber', 'preport:' || entry.id);
  perform app.log(me.clinic_id, 'cliente', me.id, 'pagamento', me.client_id, 'Informou pagamento de R$ ' || entry.value, true);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.request_cancel(p_appt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  a public.appointments;
  immediate boolean;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into a from public.appointments where id = p_appt_id and clinic_id = me.clinic_id and client_id = me.client_id and not done and status <> 'cancelled' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  immediate := (a.date + a.time) at time zone 'America/Sao_Paulo' - now() >= interval '24 hours';
  if immediate then
    update public.appointments set status = 'cancelled' where id = a.id;
    perform app.notify_perm(me.clinic_id, 'agenda', 'reschedule', 'Horário cancelado', me.name || ' · ' || a.date || ' ' || to_char(a.time, 'HH24:MI'), '/agenda');
    perform app.log(me.clinic_id, 'cliente', me.id, 'horario', me.client_id, 'Cancelou ' || a.procedure);
  else
    update public.appointments set cancel_request = true where id = a.id;
    perform app.notify_perm(me.clinic_id, 'agenda', 'reschedule', 'Pedido de cancelamento', me.name || ' · ' || a.date || ' ' || to_char(a.time, 'HH24:MI') || ' (menos de 24 h)', '/atendimentos/' || a.id);
    perform app.log(me.clinic_id, 'cliente', me.id, 'horario', me.client_id, 'Pediu para cancelar ' || a.procedure || ' (menos de 24 h)');
  end if;
  return jsonb_build_object('ok', true, 'immediate', immediate);
end $$;

create or replace function public.request_reschedule(p_appt_id uuid, p_date date, p_time time) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  a public.appointments;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into a from public.appointments where id = p_appt_id and clinic_id = me.clinic_id and client_id = me.client_id and not done and status <> 'cancelled' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  update public.appointments set reschedule = true, proposed_date = p_date, proposed_time = p_time where id = a.id;
  perform app.notify_perm(me.clinic_id, 'agenda', 'reschedule', 'Pedido de remarcação',
    me.name || ' propõe ' || p_date || ' ' || to_char(p_time, 'HH24:MI'), '/atendimentos/' || a.id);
  perform app.log(me.clinic_id, 'cliente', me.id, 'horario', me.client_id, 'Pediu remarcação para ' || p_date || ' às ' || to_char(p_time, 'HH24:MI'));
  return jsonb_build_object('ok', true);
end $$;

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
  public.report_payment(uuid, text),
  public.request_cancel(uuid),
  public.request_reschedule(uuid, date, time)
to authenticated;

-- ---------------------------------------------------------------- trocar o próprio nome (perfil não tem escrita direta)
create function public.update_my_name(p_name text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found or coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'reason', 'invalido'); end if;
  update public.profiles set name = trim(p_name) where id = me.id;
  if me.role = 'cliente' then update public.clients set name = trim(p_name) where id = me.client_id; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.update_my_name(text) from public, anon, authenticated;
grant execute on function public.update_my_name(text) to authenticated;
