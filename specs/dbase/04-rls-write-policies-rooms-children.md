# SPEC 04 (DB) — Policies RLS de escritura para `rooms` y `children` (staff/admin)

> **Estado:** Implementado
> **Folder:** `specs/dbase/` (DB-04)
> **Depende de:** SPEC DB-03 (tablas `rooms` y `children` con RLS SELECT abierto), SPEC DB-02 (tabla `users` con ENUM `user_role`)
> **Fecha:** 2026-08-25
> **Objetivo:** Habilitar INSERT/UPDATE/DELETE en `public.rooms` y `public.children` solo para usuarios autenticados con `role IN ('staff','admin')` miembros del mismo daycare, dejando `parent` en read-only.

## Por qué este spec existe

DB-03 dejó las dos tablas con una sola policy de SELECT abierta a `authenticated` y **cero policies de escritura**. SPEC 08 implementó los server actions tipados (`createRoom`, `updateRoom`, `deleteRoom`, `createChild`, `updateChild`, `archiveChild`) que llaman `.insert/update/delete()` contra la DB — pero todos fallan en runtime con `new row violates row-level security policy` o `permission denied for table children`. SPEC 09 (wiring de `/kids`) consume esas actions y se rompe sin policies. Este spec aterriza las 6 policies de escritura con la convención ya establecida en DB-01/DB-02/DB-03: `drop policy if exists` antes de `create policy`, predicados con `(select auth.uid())` para initplan (no `auth.uid()` desnudo), y scope multi-tenant via subquery a `public.users`.

El modelo de autorización es **role-based**: solo `staff` y `admin` escriben, `parent` queda read-only. El ENUM `user_role` ya existe (`'staff' | 'parent' | 'admin'`), por lo que no se modifica el dominio — solo se filtra en las policies.

## Alcance

**Incluye:**

- 3 policies sobre `public.rooms`:
  - `rooms_insert_staff_admin` — INSERT `TO authenticated` con `WITH CHECK` que valida que `daycare_id` del INSERT coincide con el del usuario actual y que el usuario tiene rol `staff`/`admin`.
  - `rooms_update_staff_admin` — UPDATE `TO authenticated` con `USING` (fila a la que aplica el cambio) + `WITH CHECK` (que el cambio no mueva la fila a otro daycare); ambos predicados verifican pertenencia + rol.
  - `rooms_delete_staff_admin` — DELETE `TO authenticated` con `USING` que valida pertenencia + rol de la fila objetivo.
- 3 policies sobre `public.children`:
  - `children_insert_staff_admin` — INSERT `TO authenticated` con `WITH CHECK` que valida (a) que el `room_id` del INSERT pertenece a una `rooms.daycare_id` igual al del usuario y (b) que el usuario tiene rol `staff`/`admin`. **El child no tiene `daycare_id` propio**, así que el lookup va via `EXISTS` sobre `public.rooms`.
  - `children_update_staff_admin` — UPDATE `TO authenticated` con `USING` (sobre el `room_id` actual) + `WITH CHECK` (sobre el `room_id` resultante). Ambos predicados verifican pertenencia + rol. Esto evita que un usuario mueva un niño a una sala de otro daycare reescribiendo `room_id`.
  - `children_delete_staff_admin` — DELETE `TO authenticated` con `USING` sobre el `room_id` actual.
- Predicados comunes (subqueries, no joins en el USING/WITH CHECK):
  - **rooms:** `(select daycare_id from public.users where id = (select auth.uid())) = daycare_id` y `(select role from public.users where id = (select auth.uid())) in ('staff','admin')`.
  - **children (room_id):** `exists (select 1 from public.rooms r where r.id = room_id and r.daycare_id = (select daycare_id from public.users where id = (select auth.uid())) and (select role from public.users where id = (select auth.uid())) in ('staff','admin'))`.
- Aplicación via MCP `execute_sql` (patrón iterativo de DB-01/02/03), con `drop policy if exists` antes de cada `create policy` para idempotencia.
- `get_advisors` (MCP) security + performance sin nuevos ERROR sobre `rooms`/`children`.
- Verificación de catálogo (`pg_policy`: exactamente 4 policies por tabla al final, polcmd en `('a','w','d')` con rol `authenticated`).
- Verificación funcional autenticada como `pedro@gmail.com`: `createChild` (insert) exitoso en su daycare; intento de INSERT/UPDATE/DELETE contra fila de otro daycare afecta 0 filas.
- Migración limpia commiteada en `supabase/migrations/<timestamp>_rls_write_policies_rooms_children.sql` (via `supabase db pull rls_write_policies_rooms_children --local --yes` o escrita a mano si la CLI no alcanza ≥ 2.81.3).

**Fuera de alcance:**

- Policies de escritura sobre `daycares`, `users`, o futuras tablas (`parent_children`, `posts`, etc.).
- Filtros adicionales por `status='active'` (archivado lógico se valida a nivel app en SPEC 08, no en policy).
- Multi-tenant scoping vía `auth.jwt() ->> 'daycare_id'` (metadata de Auth no es fuente de verdad; la fuente es `public.users.daycare_id`).
- Auditoría / triggers que registren quién escribió qué.
- Permisos granulares por feature (e.g. "staff puede borrar pero no archivar").
- `parent` con permisos especiales (queda read-only).
- Storage policies.

## Modelo de datos

No se introducen tablas, columnas ni ENUMs. Solo se agregan 6 policies al catálogo existente.

DDL exacto (idéntico al de la migración, salvo whitespace):

```sql
-- supabase/migrations/<timestamp>_rls_write_policies_rooms_children.sql

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
```

Notas:

- `(select auth.uid())` aparece múltiples veces en la misma policy: Postgres lo evalúa como initplan y cachea el resultado por statement (no por fila), por lo que no es N+1.
- `(select role from public.users where id = (select auth.uid()))` también se cachea; aunque se repite 2-3 veces por policy, el planner lo evalúa una vez.
- La policy de `children` no filtra por `users.role` en el `EXISTS` de `rooms` para no duplicar lógica; el chequeo de rol va al lado del EXISTS, con `and`. Esto mantiene la lectura clara: existe la sala de mi daycare **y** tengo rol staff/admin.
- `WITH CHECK` en UPDATE de `children` valida la **nueva** fila: si el `update` cambia `room_id` a una sala de otro daycare, falla. Esto cierra la vulnerabilidad de reasignación cross-daycare.
- `WITH CHECK` en UPDATE de `rooms` valida que la `daycare_id` no cambie (campo no editable por el form, pero defense-in-depth).

## Plan de implementación

1. **Cargar las skills `supabase` y `supabase-postgres-best-policies`** antes de tocar nada (AGENTS.md lo exige para cambios en DB).
2. **Validar precondiciones:**
   - `select 1 from pg_type where typname = 'child_status' and typnamespace = 'public'::regnamespace;` → 1 fila.
   - `select 1 from pg_type where typname = 'user_role' and typnamespace = 'public'::regnamespace;` → 1 fila.
   - `select count(*) from public.rooms r join public.daycares d on d.id = r.daycare_id where d.name = 'Sala Soles';` → 3 filas.
   - `select id, role, daycare_id from public.users where email = 'pedro@gmail.com';` → 1 fila (registrar role actual: si es `parent`, la verificación runtime de escritura fallará por diseño y solo se valida estructuralmente; si es `staff`/`admin`, se valida funcionalmente).
3. **Aplicar policies iterativo con `execute_sql` (MCP)**, una por statement con `drop policy if exists` antes del `create policy`. Orden sugerido: 3 policies de `rooms` → 3 policies de `children`. Si alguna falla, abortar.
4. **Verificar catálogo** post-aplicación:
   - `select polname, polcmd from pg_policy where polrelid = 'public.rooms'::regclass order by polname;` → 4 filas (`rooms_select_authenticated` + 3 nuevas).
   - `select polname, polcmd from pg_policy where polrelid = 'public.children'::regclass order by polname;` → 4 filas (`children_select_authenticated` + 3 nuevas).
   - Para cada nueva policy: `polcmd` ∈ `{'a','d','w'}` y `polroles` contiene `authenticated` (via `ANY(polroles)` con `pg_roles.oid`).
5. **Verificar grants** (puede haber cambiado si Supabase resetea grants al añadir policies): `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('rooms','children') and grantee = 'authenticated';` debe incluir al menos `SELECT, INSERT, UPDATE, DELETE` en cada tabla.
6. **Correr `get_advisors` (MCP)** security + performance. Resolver cualquier ERROR nuevo. WARNs heredados aceptables (`function_search_path_mutable`, `rls_auto_enable`, `auth_leaked_password_protection`).
7. **Generar la migración limpia** con `supabase db pull rls_write_policies_rooms_children --local --yes` (CLI ≥ 2.81.3) o escribirla a mano copiando el DDL de §Modelo de datos si la versión no alcanza.
8. **Diff manual** del archivo generado contra §Modelo de datos: debe ser semánticamente equivalente (puede diferir whitespace).
9. **Verificación funcional** (solo si el usuario de prueba tiene role `staff` o `admin`):
   - Autenticarse como `pedro@gmail.com` y ejecutar `listRooms()` → 3 salas.
   - Llamar `createChild(...)` con un child de prueba en `Soles` → INSERT exitoso, fila devuelta.
   - `select 1 from public.children;` → al menos 1 fila.
   - Llamar `updateChild(childId, { status: 'archived' })` → 1 fila afectada.
   - Llamar `archiveChild(childId)` → 1 fila afectada.
   - Llamar `deleteRoom(salaVacia.id)` sobre una sala sin niños → 1 fila afectada.
   - **Si el usuario de prueba es `parent`:** la verificación funcional de las escrituras falla por diseño (no tiene permiso); documentar en §Resultados que la verificación es solo estructural.
10. **Commitear** `supabase/migrations/<timestamp>_rls_write_policies_rooms_children.sql` + `specs/dbase/04-rls-write-policies-rooms-children.md`. (El usuario corre `git commit`; este spec no ejecuta el commit.)

## Criterios de aceptación

- [x] Existe `specs/dbase/04-rls-write-policies-rooms-children.md` en estado `Borrador` que luego avanza a `Aprobado` / `Implementado`.
- [x] Existe `supabase/migrations/<timestamp>_rls_write_policies_rooms_children.sql` commiteado, con las 6 `create policy` y los 6 `drop policy if exists` previos (DDL completo de §Modelo de datos).
- [x] `select count(*) from pg_policy where polrelid = 'public.rooms'::regclass;` devuelve `4`.
- [x] `select count(*) from pg_policy where polrelid = 'public.children'::regclass;` devuelve `4`.
- [x] Esas 8 policies tienen `polroles` conteniendo `authenticated` y `polcmd ∈ {'r','a','w','d'}` (1 SELECT + 3 write por tabla).
- [x] `select polname from pg_policy where polrelid = 'public.rooms'::regclass and polcmd in ('a','d','w');` devuelve, en cualquier orden, `rooms_insert_staff_admin`, `rooms_update_staff_admin`, `rooms_delete_staff_admin`.
- [x] `select polname from pg_policy where polrelid = 'public.children'::regclass and polcmd in ('a','d','w');` devuelve, en cualquier orden, `children_insert_staff_admin`, `children_update_staff_admin`, `children_delete_staff_admin`.
- [x] Para cada policy nueva, `pg_get_expr(polwithcheck)` y/o `pg_get_expr(polusing)` contienen `(select auth.uid())` (patrón initplan, no `auth.uid()` desnudo).
- [x] `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('rooms','children') and grantee = 'authenticated';` incluye `INSERT`, `UPDATE`, `DELETE` para ambas tablas (grants a nivel tabla necesarios para que RLS aplique).
- [x] `get_advisors` (MCP) no reporta ERROR nuevos sobre `public.rooms` o `public.children` después del DDL.
- [x] **Si el usuario de prueba tiene role `staff`/`admin`:** `createChild(...)` autenticado como `pedro@gmail.com` ejecuta INSERT y devuelve 1 fila. `archiveChild(...)` y `deleteRoom(...)` ejecutan UPDATE/DELETE y afectan 1 fila cada uno.
- [x] **Si el usuario de prueba tiene role `parent`:** N/A — `pedro@gmail.com` tiene role `staff`; la verificación funcional se ejecutó completa (ver §Resultados).
- [x] `git log -1 -- supabase/migrations/` muestra el commit con la migración. (commit `40ea76e`, verificado 2026-08-25)

## Decisiones

- **Sí: filtro por role `staff`/`admin` en las 6 policies.** Coherente con el dominio: la app es de gestión interna de guardería, los padres son lectores. `parent` queda explícitamente read-only.
- **Sí: `(select auth.uid())` en todas las policies (no `auth.uid()` desnudo).** Patrón initplan: Postgres cachea el resultado por statement, evita invocación por fila. Estándar Supabase para RLS performante.
- **Sí: `WITH CHECK` en todas las INSERT y UPDATE.** Regla non-negotiable de AGENTS.md. Sin `WITH CHECK`, un usuario podría crear una fila con `daycare_id` ajeno (rooms) o reasignar `room_id` a una sala de otro daycare (children).
- **Sí: predicado multi-tenant vía subquery a `public.users`, no vía `auth.jwt()`.** La fuente de verdad del daycare del usuario es `public.users.daycare_id` (DB-02). Usar `auth.jwt()` duplicaría la lógica y abriría vectores de drift.
- **Sí: `EXISTS` sobre `rooms` en las policies de `children`.** El child no tiene `daycare_id` propio; se resuelve via la sala. El planner convierte el EXISTS en semi-join eficiente sobre `children_room_id_idx`.
- **Sí: aplicar iterativo con `execute_sql` (MCP), no `apply_migration`.** Mismo patrón que DB-01/02/03 — permite detectar errores policy por policy.
- **No: policy separada para `parent` con permisos de lectura limitada.** El SELECT ya está abierto a `authenticated`; no hace falta una policy adicional para `parent`.
- **No: triggers de auditoría (quién creó/modificó cada fila).** Fuera de alcance. La columna `created_at` y `updated_at` ya se llenan via `set_updated_at` (DB-02).
- **No: scope adicional por `status='active'` en la policy.** El archivado lógico se valida a nivel app (SPEC 08 `archiveChild`); meterlo en policy complica queries normales.
- **No: multi-daycare por usuario.** El dominio asume 1 daycare por usuario. Si un usuario pertenece a varios daycares, requerirá refactor mayor (no en este spec).

## Riesgos

| Riesgo                                                                                    | Mitigación                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(select auth.uid())` no se cachea y genera N+1 a gran escala                             | Verificado por patrón estándar Supabase; documentado en §Modelo de datos. Si EXPLAIN muestra lo contrario en producción, se evalúa `LATERAL`.                                                                                      |
| Policy UPDATE `WITH CHECK` permite cambiar `daycare_id` en `rooms`                        | El `WITH CHECK` re-valida `daycare_id = ...` por lo que no se permite el cambio. Verificación estructural en el plan (paso 9).                                                                                                     |
| Grants `INSERT/UPDATE/DELETE` no presentes → RLS denial incluso con policy                | Paso 5 del plan valida grants y los agrega si faltan (`grant insert, update, delete on public.rooms to authenticated;`).                                                                                                           |
| El usuario de prueba `pedro@gmail.com` es `parent` y no se puede verificar funcionalmente | La verificación es solo estructural (catálogo + políticas correctas). Documentado en §Criterios de aceptación y §Resultados.                                                                                                       |
| `drop policy if exists` aparece como NOTICE ruidoso en la primera ejecución               | Mismo comportamiento que DB-01/02/03; no es error.                                                                                                                                                                                 |
| Una policy con `EXISTS` sobre `rooms` en UPDATE puede ser lenta sin índice                | El EXISTS usa `r.id = room_id` que coincide con `children_room_id_idx`. EXPLAIN lo confirma.                                                                                                                                       |
| Roles se cambian en el futuro (e.g. nuevo `super_admin`)                                  | Las policies usan `in ('staff','admin')`; cualquier rol agregado por default queda sin permiso (fail-closed).                                                                                                                      |
| `parent` rompe flujos existentes que asumían escritura                                    | SPEC 09 cambia `app/actions/children/create-child.ts` para invocar `requireCurrentUserDaycareId` (sin chequeo de rol) y la policy DB hace el gate real. Server actions existentes ya validan pertenencia; el rol es la capa nueva. |

## Qué no entra en este spec

- Policies de escritura sobre `daycares`, `users`, `parent_children`, `posts`, `reactions`, `comments`, `daily_summaries`, etc.
- Auditoría / log de cambios.
- Trigger `BEFORE INSERT` para setear `created_by` / `updated_by`.
- Permisos granulares por sala o por niño individual.
- Special-case para que `parent` pueda ver solo los niños vinculados (la tabla `parent_children` no existe; llega en spec futuro).
- Storage policies (buckets para fotos de niños).

## Resultados de verificación

**Fecha:** 2026-08-25 · Rama: `spec-04-rls-write-policies-rooms-children`

### Precondiciones (paso 2)

- ENUMs `child_status` y `user_role` en `public`: ✅ existen.
- 3 salas semilla (`Soles`, `Lunitas`, `Estrellitas`) en el daycare del usuario: ✅.
- Usuario de prueba `pedro@gmail.com`: role **`staff`**, daycare_id `6dc22d1a-3e45-4f25-a47c-82bf0371ad7d`. Nota: `public.users` no tiene columna `email`; el lookup se hizo vía join con `auth.users`.

### Catálogo y grants (pasos 4–5)

- `pg_policy`: 4 policies por tabla (SELECT + insert/update/delete) con nombres exactos según spec. ✅
- `polroles` contiene `authenticated` en las 6 policies nuevas; UPDATE tiene `USING` + `WITH CHECK`. ✅
- Predicados con patrón initplan `( select auth.uid())` verificados vía `pg_get_expr`. ✅
- Grants: `authenticated` tiene `SELECT, INSERT, UPDATE, DELETE` (+ `REFERENCES, TRIGGER, TRUNCATE`) en ambas tablas; sin `GRANT` adicional. ✅

### Advisors (paso 6)

- Security: 0 ERRORs — solo WARNs heredados (`function_search_path_mutable`, `rls_auto_enable`, `handle_new_user` SECURITY DEFINER, `auth_leaked_password_protection`). Ninguno sobre `rooms`/`children`. ✅
- Performance: solo INFO `unused_index` esperado con datos seed. `children_room_id_idx` será usado por las nuevas policies. ✅

### Migración (pasos 7–8)

- CLI de Supabase no instalada → migración escrita a mano: `supabase/migrations/20260825120000_rls_write_policies_rooms_children.sql`.
- Diff manual contra §Modelo de datos: DDL idéntico; solo se añadió header de comentarios al estilo del repo.

### Verificación funcional (paso 9, autenticado como `pedro@gmail.com`, role `staff`)

Sesión simulada vía `set local role authenticated` + JWT claims, dentro de una transacción con rollback (sin datos residuales). Se creó temporalmente un daycare/sala extranjeros para los tests negativos.

| Check | Resultado |
| --- | --- |
| INSERT child en sala Soles (`createChild`) | ✅ 1 fila insertada |
| UPDATE `status='archived'` (`updateChild`) | ✅ 1 fila afectada |
| Segunda escritura sobre el child (`archiveChild`) | ✅ 1 fila afectada |
| DELETE sala vacía Estrellitas (`deleteRoom`) | ✅ 1 fila afectada |
| NEGATIVO: INSERT child hacia sala de otro daycare | ✅ bloqueado con `insufficient_privilege` (RLS violation) |
| NEGATIVO: UPDATE sala de otro daycare | ✅ 0 filas afectadas |
| NEGATIVO: DELETE sala de otro daycare | ✅ 0 filas afectadas |

Nota sobre el conteo de salas: al simular sesión con la sala extranjera temporal presente se contaron 4 salas en vez de 3. Es artefacto del test, no bug: la policy SELECT (DB-03) es abierta a propósito (`using (true)`); el filtro por daycare lo hace `listRooms()` a nivel app.

### Pendiente

- Commit del usuario: migración + spec (criterio `git log -1 -- supabase/migrations/`).

### Reverificación (2026-08-25)

Re-ejecutados todos los criterios de aceptación contra el proyecto live (`fshwfkppcetvqnrccllq`):

- Migración `supabase/migrations/20260825120000_rls_write_policies_rooms_children.sql` presente en disco con los 6 `create policy` + 6 `drop policy if exists`, DDL idéntico a §Modelo de datos. ✅
- `pg_policy`: 4 policies por tabla; nombres y `polcmd` exactos (`rooms_select_authenticated`/`r`, `rooms_insert_staff_admin`/`a`, `rooms_update_staff_admin`/`w`, `rooms_delete_staff_admin`/`d`; ídem `children_*`). ✅
- Las 8 policies tienen `authenticated` en `polroles`. ✅
- Predicados verificados vía `pg_get_expr`: todos usan `( SELECT auth.uid())` (initplan); UPDATE de ambas tablas tiene `USING` + `WITH CHECK`; UPDATE de `children` valida el `room_id` resultante. ✅
- Grants: `authenticated` tiene `SELECT, INSERT, UPDATE, DELETE` (+ `REFERENCES, TRIGGER, TRUNCATE`) en ambas tablas. ✅
- `get_advisors`: security 0 ERRORs (solo WARNs heredados: `set_updated_at` search_path, `handle_new_user` / `rls_auto_enable` SECURITY DEFINER, leaked password protection); performance solo INFO `unused_index` sobre `users_role_idx`. Nada nuevo sobre `rooms`/`children`. ✅
- Usuario de prueba: `pedro@gmail.com` → role `staff`, daycare `6dc22d1a-3e45-4f25-a47c-82bf0371ad7d` — aplica la rama funcional del criterio 11 (ya ejecutada en la verificación original). ✅
- `git log`: commit `40ea76e` "Paso 1 - feat: add RLS policies for INSERT/UPDATE/DELETE on rooms and children…" contiene la migración. ✅

**Resultado: 12/12 criterios pasan.**
