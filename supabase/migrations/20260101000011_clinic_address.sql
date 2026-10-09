-- Endereço do estúdio: a gestora cadastra e a cliente toca para abrir no mapa. Pode ser rodada mais de uma vez.
alter table public.clinics add column if not exists address text;
grant update (address) on public.clinics to authenticated;
