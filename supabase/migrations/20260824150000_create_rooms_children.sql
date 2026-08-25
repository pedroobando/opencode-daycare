-- supabase/migrations/20260824150000_create_rooms_children.sql
--
-- Crea las tablas `public.rooms` (salas de la guardería) y `public.children`
-- (niños inscritos), el ENUM `public.child_status`, índices, triggers
-- `set_updated_at`, RLS con SELECT abierto a `authenticated`, y siembra 3
-- salas semilla (`Soles`, `Lunitas`, `Estrellitas`) en `Sala Soles`.
--
-- Depends on: SPEC DB-01 (`public.daycares`), SPEC DB-02 (`public.set_updated_at`).

-- 1. ENUM child_status
create type public.child_status as enum ('active', 'archived');

-- 2. Tabla rooms
create table if not exists public.rooms (
  id          uuid        primary key default gen_random_uuid(),
  daycare_id  uuid        not null references public.daycares(id) on delete restrict,
  name        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rooms_daycare_id_idx on public.rooms (daycare_id);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

drop policy if exists rooms_select_authenticated on public.rooms;
create policy rooms_select_authenticated
  on public.rooms
  for select
  to authenticated
  using (true);

-- 3. Tabla children
create table if not exists public.children (
  id             uuid                 primary key default gen_random_uuid(),
  room_id        uuid                 not null references public.rooms(id) on delete restrict,
  full_name      text                 not null,
  birth_date     date                 not null,
  enrolled_at    date                 not null default current_date,
  medical_notes  text,
  allergy_tags   text[]               not null default '{}',
  photo_consent  boolean              not null default true,
  status         public.child_status  not null default 'active',
  created_at     timestamptz          not null default now(),
  updated_at     timestamptz          not null default now()
);

create index if not exists children_room_id_idx on public.children (room_id);
create index if not exists children_status_idx  on public.children (status);

drop trigger if exists children_set_updated_at on public.children;
create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

alter table public.children enable row level security;

drop policy if exists children_select_authenticated on public.children;
create policy children_select_authenticated
  on public.children
  for select
  to authenticated
  using (true);

-- 4. Seed: 3 salas en Sala Soles
do $$
declare
  v_sala_soles_id uuid;
begin
  select id into v_sala_soles_id from public.daycares where name = 'Sala Soles';
  if v_sala_soles_id is null then
    raise exception 'create_rooms_children: Sala Soles daycare no existe (requerida para seed)';
  end if;

  insert into public.rooms (daycare_id, name) values
    (v_sala_soles_id, 'Soles'),
    (v_sala_soles_id, 'Lunitas'),
    (v_sala_soles_id, 'Estrellitas');
end $$;

-- Sin policies de INSERT/UPDATE/DELETE: escritura denegada por defecto.
-- Se agregan policies por rol staff/admin en un spec posterior.
