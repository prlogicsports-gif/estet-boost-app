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
