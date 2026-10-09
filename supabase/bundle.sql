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
