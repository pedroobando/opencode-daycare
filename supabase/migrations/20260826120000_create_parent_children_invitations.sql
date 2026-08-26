-- supabase/migrations/20260826120000_create_parent_children_invitations.sql
--
-- Tablas `public.parent_children` (vínculo padre ↔ niño con parentesco) y
-- `public.invitations` (códigos de invitación emitidos por staff), con los
-- ENUMs `relationship_type` y `invitation_status`, índices, trigger
-- `set_updated_at` en `invitations`, RLS habilitada, y policies alineadas al
-- patrón multi-tenant del proyecto (DB-04): SELECT para `authenticated` del
-- mismo daycare; INSERT/UPDATE/DELETE solo para `staff`/`admin` del daycare.
--
-- Grants: se revocan UPDATE sobre `parent_children` y DELETE sobre
-- `invitations` porque no hay policy que los habilite (defensa en profundidad).
-- El resto de grants por defecto de Supabase (SELECT/INSERT/DELETE sobre
-- `parent_children`, SELECT/INSERT/UPDATE sobre `invitations`) coincide con
-- las policies.
--
-- Depends on: SPEC DB-02 (`public.users`, ENUM `user_role`, funcion
--             `public.set_updated_at()`, extension `pgcrypto`),
--             SPEC DB-03 (`public.children`, `public.rooms`),
--             SPEC DB-04 (convencion de policies staff/admin por daycare).

-- ============================================================
-- 1. ENUMs
-- ============================================================

create type public.relationship_type as enum ('father','mother','guardian');
create type public.invitation_status  as enum ('pending','accepted','expired','cancelled');

-- ============================================================
-- 2. Tabla parent_children
-- ============================================================

create table if not exists public.parent_children (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid not null references public.users(id)    on delete cascade,
  child_id      uuid not null references public.children(id) on delete cascade,
  relationship  public.relationship_type not null,
  created_at    timestamptz not null default now(),
  constraint parent_children_parent_id_child_id_key unique (parent_id, child_id)
);

create index if not exists parent_children_parent_id_idx on public.parent_children (parent_id);
create index if not exists parent_children_child_id_idx  on public.parent_children (child_id);

alter table public.parent_children enable row level security;

drop policy if exists parent_children_select_same_daycare on public.parent_children;
create policy parent_children_select_same_daycare on public.parent_children
  for select to authenticated
  using (
    exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = parent_children.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  );

drop policy if exists parent_children_select_own on public.parent_children;
create policy parent_children_select_own on public.parent_children
  for select to authenticated
  using (parent_id = (select auth.uid()));

drop policy if exists parent_children_insert_staff_admin on public.parent_children;
create policy parent_children_insert_staff_admin on public.parent_children
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = parent_children.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  );

drop policy if exists parent_children_delete_staff_admin on public.parent_children;
create policy parent_children_delete_staff_admin on public.parent_children
  for delete to authenticated
  using (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = parent_children.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  );

-- Defensa en profundidad: no hay policy de UPDATE, no se otorga el grant.
revoke update on public.parent_children from authenticated;

-- ============================================================
-- 3. Tabla invitations
-- ============================================================

create table if not exists public.invitations (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.children(id) on delete cascade,
  invited_by    uuid not null references public.users(id)    on delete restrict,
  full_name     text not null,
  email         text not null,
  relationship  public.relationship_type not null,
  code          text not null unique,
  status        public.invitation_status not null default 'pending',
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists invitations_child_id_idx on public.invitations (child_id);
create index if not exists invitations_status_idx  on public.invitations (status);

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

alter table public.invitations enable row level security;

drop policy if exists invitations_select_staff_admin on public.invitations;
create policy invitations_select_staff_admin on public.invitations
  for select to authenticated
  using (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = invitations.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  );

drop policy if exists invitations_select_for_accept on public.invitations;
create policy invitations_select_for_accept on public.invitations
  for select to authenticated
  using (
    status = 'pending'
    and email = (auth.jwt() ->> 'email')
  );

drop policy if exists invitations_insert_staff_admin on public.invitations;
create policy invitations_insert_staff_admin on public.invitations
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = invitations.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  );

drop policy if exists invitations_update_staff_admin on public.invitations;
create policy invitations_update_staff_admin on public.invitations
  for update to authenticated
  using (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = invitations.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  )
  with check (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and exists (
      select 1 from public.children c
        join public.rooms r on r.id = c.room_id
      where c.id = invitations.child_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
  );

-- Defensa en profundidad: no hay policy de DELETE, no se otorga el grant.
revoke delete on public.invitations from authenticated;
