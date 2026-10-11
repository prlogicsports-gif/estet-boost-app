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
