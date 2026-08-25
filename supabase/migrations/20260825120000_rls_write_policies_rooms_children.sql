-- supabase/migrations/20260825120000_rls_write_policies_rooms_children.sql
--
-- Policies RLS de escritura (INSERT/UPDATE/DELETE) para `public.rooms` y
-- `public.children`: solo usuarios autenticados con rol 'staff' o 'admin'
-- miembros del mismo daycare. `parent` queda read-only.
--
-- Depends on: SPEC DB-03 (`public.rooms` / `public.children` con SELECT),
--             SPEC DB-02 (tabla `public.users` con ENUM `user_role`).

-- ============================================================
-- ROOMS — INSERT/UPDATE/DELETE para staff/admin del mismo daycare
-- ============================================================

drop policy if exists rooms_insert_staff_admin on public.rooms;
create policy rooms_insert_staff_admin on public.rooms
  for insert
  to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('staff','admin')
    and daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
  );

drop policy if exists rooms_update_staff_admin on public.rooms;
create policy rooms_update_staff_admin
  on public.rooms
  for update
  to authenticated
  using (
    daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  )
  with check (
    daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  );

drop policy if exists rooms_delete_staff_admin on public.rooms;
create policy rooms_delete_staff_admin
  on public.rooms
  for delete
  to authenticated
  using (
    daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  );

-- ============================================================
-- CHILDREN — INSERT/UPDATE/DELETE vía EXISTS sobre rooms
-- ============================================================

drop policy if exists children_insert_staff_admin on public.children;
create policy children_insert_staff_admin
  on public.children
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  );

drop policy if exists children_update_staff_admin on public.children;
create policy children_update_staff_admin
  on public.children
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  )
  with check (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  );

drop policy if exists children_delete_staff_admin on public.children;
create policy children_delete_staff_admin
  on public.children
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid()))
    )
    and (select role from public.users where id = (select auth.uid())) in ('staff','admin')
  );
