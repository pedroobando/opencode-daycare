# SPEC 06 (DB) — Columnas `sent_at` y `last_send_error` en `public.invitations`

> **Estado:** Aprobado
> **Folder:** `specs/dbase/` (DB-06)
> **Depende de:** DB-05 (`public.invitations` + RLS)
> **Fecha:** 2026-08-26
> **Objetivo:** Agregar dos columnas nullable a `public.invitations` (`sent_at timestamptz` y `last_send_error text`) para auditar el envío del email de invitación vía Resend (SPEC 11), sin tocar RLS ni policies.

## Por qué este spec existe

SPEC 11 cierra el flujo de email: cuando `createInvitation` inserta una fila, intenta enviar el email vía Resend. Necesitamos registrar si el envío fue exitoso (`sent_at`) y, en caso contrario, el último mensaje de error (`last_send_error`) para depurar y habilitar un futuro botón "Reenviar invitación".

Mantener la auditoría en la propia tabla `invitations` evita crear una tabla auxiliar `invitation_send_log` que duplicaría el `id` y obligaría a joins. Como las columnas son nullable y no se filtran por ellas en las policies vigentes, no hace falta tocar RLS.

## Alcance

**Incluye:**

- ALTER TABLE `public.invitations` con dos columnas nullable: `sent_at timestamptz`, `last_send_error text`.
- Comentarios `comment on column` para documentar el contrato.
- Regeneración de `database.types.ts` para que `invitations.Row` incluya ambas columnas.
- Migración limpia en `supabase/migrations/<timestamp>_add_invitation_email_audit.sql`.

**Fuera de alcance:**

- Cambiar policies (las vigentes — 2 SELECT + 1 INSERT + 1 UPDATE — cubren cualquier SELECT/INSERT/UPDATE sobre las columnas nuevas porque las policies son a nivel tabla).
- Índices sobre `sent_at` o `last_send_error` (no se filtra por ellas en queries de MVP; el dashboard de Resend es la fuente de auditoría primaria).
- Trigger que setee `sent_at` automáticamente (lo hace el server action tras el envío OK).
- Backfill de invitaciones pre-existentes (`sent_at` queda NULL; correcto porque no se enviaron por email antes de SPEC 11).

## Modelo de datos

DDL exacto:

```sql
-- supabase/migrations/<timestamp>_add_invitation_email_audit.sql

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
```

Notas:

- `if not exists` permite aplicar la migración en un proyecto donde las columnas ya existan (idempotencia).
- No se agregan índices: ningún query de MVP filtra por `sent_at` ni `last_send_error`.
- Grants: `authenticated` ya tiene SELECT/INSERT/UPDATE sobre `invitations` (DB-05 §Plan paso 5). No requiere cambio.
- `ADD COLUMN` sin DEFAULT no toma lock exclusivo en Postgres ≥ 11.

## Plan de implementación

1. Cargar la skill `supabase` antes de tocar DB.
2. Validar precondiciones:
   - `select 1 from public.invitations limit 1;` debe devolver ≥ 0 filas.
   - `select count(*) from public.pg_policy where polrelid = 'public.invitations'::regclass;` debe devolver `4`.
3. Aplicar DDL con `execute_sql` (MCP) en una sola sentencia.
4. Verificar:
   - `select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'invitations' and column_name in ('sent_at', 'last_send_error');` → 2 filas con `is_nullable = 'YES'`.
5. Regenerar `database.types.ts` (MCP `generate_typescript_types`). Confirmar que `invitations.Row` incluye `sent_at: string | null` y `last_send_error: string | null`.
6. `get_advisors` (MCP) security + performance. Resolver cualquier ERROR nuevo.
7. Commitear `supabase/migrations/<timestamp>_add_invitation_email_audit.sql` + `database.types.ts` regenerado.

## Criterios de aceptación

- [ ] Existe `specs/dbase/06-invitations-sent-at-and-error.md` en estado `Borrador` que avanza a `Aprobado` / `Implementado`.
- [ ] Existe `supabase/migrations/<timestamp>_add_invitation_email_audit.sql` commiteado con el DDL de §Modelo de datos.
- [ ] Las 2 columnas existen en `public.invitations` con `is_nullable = 'YES'`.
- [ ] `database.types.ts` regenerado: `invitations.Row` incluye `sent_at: string | null` y `last_send_error: string | null`.
- [ ] `select count(*) from public.pg_policy where polrelid = 'public.invitations'::regclass;` sigue siendo `4`.
- [ ] `get_advisors` (MCP) sin ERRORs nuevos.
- [ ] `git log -1 -- supabase/migrations/` muestra el commit con la migración.

## Decisiones tomadas y descartadas

- **Sí: dos columnas en `invitations`, sin tabla auxiliar.** Mantiene el modelo simple.
- **No: tabla `invitation_send_log` con historial completo.** Sobreingeniería; el dashboard de Resend guarda cada intento.
- **Sí: `last_send_error` se sobrescribe en cada intento.** Solo guardamos el último mensaje, no el historial.
- **No: índice sobre `sent_at`.** El query "listar invitaciones sin email enviado" sería raro y de baja cardinalidad.
- **Sí: `if not exists` en las dos columnas.** Idempotencia frente a re-aplicación accidental.
- **No: backfill de invitaciones pre-existentes.** No se enviaron por email antes de este spec; `sent_at = NULL` es la verdad.
- **No: trigger `BEFORE INSERT` que setee `sent_at = now()`.** El INSERT inicial es antes del envío; `sent_at` lo setea el server action después del `resend.emails.send()` OK.
- **No: tocar policies existentes.** Las policies son a nivel tabla.

## Riesgos identificados

| Riesgo                                                                                    | Mitigación                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ADD COLUMN` lockea la tabla en producción                                                | `ADD COLUMN` sin DEFAULT no toma lock exclusivo en Postgres ≥ 11. Validar con `lock_timeout` o aplicar en horario de bajo tráfico.    |
| `last_send_error` acumula texto sensible (PII del padre)                                  | El texto proviene de la API de Resend; no debería incluir datos del padre. Si llega a incluir, sanitizar en SPEC 11 antes del UPDATE. |
| Regenerar `database.types.ts` introduce cambios que rompen el typecheck en otros archivos | Commitear el archivo regenerado y correr `npx tsc --noEmit`. Si hay errores en consumidores, ajustar antes de commitear.              |

## Qué **no** entra en este spec

- Cambios en policies o grants.
- Índices sobre las columnas nuevas.
- Trigger que autocompleta `sent_at`.
- Backfill de filas pre-existentes.
- Tabla auxiliar de historial de envíos.
- Integración real con Resend (SPEC 11).
- Botón "Reenviar invitación" en la UI (futuro spec).
- Webhooks de Resend.

## Resultados de verificación

_(Se completa después de implementar.)_
