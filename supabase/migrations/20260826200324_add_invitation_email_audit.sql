-- supabase/migrations/20260826200324_add_invitation_email_audit.sql
--
-- SPEC 06 (DB) — Columnas `sent_at` y `last_send_error` en `public.invitations`.
-- SPEC 11 usa estas columnas para auditar el envío del email vía Resend y
-- registrar el último mensaje de error. No se tocan policies: como las nuevas
-- columnas son nullable y las policies son a nivel tabla, las 4 policies
-- vigentes (DB-05) siguen cubriendo SELECT/INSERT/UPDATE sin cambios.

-- ============================================================
-- Auditoría del envío del email de invitación vía Resend (SPEC 11).
-- ============================================================

alter table public.invitations
  add column if not exists sent_at timestamptz,
  add column if not exists last_send_error text;

comment on column public.invitations.sent_at is
  'Timestamp del envío exitoso del email vía Resend. NULL si nunca se intentó o si el último envío falló.';
comment on column public.invitations.last_send_error is
  'Último mensaje de error devuelto por Resend al intentar enviar el email. NULL si nunca se intentó o si el último envío fue OK.';
