-- EstetBoost.: esquema inicial (ver docs/SUPABASE-MODELO-E-RLS.md)
-- Convenções: uuid, dinheiro em numeric(12,2), datas em date/timestamptz, tudo por clínica (clinic_id).

create schema if not exists app;

-- ---------------------------------------------------------------- identidade
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_id uuid not null references auth.users (id),
  email text,
  phone text,
  city text,
  document text,
  size text check (size in ('autonoma', 'clinica')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  phone text not null default '',
  email text,
  birth date,
  document text,
  address text,
  goal text,
  allergies text,
  contra text,
  note text,
  main_procedure text not null default 'Sem procedimento definido',
  image_consent boolean not null default false,
  image_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_clinic_email on public.clients (clinic_id, lower(email)) where email is not null and email <> '';
create index clients_clinic on public.clients (clinic_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  role text not null check (role in ('gestor', 'funcionario', 'cliente')),
  client_id uuid references public.clients (id) on delete cascade,
  name text not null,
  email text,
  active boolean not null default true,
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  check ((role = 'cliente') = (client_id is not null))
);
create index profiles_clinic on public.profiles (clinic_id);

-- ---------------------------------------------------------------- clínico
create table public.anamnesis (
  client_id uuid primary key references public.clients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  answers jsonb not null default '{}',
  consent boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.care (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  text text not null,
  reminder_time time,
  until date,
  created_at timestamptz not null default now()
);
create index care_client on public.care (clinic_id, client_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  procedure text not null,
  date date not null,
  time time not null,
  duration int not null default 60,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  kind text not null default 'retorno' check (kind in ('primeira', 'retorno')),
  origin text not null default 'gestor' check (origin in ('gestor', 'cliente')),
  request boolean not null default false,
  reschedule boolean not null default false,
  proposed_date date,
  proposed_time time,
  cancel_request boolean not null default false,
  done boolean not null default false,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_day on public.appointments (clinic_id, date, time);
create index appointments_client on public.appointments (clinic_id, client_id, date desc);
-- dois horários ativos não podem ocupar o mesmo instante da clínica
create unique index appointments_no_clash on public.appointments (clinic_id, date, time) where status <> 'cancelled' and not done;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appt_id uuid references public.appointments (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete cascade,
  procedure text not null default '',
  step int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'done')),
  notes jsonb not null default '{}',
  before_photo_id uuid,
  after_photo_id uuid,
  staff_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index sessions_open on public.sessions (clinic_id, status, started_at desc);

create table public.session_procedures (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null
);

create table public.session_products (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  stock_id uuid,
  name text not null,
  qty numeric(10, 2) not null check (qty > 0)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  tipo text check (tipo in ('antes', 'depois')),
  procedure text,
  taken_at timestamptz not null default now(),
  authorized boolean not null default false,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index photos_client on public.photos (clinic_id, client_id, taken_at desc);

-- ---------------------------------------------------------------- estoque e catálogo
create table public.stock (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  category text not null default 'Outro',
  quantity numeric(10, 2) not null default 0 check (quantity >= 0),
  unit text not null default 'un',
  min numeric(10, 2) not null default 0,
  expiry date,
  batch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stock_clinic on public.stock (clinic_id);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null default 0 check (price >= 0),
  duration int not null default 60,
  return_days int not null default 14,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  date date not null,
  start time not null,
  "end" time not null,
  reason text not null default ''
);

create table public.clinic_config (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  hours jsonb not null,
  settings jsonb not null,
  payment_info text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- financeiro (só gestora)
create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  kind text not null check (kind in ('entradas', 'saidas', 'receber')),
  date date not null,
  due date,
  label text not null,
  origin text not null default '',
  method text not null default 'Pix',
  value numeric(12, 2) not null check (value >= 0),
  client_id uuid references public.clients (id) on delete set null,
  ref_id uuid,
  reported jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ledger_kind_date on public.ledger (clinic_id, kind, date desc);
create index ledger_due on public.ledger (clinic_id, kind, due);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  value numeric(12, 2) not null check (value >= 0),
  due date not null,
  recurrence text not null default 'Mensal' check (recurrence in ('Mensal', 'Avulsa')),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_costs (
  stock_id uuid primary key references public.stock (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  supplier text
);

create table public.session_finance (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  items jsonb not null default '[]',
  paid_now boolean not null default true,
  payment text not null default 'Pix',
  due_date date,
  cost_total numeric(12, 2) not null default 0
);

create table public.appointment_finance (
  appt_id uuid primary key references public.appointments (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  price numeric(12, 2) not null default 0,
  payment text not null default 'A definir'
);

-- ---------------------------------------------------------------- avisos, auditoria, credenciais
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  rule_key text not null,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (recipient_id, rule_key)
);
create index notifications_recipient on public.notifications (recipient_id, created_at desc);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  at timestamptz not null default now(),
  by_role text not null check (by_role in ('cliente', 'gestor', 'funcionario', 'sistema')),
  actor_id uuid,
  kind text not null check (kind in ('horario', 'pagamento', 'cadastro', 'atendimento', 'equipe')),
  client_id uuid,
  text text not null,
  sensitive boolean not null default false
);
create index activity_clinic on public.activity (clinic_id, at desc);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  role text not null check (role in ('cliente', 'funcionario')),
  name_hint text,
  phone_hint text,
  email_hint text,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid,
  revoked boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.invite_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  at timestamptz not null default now(),
  ok boolean not null
);
create index invite_attempts_user on public.invite_attempts (user_id, at desc);

create table public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text primary key,
  platform text,
  created_at timestamptz not null default now()
);

create table public.prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'
);

-- ---------------------------------------------------------------- segredo interno (nunca exposto pela API)
create table app.secrets (name text primary key, value text not null);
insert into app.secrets (name, value) values ('pepper', gen_random_uuid()::text || gen_random_uuid()::text) on conflict do nothing;

-- ---------------------------------------------------------------- updated_at automático
create function app.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch before update on public.clinics for each row execute function app.touch();
create trigger touch before update on public.clients for each row execute function app.touch();
create trigger touch before update on public.anamnesis for each row execute function app.touch();
create trigger touch before update on public.appointments for each row execute function app.touch();
create trigger touch before update on public.sessions for each row execute function app.touch();
create trigger touch before update on public.ledger for each row execute function app.touch();
create trigger touch before update on public.bills for each row execute function app.touch();
create trigger touch before update on public.stock for each row execute function app.touch();
create trigger touch before update on public.procedures for each row execute function app.touch();
create trigger touch before update on public.clinic_config for each row execute function app.touch();
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
-- Funções de identidade, credenciais e ações da cliente.
-- Todas SECURITY DEFINER com search_path fixo; validam auth.uid(), papel e clínica DENTRO da função.
-- Falhas esperadas voltam como {ok:false, reason} (e não como erro) para que o registro de tentativas não seja desfeito.

-- ---------------------------------------------------------------- utilidades internas (schema app, não exposto)
create function app.slugify(p text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'))
$$;

create function app.hash_code(p_code text) returns text language sql stable security definer set search_path = app, pg_temp as $$
  select encode(sha256(convert_to((select value from app.secrets where name = 'pepper') || upper(trim(p_code)), 'UTF8')), 'hex')
$$;

-- código legível (sem 0/O e 1/I/L), formato EB-XXXX-XXXX
create function app.new_code() returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  out text := '';
  i int;
begin
  for i in 0..7 loop
    out := out || substr(alphabet, (('x' || substr(raw, i * 2 + 1, 2))::bit(8)::int % 31) + 1, 1);
  end loop;
  return 'EB-' || substr(out, 1, 4) || '-' || substr(out, 5, 4);
end $$;

create function app.log(p_clinic uuid, p_by text, p_actor uuid, p_kind text, p_client uuid, p_text text, p_sensitive boolean default false)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.activity (clinic_id, by_role, actor_id, kind, client_id, text, sensitive)
  values (p_clinic, p_by, p_actor, p_kind, p_client, p_text, p_sensitive)
$$;

-- avisa as pessoas ativas da clínica com os papéis dados (um registro por destinatário; rule_key evita duplicar)
create function app.notify_clinic(p_clinic uuid, p_roles text[], p_kind text, p_title text, p_body text, p_href text, p_rule text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
  select p_clinic, id, coalesce(p_rule, gen_random_uuid()::text), p_kind, p_title, p_body, p_href
  from public.profiles where clinic_id = p_clinic and active and role = any (p_roles)
  on conflict (recipient_id, rule_key) do nothing
$$;

revoke all on function app.slugify(text), app.hash_code(text), app.new_code(),
  app.log(uuid, text, uuid, text, uuid, text, boolean),
  app.notify_clinic(uuid, text[], text, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- página pública do link (sem login)
create function public.get_clinic_public(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select jsonb_build_object('name', name) from public.clinics where slug = p_slug), jsonb_build_object())
$$;

-- ---------------------------------------------------------------- criar clínica (esteticista recém-cadastrada)
create function public.create_clinic(p_name text, p_phone text, p_studio text, p_city text, p_document text, p_size text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  mail text;
  confirmed timestamptz;
  existing public.profiles;
  base text;
  candidate text;
  n int := 1;
  cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'login'); end if;
  select * into existing from public.profiles where id = uid;
  if found then return jsonb_build_object('ok', true, 'clinic_id', existing.clinic_id, 'already', true); end if;

  select email, email_confirmed_at into mail, confirmed from auth.users where id = uid;
  if confirmed is null then return jsonb_build_object('ok', false, 'reason', 'email_nao_confirmado'); end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_studio), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'dados_incompletos');
  end if;

  base := coalesce(nullif(app.slugify(p_studio), ''), 'clinica');
  candidate := base;
  while exists (select 1 from public.clinics where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  insert into public.clinics (slug, name, owner_id, email, phone, city, document, size)
  values (candidate, trim(p_studio), uid, lower(mail), nullif(trim(p_phone), ''), nullif(trim(p_city), ''), nullif(trim(p_document), ''),
          case when p_size in ('autonoma', 'clinica') then p_size else 'autonoma' end)
  returning id into cid;

  insert into public.profiles (id, clinic_id, role, name, email, terms_accepted_at, terms_version)
  values (uid, cid, 'gestor', trim(p_name), lower(mail), now(), 'v1');

  insert into public.clinic_config (clinic_id, hours, settings)
  values (cid,
    '{"slot":30,"days":{"0":{"open":false,"start":"09:00","end":"13:00"},"1":{"open":true,"start":"09:00","end":"19:00"},"2":{"open":true,"start":"09:00","end":"19:00"},"3":{"open":true,"start":"09:00","end":"19:00"},"4":{"open":true,"start":"09:00","end":"19:00"},"5":{"open":true,"start":"09:00","end":"19:00"},"6":{"open":true,"start":"09:00","end":"13:00"}}}'::jsonb,
    '{"questions":[{"id":"queixa","label":"Queixa principal"},{"id":"objetivo","label":"Objetivo com o tratamento"},{"id":"saude","label":"Saúde e doenças crônicas"},{"id":"medicamentos","label":"Medicamentos em uso"},{"id":"alergias","label":"Alergias"},{"id":"rotina","label":"Rotina de cuidados em casa"},{"id":"anteriores","label":"Procedimentos anteriores"}],"consentText":"Autorizo o registro e o uso interno de fotografias do meu rosto para acompanhar a evolução do tratamento. Posso revogar esta autorização a qualquer momento."}'::jsonb);

  perform app.log(cid, 'gestor', uid, 'equipe', null, 'Clínica criada');
  return jsonb_build_object('ok', true, 'clinic_id', cid, 'slug', candidate);
end $$;

-- ---------------------------------------------------------------- credenciais (só a gestora)
create function public.create_invite(p_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  code text;
  exp timestamptz := now() + interval '7 days';
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  cid := app.clinic_id();
  if (select count(*) from public.invites where clinic_id = cid and used_at is null and not revoked and expires_at > now()) >= 50 then
    return jsonb_build_object('ok', false, 'reason', 'limite_de_credenciais');
  end if;
  code := app.new_code();
  insert into public.invites (code_hash, clinic_id, role, name_hint, phone_hint, expires_at, created_by)
  values (app.hash_code(code), cid, 'cliente', nullif(trim(p_name), ''), nullif(trim(p_phone), ''), exp, uid);
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', exp);   -- o código só aparece agora
end $$;

create function public.create_staff_invite(p_name text, p_email text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  mail text := lower(trim(coalesce(p_email, '')));
  code text;
  exp timestamptz := now() + interval '48 hours';
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'reason', 'email_invalido'); end if;
  cid := app.clinic_id();
  update public.invites set revoked = true
   where clinic_id = cid and role = 'funcionario' and lower(email_hint) = mail and used_at is null and not revoked;
  code := app.new_code();
  insert into public.invites (code_hash, clinic_id, role, name_hint, email_hint, expires_at, created_by)
  values (app.hash_code(code), cid, 'funcionario', nullif(trim(p_name), ''), mail, exp, uid);
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', exp);
end $$;

create function public.list_invites() returns table (id uuid, role text, name_hint text, phone_hint text, email_hint text, expires_at timestamptz, used_at timestamptz, revoked boolean, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.id, i.role, i.name_hint, i.phone_hint, i.email_hint, i.expires_at, i.used_at, i.revoked, i.created_at
  from public.invites i
  where app.is_gestor() and i.clinic_id = app.clinic_id()
  order by i.created_at desc
$$;

create function public.revoke_invite(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  update public.invites set revoked = true where id = p_id and clinic_id = app.clinic_id() and used_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- cliente entra por credencial ou pelo link da clínica
create function public.accept_invite(p_code text, p_slug text, p_name text, p_phone text) returns jsonb
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

  -- se a gestora já cadastrou essa cliente (mesmo e-mail), vincula em vez de duplicar
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

  perform app.notify_clinic(cid, array['gestor', 'funcionario'], 'followup', 'Nova cliente na carteira',
    display || ' se cadastrou pelo link', '/clientes/' || clid, 'client:' || clid);
  perform app.log(cid, 'cliente', uid, 'cadastro', clid, 'Se cadastrou pelo link da clínica');
  return jsonb_build_object('ok', true, 'clinic_id', cid, 'client_id', clid);
end $$;

-- ---------------------------------------------------------------- funcionária entra por credencial de equipe
create function public.accept_staff_invite(p_code text, p_name text) returns jsonb
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

  insert into public.profiles (id, clinic_id, role, name, email, terms_accepted_at, terms_version)
  values (uid, inv.clinic_id, 'funcionario', display, lower(mail), now(), 'v1');
  update public.invites set used_at = now(), used_by = uid where id = inv.id;
  insert into public.invite_attempts (user_id, ok) values (uid, true);

  perform app.notify_clinic(inv.clinic_id, array['gestor'], 'followup', 'Nova profissional na equipe', display || ' entrou na clínica', '/configuracoes', 'staff:' || uid);
  perform app.log(inv.clinic_id, 'funcionario', uid, 'equipe', null, display || ' entrou na equipe');
  return jsonb_build_object('ok', true, 'clinic_id', inv.clinic_id);
end $$;

-- ---------------------------------------------------------------- equipe: desativar e reativar (efeito imediato, o RLS consulta profiles.active)
create function public.set_staff_active(p_staff_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.profiles;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into target from public.profiles where id = p_staff_id and clinic_id = app.clinic_id() and role = 'funcionario';
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrada'); end if;
  update public.profiles set active = p_active where id = p_staff_id;
  perform app.log(target.clinic_id, 'gestor', auth.uid(), 'equipe', null, case when p_active then 'Reativou ' else 'Desativou ' end || target.name);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- ações da cliente (só os campos que ela pode mexer)
create function public.update_my_profile(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  update public.clients c set
    name = coalesce(nullif(trim(p_patch ->> 'name'), ''), c.name),
    phone = case when p_patch ? 'phone' then coalesce(trim(p_patch ->> 'phone'), '') else c.phone end,
    birth = case when p_patch ? 'birth' then nullif(p_patch ->> 'birth', '')::date else c.birth end,
    address = case when p_patch ? 'address' then nullif(trim(p_patch ->> 'address'), '') else c.address end,
    goal = case when p_patch ? 'goal' then nullif(trim(p_patch ->> 'goal'), '') else c.goal end,
    allergies = case when p_patch ? 'allergies' then nullif(trim(p_patch ->> 'allergies'), '') else c.allergies end,
    image_consent = case when p_patch ? 'image_consent' then (p_patch ->> 'image_consent')::boolean else c.image_consent end,
    image_consent_at = case when p_patch ? 'image_consent' and (p_patch ->> 'image_consent')::boolean is distinct from c.image_consent then now() else c.image_consent_at end
  where c.id = me.client_id;
  if p_patch ? 'name' and nullif(trim(p_patch ->> 'name'), '') is not null then
    update public.profiles set name = trim(p_patch ->> 'name') where id = me.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.report_payment(p_entry_id uuid, p_method text) returns jsonb
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
  perform app.notify_clinic(me.clinic_id, array['gestor'], 'payment', me.name || ' informou um pagamento',
    'R$ ' || entry.value || ' · ' || coalesce(nullif(trim(p_method), ''), entry.method) || ' · confirme o recebimento',
    '/gestao?aba=receber', 'preport:' || entry.id);
  perform app.log(me.clinic_id, 'cliente', me.id, 'pagamento', me.client_id, 'Informou pagamento de R$ ' || entry.value, true);
  return jsonb_build_object('ok', true);
end $$;

create function public.request_cancel(p_appt_id uuid) returns jsonb
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
    perform app.notify_clinic(me.clinic_id, array['gestor', 'funcionario'], 'reschedule', 'Horário cancelado', me.name || ' · ' || a.date || ' ' || to_char(a.time, 'HH24:MI'), '/agenda');
    perform app.log(me.clinic_id, 'cliente', me.id, 'horario', me.client_id, 'Cancelou ' || a.procedure);
  else
    update public.appointments set cancel_request = true where id = a.id;
    perform app.notify_clinic(me.clinic_id, array['gestor', 'funcionario'], 'reschedule', 'Pedido de cancelamento', me.name || ' · ' || a.date || ' ' || to_char(a.time, 'HH24:MI') || ' (menos de 24 h)', '/atendimentos/' || a.id);
    perform app.log(me.clinic_id, 'cliente', me.id, 'horario', me.client_id, 'Pediu para cancelar ' || a.procedure || ' (menos de 24 h)');
  end if;
  return jsonb_build_object('ok', true, 'immediate', immediate);
end $$;

create function public.request_reschedule(p_appt_id uuid, p_date date, p_time time) returns jsonb
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
  perform app.notify_clinic(me.clinic_id, array['gestor', 'funcionario'], 'reschedule', 'Pedido de remarcação',
    me.name || ' propõe ' || p_date || ' ' || to_char(p_time, 'HH24:MI'), '/atendimentos/' || a.id);
  perform app.log(me.clinic_id, 'cliente', me.id, 'horario', me.client_id, 'Pediu remarcação para ' || p_date || ' às ' || to_char(p_time, 'HH24:MI'));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- permissões de execução: só usuários logados (e o link público)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_clinic_public(text) to anon, authenticated;
grant execute on function
  public.create_clinic(text, text, text, text, text, text),
  public.create_invite(text, text),
  public.create_staff_invite(text, text),
  public.list_invites(),
  public.revoke_invite(uuid),
  public.accept_invite(text, text, text, text),
  public.accept_staff_invite(text, text),
  public.set_staff_active(uuid, boolean),
  public.update_my_profile(jsonb),
  public.report_payment(uuid, text),
  public.request_cancel(uuid),
  public.request_reschedule(uuid, date, time)
to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
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
-- Fotos: bucket PRIVADO, caminho `{clinic_id}/{client_id}/{foto}`.
-- A equipe (com permissão de clientes ou atendimentos) lê e grava. A cliente vê só as fotos que a
-- esteticista autorizou (coluna `authorized`) e as que ela mesma enviou, e só apaga as que enviou.
-- Tipo e tamanho limitados no bucket. A parte do Storage só roda no Supabase (o schema "storage" não existe fora dele).

alter table public.photos add column if not exists origem text not null default 'profissional' check (origem in ('profissional', 'cliente'));

drop policy if exists photos_self on public.photos;
create policy photos_self on public.photos for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id() and (authorized or origem = 'cliente'));
create policy photos_self_insert on public.photos for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id() and origem = 'cliente' and not authorized);
create policy photos_self_delete on public.photos for delete to authenticated
  using (clinic_id = app.clinic_id() and app.is_cliente() and client_id = app.client_id() and origem = 'cliente');

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

    drop policy if exists photos_team_all on storage.objects;
    drop policy if exists photos_client_read on storage.objects;
    drop policy if exists photos_client_insert on storage.objects;
    drop policy if exists photos_client_delete on storage.objects;

    create policy photos_team_all on storage.objects for all to authenticated
      using (bucket_id = 'photos' and (storage.foldername(name))[1] = app.clinic_id()::text
             and (app.has_perm('clientes') or app.has_perm('atendimentos')))
      with check (bucket_id = 'photos' and (storage.foldername(name))[1] = app.clinic_id()::text
             and (app.has_perm('clientes') or app.has_perm('atendimentos')));

    -- a cliente lê o arquivo só se a foto correspondente está autorizada (ou foi enviada por ela)
    create policy photos_client_read on storage.objects for select to authenticated
      using (bucket_id = 'photos' and app.is_cliente()
             and (storage.foldername(name))[1] = app.clinic_id()::text
             and (storage.foldername(name))[2] = app.client_id()::text
             and exists (select 1 from public.photos p
                         where p.storage_path = name and p.client_id = app.client_id() and (p.authorized or p.origem = 'cliente')));

    create policy photos_client_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'photos' and app.is_cliente()
             and (storage.foldername(name))[1] = app.clinic_id()::text
             and (storage.foldername(name))[2] = app.client_id()::text);

    create policy photos_client_delete on storage.objects for delete to authenticated
      using (bucket_id = 'photos' and app.is_cliente()
             and (storage.foldername(name))[1] = app.clinic_id()::text
             and (storage.foldername(name))[2] = app.client_id()::text
             and exists (select 1 from public.photos p where p.storage_path = name and p.origem = 'cliente'));
  end if;
end $$;
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
-- Botão "Enviar notificação de teste": cria um aviso para a própria pessoa, o que dispara o push.
-- No máximo 1 por minuto por pessoa. Pode ser rodada mais de uma vez.

create or replace function public.send_test_push() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if exists (select 1 from public.notifications where recipient_id = me.id and rule_key like 'test:%' and created_at > now() - interval '1 minute') then
    return jsonb_build_object('ok', false, 'reason', 'aguarde');
  end if;
  insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title, body, href)
  values (me.clinic_id, me.id, 'test:' || gen_random_uuid(), 'reminder', 'Teste de notificação',
          'Se você está vendo isto, o push está funcionando.', '/');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.send_test_push() from public, anon;
grant execute on function public.send_test_push() to authenticated;
-- O nome da cliente é UM só: o do cadastro de cliente da clínica.
-- 1) ao vincular uma conta a um cadastro que a gestora já criou, vale o nome do cadastro;
-- 2) se o nome do cadastro mudar, o perfil e os horários acompanham;
-- 3) corrige quem já ficou com nomes diferentes. Pode ser rodada mais de uma vez.

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
    -- o nome é o do cadastro feito pela clínica, não o digitado no cadastro da cliente
    select name into display from public.clients where id = clid;
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

create or replace function app.sync_client_name() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.name is distinct from old.name then
    update public.profiles set name = new.name where client_id = new.id and role = 'cliente';
    update public.appointments set client_name = new.name where client_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists clients_sync_name on public.clients;
create trigger clients_sync_name after update of name on public.clients
  for each row execute function app.sync_client_name();

update public.profiles p set name = c.name
  from public.clients c
 where p.client_id = c.id and p.role = 'cliente' and p.name is distinct from c.name;
update public.appointments a set client_name = c.name
  from public.clients c
 where a.client_id = c.id and a.client_name is distinct from c.name;

revoke all on function app.sync_client_name() from public, anon, authenticated;
-- Endereço do estúdio: a gestora cadastra e a cliente toca para abrir no mapa. Pode ser rodada mais de uma vez.
alter table public.clinics add column if not exists address text;
grant update (address) on public.clinics to authenticated;
