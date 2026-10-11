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
  total := coalesce((select sum(points) from public.loyalty_ledger where client_id = p_client), 0);

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
  total := coalesce((select sum(points) from public.loyalty_ledger where client_id = p_client), 0);
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

revoke all on function app.loyalty_level(jsonb, int), app.loyalty_next_level(jsonb, int), app.client_streak(uuid),
  app.badge_value(uuid, text, int), app.loyalty_seed(uuid), app.loyalty_refresh(uuid, uuid),
  app.award(uuid, uuid, text, int, uuid, text, text), app.award_session(uuid),
  app.trg_loyalty_session(), app.trg_loyalty_session_delete(), app.trg_loyalty_confirm(), app.trg_loyalty_signup()
  from public, anon, authenticated;
