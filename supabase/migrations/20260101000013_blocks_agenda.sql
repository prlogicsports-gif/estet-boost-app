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
