create table if not exists public.daycares (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.daycares enable row level security;

drop policy if exists daycares_select_authenticated on public.daycares;
create policy daycares_select_authenticated
  on public.daycares
  for select
  to authenticated
  using (true);

-- Sin policies de INSERT/UPDATE/DELETE: escritura denegada por defecto.
-- Se agregan policies por rol admin en un spec posterior (post users.role=admin).

insert into public.daycares (name) values
  ('Sala Soles'),
  ('Sala Mariposas'),
  ('Sala Estrellitas'),
  ('Sala Arcoíris');
