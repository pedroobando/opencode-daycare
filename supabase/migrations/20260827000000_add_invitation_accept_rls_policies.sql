-- supabase/migrations/20260827000000_add_invitation_accept_rls_policies.sql
--
-- SPEC 11 (fix durante verificación) — Las policies originales de
-- `public.invitations` y `public.parent_children` (DB-05 / SPEC 10) solo
-- permitían UPDATE/INSERT a `staff`/`admin` del mismo daycare. El flow de
-- aceptación de invitación lo dispara un padre recién firmado (rol
-- `parent`), por lo que `acceptInvitationByCode` fallaba silenciosamente:
--   - UPDATE `invitations.status = 'accepted'` denegado por RLS.
--   - INSERT en `parent_children` denegado por RLS.
-- Resultado: `public.users.status` quedaba en `active` pero la invitación
-- seguía en `pending` y el vínculo padre↔niño nunca se creaba.
--
-- Esta migration agrega dos policies permisivas que se suman (OR) a las
-- vigentes de staff/admin:
--
--   1. `invitations_update_for_accept`: el padre puede marcar su propia
--      invitación como `accepted`/`expired`/`cancelled` mientras esté
--      `pending` y el email del JWT coincida con el de la invitación.
--   2. `parent_children_insert_for_accept`: el padre puede vincularse a un
--      niño si existe una invitación `pending` dirigida a su email para
--      ese mismo niño y el `parent_id` que inserta es su propio `auth.uid`.
--
-- Mantener el patrón de "policy específica para el flow" (en lugar de
-- abrir las policies de staff) preserva el principio de menor privilegio.

-- ============================================================
-- 1. invitations: UPDATE para parent que acepta la invitación
-- ============================================================

drop policy if exists invitations_update_for_accept on public.invitations;
create policy invitations_update_for_accept on public.invitations
  for update to authenticated
  using (
    status = 'pending'
    and email = (auth.jwt() ->> 'email')
  )
  with check (
    status in ('accepted', 'expired', 'cancelled')
    and email = (auth.jwt() ->> 'email')
  );

-- ============================================================
-- 2. parent_children: INSERT para parent que acepta la invitación
-- ============================================================

drop policy if exists parent_children_insert_for_accept on public.parent_children;
create policy parent_children_insert_for_accept on public.parent_children
  for insert to authenticated
  with check (
    parent_id = (select auth.uid())
    and exists (
      select 1 from public.invitations i
      where i.email = (auth.jwt() ->> 'email')
        and i.status = 'pending'
        and i.child_id = parent_children.child_id
    )
  );
