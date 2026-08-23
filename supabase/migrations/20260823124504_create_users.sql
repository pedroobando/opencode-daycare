-- supabase/migrations/20260823124504_create_users.sql
--
-- Crea la tabla `public.users` con sus ENUMs (`user_role`, `user_status`), FKs a
-- `auth.users` y `public.daycares`, índices, función genérica `set_updated_at`
-- + trigger, RLS con SELECT abierto a `authenticated` y UPDATE propio que
-- congela `daycare_id` y `role`, y trigger `AFTER INSERT` sobre `auth.users`
-- que crea la fila leyendo `daycare_id` / `role` / `full_name` desde
-- `raw_user_meta_data`.
--
-- Depends on: SPEC DB-01 (`public.daycares`).

-- 1. ENUMs
create type public.user_role   as enum ('staff', 'parent', 'admin');
create type public.user_status as enum ('pending', 'active');

-- 2. Tabla
create table if not exists public.users (
  id                     uuid               primary key references auth.users(id) on delete cascade,
  daycare_id             uuid               not null references public.daycares(id) on delete restrict,
  role                   public.user_role   not null,
  status                 public.user_status not null default 'active',
  full_name              text               not null,
  avatar_url             text,
  notify_on_post         boolean            not null default true,
  daily_summary_enabled  boolean            not null default true,
  created_at             timestamptz        not null default now(),
  updated_at             timestamptz        not null default now()
);

create index if not exists users_daycare_id_idx on public.users (daycare_id);
create index if not exists users_role_idx       on public.users (role);

-- 3. Trigger genérico de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- 4. RLS
alter table public.users enable row level security;

drop policy if exists users_select_authenticated on public.users;
create policy users_select_authenticated
  on public.users
  for select
  to authenticated
  using (true);

drop policy if exists users_update_self on public.users;
create policy users_update_self
  on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and daycare_id = (select u.daycare_id from public.users u where u.id = (select auth.uid()))
    and role       = (select u.role       from public.users u where u.id = (select auth.uid()))
  );

-- 5. Trigger handle_new_user sobre auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daycare_id uuid;
  v_role       public.user_role;
  v_full_name  text;
begin
  v_daycare_id := (new.raw_user_meta_data ->> 'daycare_id')::uuid;
  v_role       := (new.raw_user_meta_data ->> 'role')::public.user_role;
  v_full_name  := new.raw_user_meta_data ->> 'full_name';

  if v_daycare_id is null then
    raise exception 'handle_new_user: daycare_id is required in raw_user_meta_data';
  end if;
  if v_full_name is null or length(v_full_name) = 0 then
    raise exception 'handle_new_user: full_name is required in raw_user_meta_data';
  end if;

  insert into public.users (id, daycare_id, role, full_name)
  values (new.id, v_daycare_id, v_role, v_full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sin policies de INSERT/DELETE: solo el trigger crea filas.
-- Borrado va por cascade desde auth.users (FK ON DELETE CASCADE).
