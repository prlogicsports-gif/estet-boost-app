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
