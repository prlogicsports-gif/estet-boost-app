-- Funções auxiliares e políticas RLS. Regra de ouro: tudo negado por padrão.
-- O papel e a clínica vêm de public.profiles (escrita só por função do servidor),
-- NUNCA de user_metadata, que o próprio usuário consegue editar.

-- ---------------------------------------------------------------- auxiliares
create function app.clinic_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as
$$ select clinic_id from public.profiles where id = auth.uid() and active $$;

create function app.role() returns text
language sql stable security definer set search_path = public, pg_temp as
$$ select role from public.profiles where id = auth.uid() and active $$;

create function app.client_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as
$$ select client_id from public.profiles where id = auth.uid() and active $$;

create function app.is_gestor() returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select coalesce(app.role() = 'gestor', false) $$;

create function app.is_team() returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select coalesce(app.role() in ('gestor', 'funcionario'), false) $$;

create function app.is_cliente() returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select coalesce(app.role() = 'cliente', false) $$;

-- ---------------------------------------------------------------- RLS ligado em tudo
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table app.secrets enable row level security;

-- ---------------------------------------------------------------- privilégios (nada por padrão)
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
revoke all on all tables in schema app from public, anon, authenticated;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated;
grant execute on function app.clinic_id(), app.role(), app.client_id(), app.is_gestor(), app.is_team(), app.is_cliente() to authenticated;

-- ---------------------------------------------------------------- clínica e perfis
grant select on public.clinics to authenticated;
grant update (name, email, phone, city, document, size) on public.clinics to authenticated;
create policy clinics_read on public.clinics for select to authenticated using (id = app.clinic_id());
create policy clinics_update on public.clinics for update to authenticated
  using (id = app.clinic_id() and app.is_gestor()) with check (id = app.clinic_id() and app.is_gestor());

grant select on public.profiles to authenticated;     -- sem escrita: só as funções do servidor
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_team_list on public.profiles for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());

-- ---------------------------------------------------------------- clientes e dados clínicos
grant select, insert, update, delete on public.clients to authenticated;
create policy clients_team on public.clients for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());
create policy clients_self on public.clients for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and id = app.client_id());

grant select, insert, update, delete on public.anamnesis to authenticated;
create policy anamnesis_team on public.anamnesis for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());
create policy anamnesis_self on public.anamnesis for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id());

grant select, insert, update, delete on public.care to authenticated;
create policy care_team on public.care for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());
create policy care_self on public.care for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id());

grant select, insert, update, delete on public.photos to authenticated;
create policy photos_team on public.photos for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());
create policy photos_self on public.photos for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id() and authorized);

-- ---------------------------------------------------------------- agenda
grant select, insert, update, delete on public.appointments to authenticated;
create policy appt_team on public.appointments for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());
create policy appt_self_read on public.appointments for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id());
-- a cliente só cria pedido pendente; cancelar/remarcar passa por função
create policy appt_self_request on public.appointments for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id()
              and status = 'pending' and origin = 'cliente' and request and not done);

grant select, insert, update, delete on public.blocks to authenticated;
create policy blocks_read on public.blocks for select to authenticated using (clinic_id = app.clinic_id());
create policy blocks_write on public.blocks for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());

grant select, update on public.clinic_config to authenticated;
create policy config_read on public.clinic_config for select to authenticated using (clinic_id = app.clinic_id());
create policy config_write on public.clinic_config for update to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());

grant select, insert, update, delete on public.procedures to authenticated;
create policy proc_read on public.procedures for select to authenticated using (clinic_id = app.clinic_id());
create policy proc_write on public.procedures for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());

-- ---------------------------------------------------------------- atendimento (rascunho pela equipe; fechar por função)
grant select, insert, update, delete on public.sessions to authenticated;
create policy sessions_read on public.sessions for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_team());
create policy sessions_insert on public.sessions for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.is_team() and status = 'draft');
create policy sessions_update on public.sessions for update to authenticated
  using (clinic_id = app.clinic_id() and app.is_team() and status = 'draft')
  with check (clinic_id = app.clinic_id() and app.is_team() and status = 'draft');
create policy sessions_delete on public.sessions for delete to authenticated
  using (clinic_id = app.clinic_id() and app.is_team() and status = 'draft');

grant select, insert, update, delete on public.session_procedures to authenticated;
create policy sproc_read on public.session_procedures for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_team());
create policy sproc_write on public.session_procedures for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team() and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'))
  with check (clinic_id = app.clinic_id() and app.is_team() and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'));

grant select, insert, update, delete on public.session_products to authenticated;
create policy sprod_read on public.session_products for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_team());
create policy sprod_write on public.session_products for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team() and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'))
  with check (clinic_id = app.clinic_id() and app.is_team() and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'draft'));

-- ---------------------------------------------------------------- estoque (equipe, sem custo)
grant select, insert, update, delete on public.stock to authenticated;
create policy stock_team on public.stock for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team()) with check (clinic_id = app.clinic_id() and app.is_team());

-- ---------------------------------------------------------------- FINANCEIRO: só a gestora
grant select, insert, update, delete on public.stock_costs, public.bills, public.session_finance, public.appointment_finance to authenticated;
create policy stock_costs_gestor on public.stock_costs for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());
create policy bills_gestor on public.bills for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());
create policy sfin_gestor on public.session_finance for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());
create policy afin_gestor on public.appointment_finance for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());

grant select, insert, update, delete on public.ledger to authenticated;
create policy ledger_gestor on public.ledger for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());
-- a cliente enxerga só as próprias cobranças em aberto; "informar pagamento" é função
create policy ledger_self on public.ledger for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id() and kind = 'receber');

-- ---------------------------------------------------------------- avisos, auditoria, preferências
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
create policy notif_read on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notif_mark on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

grant select on public.activity to authenticated;     -- escrita só por funções
create policy activity_read on public.activity for select to authenticated
  using (clinic_id = app.clinic_id() and (app.is_gestor() or (app.role() = 'funcionario' and not sensitive)));

grant select, insert, update, delete on public.push_tokens, public.prefs to authenticated;
create policy push_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prefs_own on public.prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- invites, invite_attempts e app.secrets: RLS ligado, sem política e sem privilégio = inacessíveis pela API
