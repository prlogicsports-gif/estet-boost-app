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
