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
