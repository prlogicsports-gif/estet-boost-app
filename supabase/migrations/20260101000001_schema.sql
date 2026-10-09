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
