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
