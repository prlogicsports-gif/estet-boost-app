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
-- 1) Bloqueios de agenda também para a equipe com permissão de agenda (antes só a gestora).
-- 2) Cadastro por link: o link fixo da clínica nunca bloqueia e a credencial errada só bloqueia depois de
--    20 erros por hora (antes: 5 por hora para tudo). Pode ser rodada mais de uma vez.

drop policy if exists blocks_write on public.blocks;
create policy blocks_write on public.blocks for all to authenticated
  using (clinic_id = app.clinic_id() and (app.is_gestor() or app.has_perm('agenda')))
  with check (clinic_id = app.clinic_id() and (app.is_gestor() or app.has_perm('agenda')));

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

  if coalesce(trim(p_code), '') <> '' then
    -- só credencial errada conta: 20 erros por hora bloqueiam (o link fixo da clínica nunca bloqueia)
    select count(*) into recent from public.invite_attempts where user_id = uid and at > now() - interval '1 hour' and not ok;
    if recent >= 20 then return jsonb_build_object('ok', false, 'reason', 'bloqueado'); end if;
    select * into inv from public.invites where code_hash = app.hash_code(p_code) and role = 'cliente' for update;
    if not found or inv.revoked or inv.used_at is not null or inv.expires_at < now() then
      insert into public.invite_attempts (user_id, ok) values (uid, false);
      return jsonb_build_object('ok', false, 'reason', 'invalido');
    end if;
    cid := inv.clinic_id;
  else
    select id into cid from public.clinics where slug = p_slug;
    if cid is null then
      return jsonb_build_object('ok', false, 'reason', 'invalido');   -- link inexistente: não conta como tentativa errada
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
-- Catálogo de procedimentos: produtos usados em cada procedimento e procedimentos habilitados por pessoa da equipe.
-- procedure_ids vazio = a pessoa vê todos os procedimentos. Pode ser rodada mais de uma vez.

alter table public.procedures add column if not exists products jsonb not null default '[]';
alter table public.profiles add column if not exists procedure_ids uuid[] not null default '{}';
alter table public.invites add column if not exists procedure_ids uuid[] not null default '{}';

-- só ids de procedimentos desta clínica
create or replace function app.clean_procedure_ids(p_clinic uuid, p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(id order by name), '{}')
    from public.procedures
   where clinic_id = p_clinic and id = any (coalesce(p_ids, '{}'))
$$;
revoke all on function app.clean_procedure_ids(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.set_staff_procedures(p_staff_id uuid, p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.profiles;
begin
  if app.role() is distinct from 'gestor' then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into target from public.profiles where id = p_staff_id and clinic_id = app.clinic_id() and role = 'funcionario';
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrada'); end if;
  update public.profiles set procedure_ids = app.clean_procedure_ids(target.clinic_id, p_ids) where id = p_staff_id;
  perform app.log(target.clinic_id, 'gestor', auth.uid(), 'equipe', null, 'Alterou os procedimentos de ' || target.name);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_invite_procedures(p_code text, p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.role() is distinct from 'gestor' then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  update public.invites set procedure_ids = app.clean_procedure_ids(app.clinic_id(), p_ids)
   where code_hash = app.hash_code(coalesce(p_code, '')) and clinic_id = app.clinic_id() and role = 'funcionario' and used_at is null and not revoked;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrada'); end if;
  return jsonb_build_object('ok', true);
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

  insert into public.profiles (id, clinic_id, role, name, email, terms_accepted_at, terms_version, permissions, procedure_ids)
  values (uid, inv.clinic_id, 'funcionario', display, lower(mail), now(), 'v1', app.clean_perms(inv.permissions),
          app.clean_procedure_ids(inv.clinic_id, inv.procedure_ids));
  update public.invites set used_at = now(), used_by = uid where id = inv.id;
  insert into public.invite_attempts (user_id, ok) values (uid, true);

  perform app.notify_clinic(inv.clinic_id, array['gestor'], 'followup', 'Nova profissional na equipe', display || ' entrou na clínica', '/configuracoes', 'staff:' || uid);
  perform app.log(inv.clinic_id, 'funcionario', uid, 'equipe', null, display || ' entrou na equipe');
  return jsonb_build_object('ok', true, 'clinic_id', inv.clinic_id);
end $$;

grant execute on function public.set_staff_procedures(uuid, uuid[]), public.set_invite_procedures(text, uuid[]) to authenticated;
-- Conta da cliente criada pela gestora: a Edge Function `create-client-account` cria o usuário no Auth e chama
-- esta função (só a chave de serviço executa) para ligar o login à ficha e registrar o que aconteceu.
-- Pode ser rodada mais de uma vez.

create or replace function public.client_access_event(
  p_mode text, p_user uuid, p_client uuid, p_email text, p_actor uuid, p_actor_role text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.clients;
  by_role text := case when p_actor_role = 'funcionario' then 'funcionario' else 'gestor' end;
begin
  select * into c from public.clients where id = p_client for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrada'); end if;

  if p_mode = 'reset' then
    perform app.log(c.clinic_id, by_role, p_actor, 'cadastro', c.id, 'Acesso ao app: senha redefinida');
    return jsonb_build_object('ok', true);
  end if;

  if c.user_id is not null then return jsonb_build_object('ok', false, 'reason', 'ja_tem_acesso'); end if;
  if exists (select 1 from public.profiles where id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'email_em_uso');
  end if;

  update public.clients set user_id = p_user, email = lower(p_email) where id = c.id;
  insert into public.profiles (id, clinic_id, role, client_id, name, email)
  values (p_user, c.clinic_id, 'cliente', c.id, c.name, lower(p_email));

  perform app.notify_client(c.clinic_id, c.id, 'followup', 'Seu acesso está pronto',
    'Veja seus horários, sua evolução e os cuidados indicados.', '/cliente', 'welcome:' || c.id);
  perform app.log(c.clinic_id, by_role, p_actor, 'cadastro', c.id, 'Acesso ao app criado');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.client_access_event(text, uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.client_access_event(text, uuid, uuid, text, uuid, text) to service_role;

-- Primeiro acesso de quem teve a conta criada pela gestora: aceita os termos e a política de privacidade.
create or replace function public.accept_terms() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles
     set terms_accepted_at = coalesce(terms_accepted_at, now()), terms_version = coalesce(terms_version, 'v1')
   where id = auth.uid() and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.accept_terms() from public, anon;
grant execute on function public.accept_terms() to authenticated;
-- Mapa de regiões: a marcação passa a guardar o produto do estoque usado (id e quantidade).
-- A cliente vê o nome do produto, mas não o id interno do estoque nem a quantidade, nem as observações da esteticista.
-- Pode ser rodada mais de uma vez.

create or replace function public.my_face_map() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select jsonb_agg(m - 'observacao' - 'produtoId' - 'produtoQtd')
    from public.face_maps f, jsonb_array_elements(f.marks) m
    where f.client_id = app.client_id() and f.clinic_id = app.clinic_id() and app.is_cliente()), '[]'::jsonb)
$$;
-- Fidelidade das clientes: pontos, níveis, selos e ranking opcional. Tudo controlado pela gestora.
--  * A cliente nunca grava pontos: só lê o resultado por função (my_loyalty, loyalty_ranking) e escolhe entrar no ranking.
--  * Os pontos são concedidos no servidor por gatilhos (atendimento finalizado, presença confirmada, cadastro),
--    de forma idempotente (unique client_id + idem_key).
--  * O ranking só mostra apelido, posição e pontos de quem entrou por vontade própria.
-- Pode ser rodada mais de uma vez.

-- ---------------------------------------------------------------- tabelas
create table if not exists public.loyalty_config (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  enabled boolean not null default false,
  ranking_enabled boolean not null default false,
  points jsonb not null default '{"session_done":10,"first_visit":20,"return_on_time":10,"confirmed":3,"signup":5,"return_days":45}',
  levels jsonb not null default '[{"id":"bronze","name":"Bronze","min":0},{"id":"prata","name":"Prata","min":100},{"id":"ouro","name":"Ouro","min":300},{"id":"diamante","name":"Diamante","min":700}]',
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  event text not null,
  points int not null,
  ref_id uuid,
  idem_key text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (client_id, idem_key)
);
create index if not exists loyalty_ledger_client on public.loyalty_ledger (client_id, created_at desc);
create index if not exists loyalty_ledger_ref on public.loyalty_ledger (ref_id);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'Star',
  criteria text not null check (criteria in ('sessions_count', 'confirmed_count', 'points_total', 'streak', 'manual')),
  threshold int not null default 0 check (threshold >= 0),
  active boolean not null default true,
  builtin text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists badges_builtin on public.badges (clinic_id, builtin) where builtin is not null;

create table if not exists public.client_badges (
  badge_id uuid not null references public.badges (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (badge_id, client_id)
);

create table if not exists public.ranking_members (
  client_id uuid primary key references public.clients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  opted_in_at timestamptz not null default now()
);
create unique index if not exists ranking_nickname on public.ranking_members (clinic_id, lower(nickname));

-- ---------------------------------------------------------------- RLS: só a gestora lê as tabelas; a cliente usa funções
alter table public.loyalty_config enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.badges enable row level security;
alter table public.client_badges enable row level security;
alter table public.ranking_members enable row level security;
grant select on public.loyalty_config, public.loyalty_ledger, public.badges, public.client_badges, public.ranking_members to authenticated;

drop policy if exists loyalty_config_gestor on public.loyalty_config;
create policy loyalty_config_gestor on public.loyalty_config for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());
drop policy if exists loyalty_ledger_gestor on public.loyalty_ledger;
create policy loyalty_ledger_gestor on public.loyalty_ledger for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());
drop policy if exists badges_gestor on public.badges;
create policy badges_gestor on public.badges for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());
drop policy if exists client_badges_gestor on public.client_badges;
create policy client_badges_gestor on public.client_badges for select to authenticated
  using (app.is_gestor() and exists (select 1 from public.badges b where b.id = badge_id and b.clinic_id = app.clinic_id()));
drop policy if exists ranking_members_gestor on public.ranking_members;
create policy ranking_members_gestor on public.ranking_members for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());

-- ---------------------------------------------------------------- regras (funções internas)
-- "ganhos" = tudo menos os resgates (define nível, selos e ranking: gastar pontos não rebaixa a cliente)
-- "saldo"  = ganhos menos o que foi resgatado (o que ela ainda pode gastar)
create or replace function app.loyalty_earned(p_client uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(points), 0)::int from public.loyalty_ledger where client_id = p_client and event <> 'redeem'
$$;
create or replace function app.loyalty_balance(p_client uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(points), 0)::int from public.loyalty_ledger where client_id = p_client
$$;

create or replace function app.loyalty_level(p_levels jsonb, p_points int) returns jsonb
language sql immutable as $$
  select l from jsonb_array_elements(p_levels) l where (l ->> 'min')::int <= p_points order by (l ->> 'min')::int desc limit 1
$$;

create or replace function app.loyalty_next_level(p_levels jsonb, p_points int) returns jsonb
language sql immutable as $$
  select l from jsonb_array_elements(p_levels) l where (l ->> 'min')::int > p_points order by (l ->> 'min')::int asc limit 1
$$;

-- meses seguidos com atendimento (contando do mês atual ou do anterior)
create or replace function app.client_streak(p_client uuid) returns int
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  cur date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  n int := 0;
begin
  if not exists (select 1 from public.sessions where client_id = p_client and status = 'done'
                   and date_trunc('month', finished_at at time zone 'America/Sao_Paulo')::date = cur) then
    cur := (cur - interval '1 month')::date;
  end if;
  loop
    exit when not exists (select 1 from public.sessions where client_id = p_client and status = 'done'
                            and date_trunc('month', finished_at at time zone 'America/Sao_Paulo')::date = cur);
    n := n + 1;
    cur := (cur - interval '1 month')::date;
  end loop;
  return n;
end $$;

create or replace function app.badge_value(p_client uuid, p_criteria text, p_total int) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select case p_criteria
    when 'sessions_count' then (select count(*)::int from public.sessions where client_id = p_client and status = 'done')
    when 'confirmed_count' then (select count(*)::int from public.loyalty_ledger where client_id = p_client and event = 'confirmed')
    when 'points_total' then p_total
    when 'streak' then app.client_streak(p_client)
    else 0 end
$$;

-- selos padrão da clínica (a gestora edita, desliga ou cria outros)
create or replace function app.loyalty_seed(p_clinic uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.badges (clinic_id, name, icon, criteria, threshold, builtin, position)
  select p_clinic, v.name, v.icon, v.criteria, v.threshold, v.builtin, v.pos
  from (values
    ('Primeira visita', 'Sparkles', 'sessions_count', 1, 'primeira', 1),
    ('3 atendimentos', 'Star', 'sessions_count', 3, 'tres', 2),
    ('10 atendimentos', 'Trophy', 'sessions_count', 10, 'dez', 3),
    ('Presença certa', 'Medal', 'confirmed_count', 5, 'presenca', 4),
    ('Fiel há 3 meses', 'Flame', 'streak', 3, 'fiel', 5),
    ('Embaixadora', 'Crown', 'manual', 0, 'embaixadora', 6)
  ) as v(name, icon, criteria, threshold, builtin, pos)
  where not exists (select 1 from public.badges b where b.clinic_id = p_clinic and b.builtin = v.builtin)
$$;

-- confere selos e nível da cliente e avisa o que for novo (cada aviso sai uma vez: rule_key estável)
create or replace function app.loyalty_refresh(p_clinic uuid, p_client uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg public.loyalty_config;
  total int;
  b record;
  lvl jsonb;
begin
  select * into cfg from public.loyalty_config where clinic_id = p_clinic;
  if not found or not cfg.enabled then return; end if;
  total := app.loyalty_earned(p_client);

  for b in select * from public.badges
            where clinic_id = p_clinic and active and criteria <> 'manual' and threshold > 0
              and not exists (select 1 from public.client_badges cb where cb.badge_id = badges.id and cb.client_id = p_client) loop
    if app.badge_value(p_client, b.criteria, total) >= b.threshold then
      insert into public.client_badges (badge_id, client_id) values (b.id, p_client) on conflict do nothing;
      perform app.notify_client(p_clinic, p_client, 'reward', 'Novo selo: ' || b.name,
        'Você conquistou o selo ' || b.name || '. Veja suas conquistas.', '/cliente/conquistas', 'badge:' || b.id);
    end if;
  end loop;

  lvl := app.loyalty_level(cfg.levels, total);
  if lvl is not null and (lvl ->> 'min')::int > 0 then
    perform app.notify_client(p_clinic, p_client, 'reward', 'Você subiu de nível: ' || (lvl ->> 'name'),
      'Você chegou a ' || total || ' pontos. Continue assim!', '/cliente/conquistas', 'level:' || (lvl ->> 'id'));
  end if;
end $$;

-- concede pontos (idempotente). Sem programa ligado, não faz nada.
create or replace function app.award(
  p_clinic uuid, p_client uuid, p_event text, p_points int, p_ref uuid, p_idem text, p_note text default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg public.loyalty_config;
  new_id uuid;
  total int;
begin
  select * into cfg from public.loyalty_config where clinic_id = p_clinic;
  if not found or not cfg.enabled or coalesce(p_points, 0) = 0 then return false; end if;
  insert into public.loyalty_ledger (clinic_id, client_id, event, points, ref_id, idem_key, note)
  values (p_clinic, p_client, p_event, p_points, p_ref, p_idem, p_note)
  on conflict (client_id, idem_key) do nothing
  returning id into new_id;
  if new_id is null then return false; end if;
  total := app.loyalty_balance(p_client);
  if p_points > 0 then
    perform app.notify_client(p_clinic, p_client, 'reward', 'Você ganhou pontos',
      '+' || p_points || ' pontos' || coalesce(' · ' || p_note, '') || '. Total: ' || total || '.',
      '/cliente/conquistas', 'pts:' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'));
  end if;
  perform app.loyalty_refresh(p_clinic, p_client);
  return true;
end $$;

-- pontos de um atendimento finalizado: atendimento, 1ª visita e retorno no prazo
create or replace function app.award_session(p_session uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.sessions;
  cfg public.loyalty_config;
  pts jsonb;
  prev timestamptz;
  at_ timestamptz;
begin
  select * into s from public.sessions where id = p_session and status = 'done';
  if not found then return; end if;
  select * into cfg from public.loyalty_config where clinic_id = s.clinic_id;
  if not found or not cfg.enabled then return; end if;
  pts := cfg.points;
  at_ := coalesce(s.finished_at, now());
  perform app.award(s.clinic_id, s.client_id, 'session_done', coalesce((pts ->> 'session_done')::int, 0), s.id, 'session:' || s.id, 'atendimento');
  select max(o.finished_at) into prev from public.sessions o
   where o.client_id = s.client_id and o.status = 'done' and (o.finished_at, o.id) < (at_, s.id);
  if prev is null then
    perform app.award(s.clinic_id, s.client_id, 'first_visit', coalesce((pts ->> 'first_visit')::int, 0), s.id, 'first:' || s.client_id, 'primeira visita');
  elsif at_ - prev <= make_interval(days => coalesce((pts ->> 'return_days')::int, 45)) then
    perform app.award(s.clinic_id, s.client_id, 'return_on_time', coalesce((pts ->> 'return_on_time')::int, 0), s.id, 'return:' || s.id, 'retorno no prazo');
  end if;
end $$;

-- ---------------------------------------------------------------- gatilhos (a cliente não escreve nada)
create or replace function app.trg_loyalty_session() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.award_session(new.id);
  return new;
end $$;
drop trigger if exists loyalty_session_done on public.sessions;
create trigger loyalty_session_done after update of status on public.sessions
  for each row when (new.status = 'done' and old.status is distinct from 'done')
  execute function app.trg_loyalty_session();

-- atendimento apagado: os pontos dele saem junto
create or replace function app.trg_loyalty_session_delete() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.loyalty_ledger
   where ref_id = old.id and event in ('session_done', 'first_visit', 'return_on_time');
  return old;
end $$;
drop trigger if exists loyalty_session_delete on public.sessions;
create trigger loyalty_session_delete after delete on public.sessions
  for each row execute function app.trg_loyalty_session_delete();

-- presença confirmada (pela cliente ou pela gestora): pendente vira confirmado
create or replace function app.trg_loyalty_confirm() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare cfg public.loyalty_config;
begin
  select * into cfg from public.loyalty_config where clinic_id = new.clinic_id;
  if found and cfg.enabled then
    perform app.award(new.clinic_id, new.client_id, 'confirmed', coalesce((cfg.points ->> 'confirmed')::int, 0), new.id, 'confirm:' || new.id, 'presença confirmada');
  end if;
  return new;
end $$;
drop trigger if exists loyalty_confirm on public.appointments;
create trigger loyalty_confirm after update of status on public.appointments
  for each row when (old.status = 'pending' and new.status = 'confirmed' and not new.done)
  execute function app.trg_loyalty_confirm();

-- cadastro da cliente
create or replace function app.trg_loyalty_signup() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare cfg public.loyalty_config;
begin
  select * into cfg from public.loyalty_config where clinic_id = new.clinic_id;
  if found and cfg.enabled and new.client_id is not null then
    perform app.award(new.clinic_id, new.client_id, 'signup', coalesce((cfg.points ->> 'signup')::int, 0), null, 'signup', 'cadastro');
  end if;
  return new;
end $$;
drop trigger if exists loyalty_signup on public.profiles;
create trigger loyalty_signup after insert on public.profiles
  for each row when (new.role = 'cliente')
  execute function app.trg_loyalty_signup();

revoke all on function app.loyalty_earned(uuid), app.loyalty_balance(uuid), app.loyalty_level(jsonb, int), app.loyalty_next_level(jsonb, int), app.client_streak(uuid),
  app.badge_value(uuid, text, int), app.loyalty_seed(uuid), app.loyalty_refresh(uuid, uuid),
  app.award(uuid, uuid, text, int, uuid, text, text), app.award_session(uuid),
  app.trg_loyalty_session(), app.trg_loyalty_session_delete(), app.trg_loyalty_confirm(), app.trg_loyalty_signup()
  from public, anon, authenticated;
-- Fidelidade: funções que o app chama.
--  Cliente: my_loyalty, loyalty_ranking, set_ranking_optin (só lê o próprio resultado; ranking só com apelido e por opção dela).
--  Gestora: loyalty_admin, save_loyalty_config, save_badge, delete_badge, grant_badge, award_manual, loyalty_backfill.
-- Pode ser rodada mais de uma vez.

-- níveis: até 8, nomes de 1 a 24 letras, o primeiro sempre começa em 0 pontos
create or replace function app.clean_levels(p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  out_ jsonb;
  first_min int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', slug, 'name', nm, 'min', mn) order by mn, nm), '[]')
    into out_
    from (
      select left(trim(l ->> 'name'), 24) as nm,
             greatest(0, least(coalesce((l ->> 'min')::int, 0), 1000000)) as mn,
             trim(both '-' from lower(regexp_replace(left(trim(l ->> 'name'), 24), '[^A-Za-z0-9]+', '-', 'g'))) as slug
        from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) l
       where trim(coalesce(l ->> 'name', '')) <> ''
       limit 8
    ) t;
  if jsonb_array_length(out_) = 0 then
    return '[{"id":"bronze","name":"Bronze","min":0}]'::jsonb;
  end if;
  first_min := (out_ -> 0 ->> 'min')::int;
  if first_min > 0 then
    out_ := jsonb_set(out_, '{0,min}', '0');
  end if;
  return out_;
end $$;

create or replace function app.clean_points(p jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'session_done', greatest(0, least(coalesce((p ->> 'session_done')::int, 10), 1000)),
    'first_visit', greatest(0, least(coalesce((p ->> 'first_visit')::int, 20), 1000)),
    'return_on_time', greatest(0, least(coalesce((p ->> 'return_on_time')::int, 10), 1000)),
    'confirmed', greatest(0, least(coalesce((p ->> 'confirmed')::int, 3), 1000)),
    'signup', greatest(0, least(coalesce((p ->> 'signup')::int, 5), 1000)),
    'return_days', greatest(1, least(coalesce((p ->> 'return_days')::int, 45), 365)))
$$;

-- ---------------------------------------------------------------- cliente
create or replace function public.my_loyalty() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  total int;
  lvl jsonb;
  nxt jsonb;
  pos int;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('enabled', false); end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled then return jsonb_build_object('enabled', false); end if;

  total := app.loyalty_earned(me.client_id);
  lvl := app.loyalty_level(cfg.levels, total);
  nxt := app.loyalty_next_level(cfg.levels, total);

  select r.pos into pos from (
    select t.client_id, rank() over (order by t.pts desc) as pos from (
      select rm.client_id, app.loyalty_earned(rm.client_id) as pts
        from public.ranking_members rm where rm.clinic_id = me.clinic_id) t) r
   where r.client_id = me.client_id;

  return jsonb_build_object(
    'enabled', true,
    'points', app.loyalty_balance(me.client_id),
    'earned', total,
    'level', lvl,
    'next', case when nxt is null then null
                 else jsonb_build_object('name', nxt ->> 'name', 'min', (nxt ->> 'min')::int, 'remaining', (nxt ->> 'min')::int - total) end,
    'levels', cfg.levels,
    'badges', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', b.id, 'name', b.name, 'icon', b.icon, 'criteria', b.criteria, 'threshold', b.threshold,
                 'earned', cb.client_id is not null, 'earned_at', cb.earned_at,
                 'progress', case when cb.client_id is not null or b.criteria = 'manual' then null
                                  else least(app.badge_value(me.client_id, b.criteria, total), b.threshold) end)
               order by b.position, b.created_at), '[]')
                 from public.badges b
                 left join public.client_badges cb on cb.badge_id = b.id and cb.client_id = me.client_id
                where b.clinic_id = me.clinic_id and b.active),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('event', h.event, 'points', h.points, 'note', h.note, 'at', h.created_at)
                 order by h.created_at desc), '[]')
                  from (select event, points, note, created_at from public.loyalty_ledger
                         where client_id = me.client_id order by created_at desc limit 30) h),
    'ranking', jsonb_build_object(
      'enabled', cfg.ranking_enabled,
      'optin', exists (select 1 from public.ranking_members where client_id = me.client_id),
      'nickname', (select nickname from public.ranking_members where client_id = me.client_id),
      'position', pos));
end $$;

-- ranking da clínica: só apelido, posição e pontos; só para quem entrou nele
create or replace function public.loyalty_ranking() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return '[]'::jsonb; end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled or not cfg.ranking_enabled then return '[]'::jsonb; end if;
  if not exists (select 1 from public.ranking_members where client_id = me.client_id) then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('position', r.pos, 'nickname', r.nickname, 'points', r.pts, 'me', r.client_id = me.client_id)
             order by r.pos, r.nickname), '[]')
      from (
        select t.client_id, t.nickname, t.pts, rank() over (order by t.pts desc) as pos from (
          select rm.client_id, rm.nickname, app.loyalty_earned(rm.client_id) as pts
            from public.ranking_members rm where rm.clinic_id = me.clinic_id) t) r
       where r.pos <= 20 or r.client_id = me.client_id);
end $$;

create or replace function public.set_ranking_optin(p_optin boolean, p_nickname text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  nick text := trim(coalesce(p_nickname, ''));
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if not p_optin then
    delete from public.ranking_members where client_id = me.client_id;
    return jsonb_build_object('ok', true);
  end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled or not cfg.ranking_enabled then return jsonb_build_object('ok', false, 'reason', 'ranking_desligado'); end if;
  if nick !~ '^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._-]{1,23}$' then return jsonb_build_object('ok', false, 'reason', 'apelido_invalido'); end if;
  begin
    insert into public.ranking_members (client_id, clinic_id, nickname) values (me.client_id, me.clinic_id, nick)
    on conflict (client_id) do update set nickname = excluded.nickname;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'apelido_em_uso');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- gestora
create or replace function public.loyalty_admin() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  cfg public.loyalty_config;
  clinic uuid := app.clinic_id();
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = clinic;
  return jsonb_build_object(
    'ok', true,
    'config', jsonb_build_object(
      'enabled', coalesce(cfg.enabled, false),
      'ranking_enabled', coalesce(cfg.ranking_enabled, false),
      'points', coalesce(cfg.points, '{"session_done":10,"first_visit":20,"return_on_time":10,"confirmed":3,"signup":5,"return_days":45}'::jsonb),
      'levels', coalesce(cfg.levels, '[{"id":"bronze","name":"Bronze","min":0},{"id":"prata","name":"Prata","min":100},{"id":"ouro","name":"Ouro","min":300},{"id":"diamante","name":"Diamante","min":700}]'::jsonb)),
    'badges', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', b.id, 'name', b.name, 'icon', b.icon, 'criteria', b.criteria, 'threshold', b.threshold, 'active', b.active,
                 'earned_by', (select count(*) from public.client_badges cb where cb.badge_id = b.id))
               order by b.position, b.created_at), '[]')
                 from public.badges b where b.clinic_id = clinic),
    'overview', (
      with pts as (
        select c.id as client_id, c.name, app.loyalty_earned(c.id) as total
          from public.clients c where c.clinic_id = clinic)
      select jsonb_build_object(
        'clients', (select count(*) from pts),
        'participants', (select count(*) from pts where total > 0),
        'points_issued', coalesce((select sum(points) from public.loyalty_ledger where clinic_id = clinic and points > 0), 0),
        'ranking_members', (select count(*) from public.ranking_members where clinic_id = clinic),
        'top', (select coalesce(jsonb_agg(jsonb_build_object('client_id', t.client_id, 'name', t.name, 'points', t.total)
                  order by t.total desc, t.name), '[]')
                  from (select * from pts where total > 0 order by total desc, name limit 10) t))));
end $$;

create or replace function public.save_loyalty_config(p_enabled boolean, p_ranking boolean, p_points jsonb, p_levels jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare clinic uuid := app.clinic_id();
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  insert into public.loyalty_config (clinic_id, enabled, ranking_enabled, points, levels)
  values (clinic, coalesce(p_enabled, false), coalesce(p_ranking, false), app.clean_points(coalesce(p_points, '{}')), app.clean_levels(p_levels))
  on conflict (clinic_id) do update set
    enabled = excluded.enabled, ranking_enabled = excluded.ranking_enabled,
    points = excluded.points, levels = excluded.levels, updated_at = now();
  if coalesce(p_enabled, false) then perform app.loyalty_seed(clinic); end if;
  if not coalesce(p_ranking, false) then
    delete from public.ranking_members where clinic_id = clinic;
  end if;
  perform app.log(clinic, 'gestor', auth.uid(), 'cadastro', null, 'Alterou o programa de fidelidade');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.save_badge(p_id uuid, p_name text, p_icon text, p_criteria text, p_threshold int, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  nm text := left(trim(coalesce(p_name, '')), 40);
  ic text := case when coalesce(p_icon, '') in ('Star','Trophy','Medal','Crown','Heart','Flame','Gift','Award','Sparkles','Gem') then p_icon else 'Star' end;
  cr text := coalesce(p_criteria, 'manual');
  th int := greatest(0, least(coalesce(p_threshold, 0), 100000));
  new_id uuid;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'reason', 'nome_vazio'); end if;
  if cr not in ('sessions_count', 'confirmed_count', 'points_total', 'streak', 'manual') then return jsonb_build_object('ok', false, 'reason', 'criterio_invalido'); end if;
  if cr <> 'manual' and th = 0 then return jsonb_build_object('ok', false, 'reason', 'limite_invalido'); end if;
  if p_id is null then
    if (select count(*) from public.badges where clinic_id = clinic) >= 30 then return jsonb_build_object('ok', false, 'reason', 'limite_de_selos'); end if;
    insert into public.badges (clinic_id, name, icon, criteria, threshold, active, position)
    values (clinic, nm, ic, cr, th, coalesce(p_active, true), coalesce((select max(position) from public.badges where clinic_id = clinic), 0) + 1)
    returning id into new_id;
  else
    update public.badges set name = nm, icon = ic, criteria = cr, threshold = th, active = coalesce(p_active, true)
     where id = p_id and clinic_id = clinic returning id into new_id;
    if new_id is null then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.delete_badge(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  delete from public.badges where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- entrega um selo "manual" (ex.: Embaixadora) a uma cliente
create or replace function public.grant_badge(p_badge uuid, p_client uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  b public.badges;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into b from public.badges where id = p_badge and clinic_id = clinic;
  if not found or not exists (select 1 from public.clients where id = p_client and clinic_id = clinic) then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;
  insert into public.client_badges (badge_id, client_id) values (b.id, p_client) on conflict do nothing;
  perform app.notify_client(clinic, p_client, 'reward', 'Novo selo: ' || b.name,
    'A clínica te deu o selo ' || b.name || '.', '/cliente/conquistas', 'badge:' || b.id);
  return jsonb_build_object('ok', true);
end $$;

-- ajuste manual de pontos (com motivo), registrado no histórico
create or replace function public.award_manual(p_client uuid, p_points int, p_note text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  note text := left(trim(coalesce(p_note, '')), 120);
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if coalesce(p_points, 0) = 0 or abs(p_points) > 1000 then return jsonb_build_object('ok', false, 'reason', 'pontos_invalidos'); end if;
  if not exists (select 1 from public.clients where id = p_client and clinic_id = clinic) then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;
  if not coalesce((select enabled from public.loyalty_config where clinic_id = clinic), false) then
    return jsonb_build_object('ok', false, 'reason', 'programa_desligado');
  end if;
  perform app.award(clinic, p_client, 'manual', p_points, null, 'manual:' || gen_random_uuid(), nullif(note, ''));
  perform app.log(clinic, 'gestor', auth.uid(), 'cadastro', p_client, 'Ajustou pontos de fidelidade: ' || p_points);
  return jsonb_build_object('ok', true);
end $$;

-- calcula os pontos do que já aconteceu (atendimentos finalizados e cadastros), sem duplicar
create or replace function public.loyalty_backfill() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  cfg public.loyalty_config;
  s record;
  before_ int;
  after_ int;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = clinic;
  if not found or not cfg.enabled then return jsonb_build_object('ok', false, 'reason', 'programa_desligado'); end if;
  before_ := (select count(*) from public.loyalty_ledger where clinic_id = clinic);
  for s in select id from public.sessions where clinic_id = clinic and status = 'done' order by finished_at, id loop
    perform app.award_session(s.id);
  end loop;
  for s in select p.clinic_id, p.client_id from public.profiles p where p.clinic_id = clinic and p.role = 'cliente' and p.client_id is not null loop
    perform app.award(clinic, s.client_id, 'signup', coalesce((cfg.points ->> 'signup')::int, 0), null, 'signup', 'cadastro');
  end loop;
  after_ := (select count(*) from public.loyalty_ledger where clinic_id = clinic);
  return jsonb_build_object('ok', true, 'created', after_ - before_);
end $$;

revoke all on function app.clean_levels(jsonb), app.clean_points(jsonb) from public, anon, authenticated;
revoke execute on function public.my_loyalty(), public.loyalty_ranking(), public.set_ranking_optin(boolean, text),
  public.loyalty_admin(), public.save_loyalty_config(boolean, boolean, jsonb, jsonb),
  public.save_badge(uuid, text, text, text, int, boolean), public.delete_badge(uuid), public.grant_badge(uuid, uuid),
  public.award_manual(uuid, int, text), public.loyalty_backfill() from public, anon;
grant execute on function public.my_loyalty(), public.loyalty_ranking(), public.set_ranking_optin(boolean, text),
  public.loyalty_admin(), public.save_loyalty_config(boolean, boolean, jsonb, jsonb),
  public.save_badge(uuid, text, text, text, int, boolean), public.delete_badge(uuid), public.grant_badge(uuid, uuid),
  public.award_manual(uuid, int, text), public.loyalty_backfill() to authenticated;
-- Prêmios e resgate: a gestora cria os prêmios (custo em pontos); a cliente pede o resgate no app e a gestora
-- aprova, recusa e marca como entregue. Os pontos só saem do saldo quando a gestora aprova. Pode ser rodada mais de uma vez.

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  cost int not null check (cost > 0 and cost <= 1000000),
  valid_until date,
  quantity int check (quantity is null or quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  reward_name text not null,
  cost int not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'entregue', 'cancelado')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create unique index if not exists redemptions_one_pending on public.redemptions (client_id, reward_id) where status = 'pendente';
create index if not exists redemptions_clinic on public.redemptions (clinic_id, status, requested_at desc);

alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
grant select on public.rewards, public.redemptions to authenticated;
drop policy if exists rewards_gestor on public.rewards;
create policy rewards_gestor on public.rewards for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());
drop policy if exists redemptions_gestor on public.redemptions;
create policy redemptions_gestor on public.redemptions for select to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor());

-- saldo que ainda pode ser gasto: saldo menos o que está em pedidos pendentes
create or replace function app.loyalty_available(p_client uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select app.loyalty_balance(p_client) - coalesce((select sum(cost) from public.redemptions where client_id = p_client and status = 'pendente'), 0)::int
$$;
revoke all on function app.loyalty_available(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- cliente
create or replace function public.my_rewards() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  avail int;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('enabled', false); end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled then return jsonb_build_object('enabled', false); end if;
  avail := app.loyalty_available(me.client_id);
  return jsonb_build_object(
    'enabled', true,
    'available', avail,
    'rewards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'description', r.description, 'cost', r.cost, 'valid_until', r.valid_until,
        'remaining', case when r.quantity is null then null
                          else greatest(0, r.quantity - (select count(*) from public.redemptions x where x.reward_id = r.id and x.status in ('pendente', 'aprovado', 'entregue'))) end,
        'pending', exists (select 1 from public.redemptions x where x.reward_id = r.id and x.client_id = me.client_id and x.status = 'pendente'),
        'can_redeem', avail >= r.cost) order by r.cost, r.name), '[]')
        from public.rewards r
       where r.clinic_id = me.clinic_id and r.active
         and (r.valid_until is null or r.valid_until >= (now() at time zone 'America/Sao_Paulo')::date)
         and (r.quantity is null or r.quantity > (select count(*) from public.redemptions x where x.reward_id = r.id and x.status in ('pendente', 'aprovado', 'entregue')))),
    'requests', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'reward', x.reward_name, 'cost', x.cost, 'status', x.status, 'at', x.requested_at)
               order by x.requested_at desc), '[]')
        from (select * from public.redemptions where client_id = me.client_id order by requested_at desc limit 20) x));
end $$;

create or replace function public.request_redeem(p_reward uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.profiles;
  cfg public.loyalty_config;
  r public.rewards;
  c public.clients;
  new_id uuid;
  used int;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into cfg from public.loyalty_config where clinic_id = me.clinic_id;
  if not found or not cfg.enabled then return jsonb_build_object('ok', false, 'reason', 'programa_desligado'); end if;
  select * into r from public.rewards where id = p_reward and clinic_id = me.clinic_id and active for update;
  if not found or (r.valid_until is not null and r.valid_until < (now() at time zone 'America/Sao_Paulo')::date) then
    return jsonb_build_object('ok', false, 'reason', 'premio_indisponivel');
  end if;
  if r.quantity is not null then
    select count(*) into used from public.redemptions where reward_id = r.id and status in ('pendente', 'aprovado', 'entregue');
    if used >= r.quantity then return jsonb_build_object('ok', false, 'reason', 'premio_esgotado'); end if;
  end if;
  if app.loyalty_available(me.client_id) < r.cost then return jsonb_build_object('ok', false, 'reason', 'pontos_insuficientes'); end if;
  begin
    insert into public.redemptions (clinic_id, client_id, reward_id, reward_name, cost)
    values (me.clinic_id, me.client_id, r.id, r.name, r.cost) returning id into new_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'ja_pedido');
  end;
  select * into c from public.clients where id = me.client_id;
  perform app.notify_clinic(me.clinic_id, array['gestor'], 'redeem', 'Pedido de resgate',
    split_part(c.name, ' ', 1) || ' quer resgatar ' || r.name || ' (' || r.cost || ' pontos)',
    '/fidelidade?aba=premios', 'redeem:' || new_id);
  perform app.log(me.clinic_id, 'cliente', me.id, 'cadastro', me.client_id, 'Pediu o resgate de ' || r.name);
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.cancel_my_redeem(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active and role = 'cliente' and client_id is not null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  update public.redemptions set status = 'cancelado', decided_at = now()
   where id = p_id and client_id = me.client_id and status = 'pendente';
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- gestora
create or replace function public.rewards_admin() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare clinic uuid := app.clinic_id();
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  return jsonb_build_object(
    'ok', true,
    'rewards', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'name', r.name, 'description', r.description, 'cost', r.cost,
                  'valid_until', r.valid_until, 'quantity', r.quantity, 'active', r.active,
                  'used', (select count(*) from public.redemptions x where x.reward_id = r.id and x.status in ('pendente', 'aprovado', 'entregue')))
                order by r.cost, r.name), '[]')
                  from public.rewards r where r.clinic_id = clinic),
    'redemptions', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', x.id, 'client_id', x.client_id, 'client', c.name, 'reward', x.reward_name, 'cost', x.cost,
                  'status', x.status, 'at', x.requested_at, 'decided_at', x.decided_at,
                  'balance', app.loyalty_balance(x.client_id))
                order by (x.status = 'pendente') desc, x.requested_at desc), '[]')
                  from (select * from public.redemptions where clinic_id = clinic order by (status = 'pendente') desc, requested_at desc limit 60) x
                  join public.clients c on c.id = x.client_id));
end $$;

create or replace function public.save_reward(
  p_id uuid, p_name text, p_description text, p_cost int, p_valid_until date, p_quantity int, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  nm text := left(trim(coalesce(p_name, '')), 60);
  new_id uuid;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'reason', 'nome_vazio'); end if;
  if coalesce(p_cost, 0) <= 0 or p_cost > 1000000 then return jsonb_build_object('ok', false, 'reason', 'custo_invalido'); end if;
  if p_quantity is not null and p_quantity < 0 then return jsonb_build_object('ok', false, 'reason', 'quantidade_invalida'); end if;
  if p_id is null then
    if (select count(*) from public.rewards where clinic_id = clinic) >= 50 then return jsonb_build_object('ok', false, 'reason', 'limite_de_premios'); end if;
    insert into public.rewards (clinic_id, name, description, cost, valid_until, quantity, active)
    values (clinic, nm, left(trim(coalesce(p_description, '')), 240), p_cost, p_valid_until, p_quantity, coalesce(p_active, true))
    returning id into new_id;
  else
    update public.rewards set name = nm, description = left(trim(coalesce(p_description, '')), 240), cost = p_cost,
           valid_until = p_valid_until, quantity = p_quantity, active = coalesce(p_active, true)
     where id = p_id and clinic_id = clinic returning id into new_id;
    if new_id is null then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.delete_reward(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  if exists (select 1 from public.redemptions where reward_id = p_id and status in ('pendente', 'aprovado')) then
    return jsonb_build_object('ok', false, 'reason', 'tem_pedidos_abertos');
  end if;
  delete from public.rewards where id = p_id and clinic_id = app.clinic_id();
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- aprovar (tira os pontos), recusar, marcar como entregue ou cancelar um aprovado (devolve os pontos)
create or replace function public.decide_redeem(p_id uuid, p_decision text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  clinic uuid := app.clinic_id();
  x public.redemptions;
begin
  if not app.is_gestor() then return jsonb_build_object('ok', false, 'reason', 'sem_permissao'); end if;
  select * into x from public.redemptions where id = p_id and clinic_id = clinic for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;

  if p_decision = 'aprovar' and x.status = 'pendente' then
    if app.loyalty_balance(x.client_id) < x.cost then return jsonb_build_object('ok', false, 'reason', 'pontos_insuficientes'); end if;
    insert into public.loyalty_ledger (clinic_id, client_id, event, points, ref_id, idem_key, note)
    values (clinic, x.client_id, 'redeem', -x.cost, x.id, 'redeem:' || x.id, 'resgate: ' || x.reward_name)
    on conflict (client_id, idem_key) do nothing;
    update public.redemptions set status = 'aprovado', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Resgate aprovado',
      x.reward_name || ' foi aprovado. Combine a entrega com a clínica.', '/cliente/conquistas', 'redeem-ok:' || x.id);
  elsif p_decision = 'recusar' and x.status = 'pendente' then
    update public.redemptions set status = 'recusado', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Resgate não aprovado',
      'Seu pedido de ' || x.reward_name || ' não foi aprovado. Seus pontos continuam com você.', '/cliente/conquistas', 'redeem-no:' || x.id);
  elsif p_decision = 'entregar' and x.status = 'aprovado' then
    update public.redemptions set status = 'entregue', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Prêmio entregue',
      x.reward_name || ' foi entregue. Aproveite!', '/cliente/conquistas', 'redeem-done:' || x.id);
  elsif p_decision = 'cancelar' and x.status = 'aprovado' then
    delete from public.loyalty_ledger where client_id = x.client_id and idem_key = 'redeem:' || x.id;
    update public.redemptions set status = 'cancelado', decided_at = now(), decided_by = auth.uid() where id = x.id;
    perform app.notify_client(clinic, x.client_id, 'redeem', 'Resgate cancelado',
      'O resgate de ' || x.reward_name || ' foi cancelado e seus pontos voltaram.', '/cliente/conquistas', 'redeem-cancel:' || x.id);
  else
    return jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  end if;
  perform app.log(clinic, 'gestor', auth.uid(), 'cadastro', x.client_id, 'Resgate ' || p_decision || ': ' || x.reward_name);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.my_rewards(), public.request_redeem(uuid), public.cancel_my_redeem(uuid),
  public.rewards_admin(), public.save_reward(uuid, text, text, int, date, int, boolean), public.delete_reward(uuid),
  public.decide_redeem(uuid, text) from public, anon;
grant execute on function public.my_rewards(), public.request_redeem(uuid), public.cancel_my_redeem(uuid),
  public.rewards_admin(), public.save_reward(uuid, text, text, int, date, int, boolean), public.delete_reward(uuid),
  public.decide_redeem(uuid, text) to authenticated;
