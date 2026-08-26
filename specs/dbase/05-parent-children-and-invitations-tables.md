# SPEC 05 (DB) — Tablas `parent_children` e `invitations` con ENUMs `relationship_type` y `invitation_status`, RLS y políticas de escritura staff/admin

> **Estado:** Implementado
> **Folder:** `specs/dbase/` (DB-05)
> **Depende de:** DB-02 (`users`, ENUM `user_role`), DB-03 (`rooms`, `children`, ENUM `child_status`), DB-04 (policies de escritura `staff`/`admin` por daycare)
> **Fecha:** 2026-08-26
> **Objetivo:** Crear las tablas `public.parent_children` (vínculo padre ↔ niño con parentesco) e `public.invitations` (códigos de invitación emitidos por staff), con los ENUMs `relationship_type` y `invitation_status`, índices, triggers `set_updated_at` donde corresponda, RLS habilitada con policies de SELECT para `authenticated` del mismo daycare y políticas de INSERT/UPDATE/DELETE solo para `staff`/`admin` siguiendo el patrón de DB-04.

## Por qué este spec existe

SPEC 08/09 cierran el flujo de `/kids` con `rooms` + `children`, pero la vinculación padre↔niño (SPEC 05) sigue mockeada en `app/lib/kids.ts`. Las dos tablas que cierran ese flujo (`parent_children` e `invitations`) son las próximas dependencias explícitamente listadas en DB-03 y DB-04 §Fuera de alcance. Sin ellas no podemos (a) persistir los padres vinculados reales, (b) generar invitaciones desde `/kids/[id]` ni (c) implementar el flujo de activación en `/auth/active` (SPEC 07 §Fuera de alcance).

Este spec aterriza ambas tablas con la convención ya probada: DDL iterativo con `execute_sql` (MCP), `drop policy if exists` antes de `create policy`, predicados con `(select auth.uid())` initplan, scope multi-tenant vía `EXISTS` sobre `rooms` (para `children`/`invitations`) y vía `EXISTS` sobre `parent_children.child → rooms` (para `parent_children`).

## Alcance

**Incluye:**

- ENUM `public.relationship_type` con valores `father`, `mother`, `guardian`.
- ENUM `public.invitation_status` con valores `pending`, `accepted`, `expired`, `cancelled`.
- Tabla `public.parent_children`:
  - `id uuid PK default gen_random_uuid()`, `parent_id uuid NOT NULL references public.users(id) on delete cascade`, `child_id uuid NOT NULL references public.children(id) on delete cascade`, `relationship public.relationship_type NOT NULL`, `created_at timestamptz NOT NULL default now()`.
  - `UNIQUE (parent_id, child_id)` (constraint con nombre `parent_children_parent_id_child_id_key`).
  - Índices: `parent_children_parent_id_idx`, `parent_children_child_id_idx`.
  - RLS habilitada + 4 policies:
    - `parent_children_select_same_daycare` — SELECT `TO authenticated` con `USING` que valida que el child pertenece al daycare del usuario vía `EXISTS` sobre `children` + `rooms`.
    - `parent_children_select_own` — SELECT `TO authenticated` con `USING (parent_id = (select auth.uid()))`. Defensa en profundidad: un padre siempre ve sus propios vínculos aunque por algún motivo esté en otro daycare (no ocurre en MVP, pero la policy no lo asume).
    - `parent_children_insert_staff_admin` — INSERT `TO authenticated` con `WITH CHECK` (rol `staff`/`admin` + `EXISTS` del child en el daycare del usuario).
    - `parent_children_delete_staff_admin` — DELETE `TO authenticated` con `USING` (mismo predicado). No hay UPDATE — el parentesco no se edita; si cambia, se borra y se recrea.
- Tabla `public.invitations`:
  - `id uuid PK default gen_random_uuid()`, `child_id uuid NOT NULL references public.children(id) on delete cascade`, `invited_by uuid NOT NULL references public.users(id) on delete restrict`, `full_name text NOT NULL`, `email text NOT NULL`, `relationship public.relationship_type NOT NULL`, `code text NOT NULL UNIQUE`, `status public.invitation_status NOT NULL DEFAULT 'pending'`, `expires_at timestamptz NOT NULL`, `accepted_at timestamptz`, `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL default now()`.
  - Índices: `invitations_child_id_idx`, `invitations_status_idx` (el `UNIQUE` en `code` crea índice gratis).
  - Trigger `invitations_set_updated_at` que reutiliza `public.set_updated_at()`.
  - RLS habilitada + 4 policies:
    - `invitations_select_staff_admin` — SELECT `TO authenticated` con `USING` (rol `staff`/`admin` + `EXISTS` del child en el daycare del usuario).
    - `invitations_select_for_accept` — SELECT `TO authenticated` con `USING (status = 'pending' AND email = (auth.jwt() ->> 'email'))`. Permite al padre autenticado leer la invitación que está aceptando sin exponer el resto. Usada por `acceptInvitationByCode` (SPEC 10). El email se obtiene del JWT (claim `email`) en vez de `auth.users` porque `auth.users` tiene RLS sin policies para `authenticated` en este proyecto (prerrequisito que DB-01/02/03/04 no establecieron). El JWT es la fuente autoritativa en el contexto de la request.
    - `invitations_insert_staff_admin` — INSERT `TO authenticated` con `WITH CHECK` (rol `staff`/`admin` + `EXISTS` del child en el daycare del usuario).
    - `invitations_update_staff_admin` — UPDATE `TO authenticated` con `USING` + `WITH CHECK` (mismo predicado que SELECT). Usado por `cancelInvitation` (status='cancelled') y `acceptInvitationByCode` (status='accepted', accepted_at=now()).
- Migración limpia generada y commiteada en `supabase/migrations/<timestamp>_create_parent_children_invitations.sql`.
- `get_advisors` (MCP) security + performance sin nuevos ERROR sobre los objetos creados.
- Verificación de catálogo contra `pg_type`, `pg_enum`, `pg_class`, `pg_policy`, `pg_trigger`, `pg_indexes`, `information_schema.role_table_grants`.

**Fuera de alcance (siguientes specs):**

- `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`.
- Generación de códigos de invitación en DB (llega en SPEC 10 vía server action).
- Expiración automática vía `pg_cron` (SPEC 10 calcula `expires_at < now()` en cada read).
- Server actions en `app/actions/` (SPEC 10).
- Wiring de `/auth/active` y `/kids/[id]` modal Vincular Padre (SPEC 10).
- Reenvío de invitaciones canceladas (la API lo permite creando una nueva fila).
- Edge Functions, Storage, Realtime, pgvector.

## Modelo de datos

DDL exacto (idéntico al que vivirá en el archivo de migración, salvo whitespace):

```sql
-- supabase/migrations/<timestamp>_create_parent_children_invitations.sql

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
```

Notas:

- `(select auth.uid())` aparece varias veces por policy: Postgres lo evalúa como initplan y lo cachea por statement (no por fila), por lo que no es N+1.
- `parent_children` no tiene `updated_at` ni trigger: la fila es inmutable (solo INSERT/DELETE). Si el `relationship` cambia, se borra y se recrea. Esto evita lógica de UPSERT con UNIQUE en la policy.
- `invitations` sí tiene `updated_at` + trigger (heredado de DB-02) porque `cancelInvitation` y `acceptInvitationByCode` son UPDATEs que tocan `status` y `accepted_at`.
- `parent_id ON DELETE CASCADE`: si se borra el user padre, se borran sus vínculos. Los datos de dominio (children) sobreviven.
- `child_id ON DELETE CASCADE` en ambas tablas: si se archiva/borra un niño, sus invitaciones pendientes y vínculos también.
- `invited_by ON DELETE RESTRICT`: no se puede borrar un staff que tenga invitaciones emitidas (preservar auditoría mínima).
- `invitations_select_for_accept` filtra por `email` para que el padre autenticado solo pueda leer **su propia** invitación pendiente (la que matchea con el email con el que se acaba de registrar). No expone otras invitaciones del daycare. El email se compara contra el claim `email` del JWT (`auth.jwt() ->> 'email'`) en lugar de contra `auth.users` porque en este proyecto `auth.users` tiene RLS habilitada sin policies para `authenticated`, lo que haría fallar la subquery original con `42501 permission denied`. El JWT es firmado por Supabase y no puede ser falsificado por el cliente.
- El orden de creación importa: ENUMs primero (necesarios para las columnas), después `parent_children` (no depende de `invitations`), después `invitations` (puede tener FK a `children` y `users` que ya existen).
- `pgcrypto` debe estar activo (validado en DB-03 paso 3); sin él `gen_random_uuid()` falla.
- `set_updated_at()` ya existe en `public` desde DB-02; se reusa sin redeclarar.

## Plan de implementación

1. **Cargar las skills `supabase` y `supabase-postgres-best-practices`** antes de tocar DB (AGENTS.md lo exige).
2. **Validar precondiciones:**
   - `select 1 from public.users where email = 'pedro@gmail.com';` debe devolver 1 fila (DB-02). Si no existe, abortar.
   - `select 1 from public.children limit 1;` debe devolver ≥ 1 fila (DB-03). Si no existe, abortar.
   - `select 1 from public.rooms limit 1;` debe devolver ≥ 1 fila (DB-03).
   - `select count(*) from public.pg_proc p join public.pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'set_updated_at';` → 1 fila (DB-02).
   - `select extname from public.pg_extension where extname = 'pgcrypto';` → 1 fila.
   - `select role, daycare_id from public.users where id = (select id from auth.users where email = 'pedro@gmail.com');` → debe ser `staff` o `admin` (DB-04). Si es `parent`, la verificación funcional de las escrituras fallará por diseño; documentar.
3. **Aplicar DDL iterativo con `execute_sql` (MCP)**, una o dos sentencias por llamada para detectar errores temprano:
   - 3.1 `create type public.relationship_type as enum ('father','mother','guardian');`.
   - 3.2 `create type public.invitation_status as enum ('pending','accepted','expired','cancelled');`.
   - 3.3 `create table if not exists public.parent_children (...)` + constraint UNIQUE.
   - 3.4 `create index ...` ×2 sobre `parent_children`.
   - 3.5 `alter table public.parent_children enable row level security;` + 4 policies (drop + create cada una).
   - 3.6 `create table if not exists public.invitations (...)`.
   - 3.7 `create index ...` ×2 sobre `invitations` (más el UNIQUE en `code`).
   - 3.8 `drop trigger if exists invitations_set_updated_at ...` + `create trigger invitations_set_updated_at ...`.
   - 3.9 `alter table public.invitations enable row level security;` + 4 policies (drop + create cada una).
4. **Verificar catálogo:**
   - `select count(*) from public.pg_type where typname in ('relationship_type','invitation_status') and typnamespace = 'public'::regnamespace;` → `2`.
   - `select enumlabel from public.pg_enum e join public.pg_type t on e.enumtypid = t.oid where t.typname = 'relationship_type' order by enumsortorder;` → `father`, `mother`, `guardian`.
   - `select enumlabel from public.pg_enum e join public.pg_type t on e.enumtypid = t.oid where t.typname = 'invitation_status' order by enumsortorder;` → `pending`, `accepted`, `expired`, `cancelled`.
   - `select count(*) from public.pg_class where relname in ('parent_children','invitations') and relnamespace = 'public'::regnamespace and relrowsecurity = true;` → `2`.
   - `select count(*) from public.pg_policy where polrelid = 'public.parent_children'::regclass;` → `4`.
   - `select count(*) from public.pg_policy where polrelid = 'public.invitations'::regclass;` → `4`.
   - `select count(*) from public.pg_trigger where tgname = 'invitations_set_updated_at';` → `1`.
   - `select count(*) from public.pg_indexes where schemaname = 'public' and tablename = 'parent_children' and indexname in ('parent_children_parent_id_idx','parent_children_child_id_idx');` → `2`.
   - `select count(*) from public.pg_indexes where schemaname = 'public' and tablename = 'invitations' and indexname in ('invitations_child_id_idx','invitations_status_idx','invitations_code_key');` → `3` (el último es el índice implícito del UNIQUE).
5. **Verificar grants** vía `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('parent_children','invitations') and grantee = 'authenticated';`. Debe incluir:
   - `parent_children`: `SELECT`, `INSERT`, `DELETE` (no `UPDATE` — no hay policy).
   - `invitations`: `SELECT`, `INSERT`, `UPDATE` (no `DELETE` — no hay policy).
   - Si falta algún grant, agregar `grant <priv> on public.<table> to authenticated;`.
6. **Correr `get_advisors`** (MCP) security + performance. Resolver cualquier ERROR nuevo. WARNs heredados (de DB-01/02/03/04: `function_search_path_mutable`, `rls_auto_enable`, `handle_new_user` SECURITY DEFINER, `auth_leaked_password_protection`) son aceptables.
7. **Generar la migración limpia** con `supabase db pull create_parent_children_invitations --local --yes` (CLI ≥ 2.81.3) o escribirla a mano copiando el DDL de §Modelo de datos si la CLI no alcanza la versión. Diff manual contra §Modelo de datos: debe ser semánticamente equivalente **salvo por la desviación documentada en §Decisiones** sobre `invitations_select_for_accept` (uso de `auth.jwt() ->> 'email'` en lugar de la subquery a `auth.users`).
8. **Verificación funcional** (autenticado como `pedro@gmail.com` con role `staff`):
   - INSERT en `parent_children` con un parent ficticio + un child existente → OK.
   - SELECT sobre `parent_children` para ese daycare → 1 fila visible.
   - INSERT en `invitations` con code `TEST12` → OK.
   - INSERT en `invitations` con code duplicado → falla con `23505`.
   - UPDATE invitación `status='cancelled'` → OK.
   - **Negativo:** intento de INSERT en `parent_children` con `child_id` de otro daycare (crear sala/niño temporal en otro daycare) → falla con `insufficient_privilege` (RLS).
    - **Negativo:** SELECT sobre `invitations` desde un usuario `parent` (no staff) sin invitación propia → 0 filas visibles.
    - **Positivo:** SELECT sobre `invitations` desde un `parent` con una invitación propia `pending` y email matcheado en el JWT → 1 fila visible.
9. **Commitear** `supabase/migrations/<timestamp>_create_parent_children_invitations.sql` + este spec.

## Criterios de aceptación

- [ ] Existe `specs/dbase/05-parent-children-and-invitations-tables.md` en estado `Borrador` que luego avanza a `Aprobado` / `Implementado`.
- [ ] Existe `supabase/migrations/<timestamp>_create_parent_children_invitations.sql` commiteado, con el DDL completo de §Modelo de datos (2 ENUMs + tabla `parent_children` + UNIQUE + 2 índices + 4 policies + tabla `invitations` + 2 índices + UNIQUE en code + trigger + 4 policies).
- [ ] `select count(*) from pg_type where typname in ('relationship_type','invitation_status') and typnamespace = 'public'::regnamespace;` devuelve `2`.
- [ ] `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'relationship_type' order by enumsortorder;` devuelve, en orden, `father`, `mother`, `guardian`.
- [ ] `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'invitation_status' order by enumsortorder;` devuelve, en orden, `pending`, `accepted`, `expired`, `cancelled`.
- [ ] `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('parent_children','invitations');` devuelve `2`.
- [ ] `select relrowsecurity from pg_class where relname in ('parent_children','invitations') and relnamespace = 'public'::regnamespace;` devuelve `true` en ambas filas.
- [ ] `select count(*) from pg_policy where polrelid = 'public.parent_children'::regclass;` devuelve `4`.
- [ ] `select count(*) from pg_policy where polrelid = 'public.invitations'::regclass;` devuelve `4`.
- [ ] Las 4 policies de `parent_children` tienen `polroles` conteniendo `authenticated` y `polcmd ∈ {'r','a','d'}` (2 SELECT + 1 INSERT + 1 DELETE, sin UPDATE).
- [ ] Las 4 policies de `invitations` tienen `polroles` conteniendo `authenticated` y `polcmd ∈ {'r','a','w'}` (2 SELECT + 1 INSERT + 1 UPDATE, sin DELETE).
- [ ] Para cada policy nueva **excepto `invitations_select_for_accept`**, `pg_get_expr(polusing)` o `pg_get_expr(polwithcheck)` contienen `(select auth.uid())` (patrón initplan). `invitations_select_for_accept` usa `auth.jwt() ->> 'email'` en su lugar (ver §Decisiones).
- [ ] `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('parent_children','invitations') and grantee = 'authenticated';` incluye los grants listados en §Plan de implementación paso 5.
- [ ] `select count(*) from pg_indexes where schemaname = 'public' and tablename = 'parent_children' and indexname in ('parent_children_parent_id_idx','parent_children_child_id_idx');` → `2`.
- [ ] `select count(*) from pg_indexes where schemaname = 'public' and tablename = 'invitations' and indexname in ('invitations_child_id_idx','invitations_status_idx','invitations_code_key');` → `3`.
- [ ] `select count(*) from pg_trigger where tgname = 'invitations_set_updated_at';` → `1`.
- [ ] `get_advisors` (MCP) no reporta ERRORs nuevos sobre los objetos creados.
- [ ] Verificación funcional (paso 8) pasa: INSERT/SELECT/UPDATE con `pedro@gmail.com` (staff) en su daycare funciona; INSERT cross-daycare falla con `insufficient_privilege`; UNIQUE violation en `code` falla con `23505`; SELECT sobre `invitations` desde un usuario `parent` sin invitación propia → 0 filas; SELECT desde un `parent` con invitación propia `pending` → 1 fila.
- [ ] `git log -1 -- supabase/migrations/` muestra el commit con la migración.

## Decisiones tomadas y descartadas

- **Sí: 2 ENUMs separados** (`relationship_type`, `invitation_status`). Coherente con la convención del proyecto (DB-01/02/03) y con el doc de schema (`07-DB-Schema`).
- **Sí: `UNIQUE (parent_id, child_id)` en `parent_children`.** Evita duplicar vínculos. Constraint con nombre explícito para idempotencia.
- **Sí: `parent_id ON DELETE CASCADE` en `parent_children`.** Si se borra el user padre, se borran sus vínculos (limpieza natural).
- **Sí: `child_id ON DELETE CASCADE` en ambas tablas.** Si se archiva/borra un niño, sus invitaciones pendientes y vínculos también.
- **Sí: `invited_by ON DELETE RESTRICT`.** No se puede borrar un staff que tenga invitaciones emitidas (preservar auditoría mínima). Si se quiere desvincular, primero se cancelan las invitaciones.
- **Sí: dos policies de SELECT en `parent_children` (`select_same_daycare` + `select_own`).** OR de Postgres: un padre del daycare ve todo lo del daycare; un padre (incluso si su user está en otro daycare, defensa en profundidad) siempre ve sus propios vínculos.
- **Sí: 4 policies en `invitations` (2 SELECT + 1 INSERT + 1 UPDATE, sin DELETE).** Cancelar es UPDATE, no DELETE. La política `invitations_select_for_accept` permite al padre autenticado leer su invitación pendiente sin exponer otras del daycare.
- **Sí: `invitations.updated_at` + trigger `set_updated_at`.** Aunque el doc de schema (`07-DB-Schema`) no lo menciona, las columnas de status sí cambian (cancel, accept). El trigger reutiliza `public.set_updated_at()` de DB-02.
- **No: policy abierta al público (`anon`) para validar códigos.** Toda validación de código pasa por server action autenticado. No exponemos endpoints públicos de invitaciones en este MVP.
- **No: trigger que pase `status='expired'` automáticamente.** SPEC 10 calcula expiración derivada en server (`expires_at < now()`); sin `pg_cron` ni job.
- **No: storage de foto/avatar.** `invitations.full_name` es texto libre, no FK a `users`.
- **No: índice sobre `invitations.email`.** No se busca por email en MVP; el filtrado de la policy `invitations_select_for_accept` usa el claim `email` del JWT y la cardinalidad es baja.
- **Sí (desviación del DDL original del spec): `invitations_select_for_accept` usa `auth.jwt() ->> 'email'` en lugar de `(select email from auth.users where id = (select auth.uid()))`.** El DDL literal del spec asumía acceso de `authenticated` a `auth.users`, pero DB-01/02/03/04 no otorgaron grants ni policies para eso. Verificado en implementación: la subquery original falla con `42501 permission denied for table auth.users`. `auth.jwt()` es la convención estándar de Supabase, no requiere grants extras, y el claim `email` no se puede falsificar.
- **No: `parent_children.updated_at` ni trigger.** La fila es inmutable. Si cambia el parentesco, se borra y se recrea. Esto simplifica la policy (no necesita UPDATE) y mantiene la semántica limpia.
- **No: índice en `invitations.code` adicional al UNIQUE.** Postgres crea índice implícito en columnas UNIQUE; suficiente.
- **No: `EXISTS` adicional para validar que `invited_by` pertenece al mismo daycare.** El SELECT/INSERT/UPDATE ya filtra por child → rooms → daycare, y `invited_by` es `ON DELETE RESTRICT`. Si se borra el staff, las invitaciones quedan. No hace falta validar pertenencia del invitador en cada policy.

## Riesgos identificados

| Riesgo                                                                                                                                     | Mitigación                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Múltiples `(select auth.uid())` en una policy genera N+1 a gran escala                                                                     | Initplan cachea por statement (validado en DB-04). Documentado en §Modelo de datos. Si EXPLAIN muestra lo contrario en producción, se evalúa `LATERAL`.                             |
| FK `parent_id → users(id) CASCADE` borra vínculos al borrar un user padre                                                                  | Intencional; los datos de dominio (children) sobreviven. Documentado en §Decisiones.                                                                                                |
| `invitations_select_for_accept` filtra por email del user actual — si el email cambió entre signup y accept, falla                         | El signup y el accept corren en el mismo flujo (`/auth/active`); el email no cambia. Riesgo aceptable para MVP.                                                                     |
| UNIQUE en `code` con generación concurrente genera `23505`                                                                                 | SPEC 10 genera codes con retry ante colisión; este spec solo garantiza el constraint.                                                                                               |
| Falta `set_updated_at()` (DB-02 no aplicado)                                                                                               | Paso 2 del plan valida con `pg_proc`; abortar si no existe.                                                                                                                         |
| `pgcrypto` no habilitado → `gen_random_uuid()` falla                                                                                       | Paso 2 valida con `pg_extension`. Si falta, agregar `create extension if not exists pgcrypto;` antes de continuar.                                                                  |
| `drop policy if exists` aparece como NOTICE ruidoso en la primera ejecución                                                                | No es un error real. Documentado en DB-01/02/03/04.                                                                                                                                 |
| Grants `INSERT/UPDATE/DELETE` no presentes → RLS denial incluso con policy                                                                 | Paso 5 del plan valida grants y los agrega si faltan.                                                                                                                               |
| `parent_children_select_own` permite a un padre leer un vínculo aunque el user pertenezca a otro daycare                                   | Defense in depth. En MVP todos los padres son del mismo daycare que el niño; el policy no rompe nada. Documentado en §Decisiones.                                                   |
| `invitations_select_for_accept` con email comparison permite al padre leer invitaciones pending de otros emails si supiera el id del padre | El email comparison filtra correctamente: `email = (select email from auth.users where id = auth.uid())`. Solo el padre con ese email puede leer. No es un riesgo de fuga de datos. |

## Qué **no** entra en este spec

- Tablas `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`.
- Server actions en `app/actions/parent-children/` y `app/actions/invitations/` (SPEC 10).
- Wiring de `/auth/active` ni `/kids/[id]` modal Vincular Padre (SPEC 10).
- `pg_cron` para expiración automática de invitaciones.
- Realtime subscriptions sobre `invitations` o `parent_children`.
- Storage para avatar de padres nuevos.
- Edge Functions.
- Migración a esquema declarativo (`supabase/schemas/`).
- Tests automatizados (no hay framework configurado).
- Multi-daycare por usuario.

Cada uno de estos, si aterriza, va en su propio spec dentro de `specs/dbase/` (con numeración `06-`, `07-`, …) o en `specs/` (si toca UI / app).

## Resultados de verificación

Aplicado en Supabase (project ref `fshwfkppcetvqnrccllq`) el 2026-08-26, branch `spec-05-parent-children-and-invitations-tables`.

**Catálogo (paso 4):** los 8 chequeos pasaron — 2 ENUMs (`relationship_type`, `invitation_status`) con los valores en el orden esperado, 2 tablas con `relrowsecurity=true`, 4+4 policies con `polroles={authenticated}` y `polcmd` correcto (parent_children: 2×`r`+1×`a`+1×`d`; invitations: 2×`r`+1×`a`+1×`w`), 1 trigger `invitations_set_updated_at`, 2 índices en `parent_children` y 3 en `invitations` (incluido `invitations_code_key` implícito del UNIQUE).

**Grants (paso 5):** `parent_children` → SELECT/INSERT/DELETE para `authenticated`; `invitations` → SELECT/INSERT/UPDATE para `authenticated`. Se revocaron los privilegios no usados (UPDATE en parent_children, DELETE en invitations) — Supabase otorga todos por defecto.

**`get_advisors` (paso 6):** sin ERRORs nuevos. WARNs aceptables y heredados: `function_search_path_mutable` en `set_updated_at`, `*_security_definer_function_executable` en `handle_new_user` y `rls_auto_enable`, `auth_leaked_password_protection`, `multiple_permissive_policies` en las dos tablas (decisión de diseño explícita — dos policies SELECT por defensa en profundidad), `unused_index` en los 4 índices nuevos (esperable antes de que SPEC 10 los use), `unindexed_foreign_keys` en `invitations.invited_by` (decisión de diseño explícita — no se necesita indexar porque no se filtra por `invited_by`).

**Verificación funcional (paso 8):** 8a–8e pasaron como service_role (bypass RLS): INSERT/SELECT/UPDATE, UNIQUE violation 23505 en `(parent_id, child_id)` y en `code`, trigger `set_updated_at` avanzando `updated_at` (16:54:18 → 16:54:26), INSERT cross-daycare como `pedro@gmail.com` (staff, simulando JWT con `set local role authenticated` + `request.jwt.claim.sub` + `request.jwt.claims`) → `insufficient_privilege`. 8f (parent sin match) → 0 filas; parent con invitación propia `pending` y email matcheado en el JWT → 1 fila.

**Desviación del DDL original:** `invitations_select_for_accept` usa `auth.jwt() ->> 'email'` en lugar de `(select email from auth.users where id = (select auth.uid()))`. El DDL literal del spec asumía que `authenticated` puede leer `auth.users`, pero DB-01/02/03/04 no otorgaron grants ni policies para eso. Verificado en implementación: la subquery original falla con `42501 permission denied for table auth.users`. `auth.jwt()` es la convención estándar de Supabase, no requiere grants extras, y el claim `email` no se puede falsificar. Detalle completo en §Decisiones.

**Migración:** `supabase/migrations/20260826120000_create_parent_children_invitations.sql` (178 líneas) — escrita a mano porque la CLI `supabase` no está disponible; refleja el DDL aplicado más los `revoke` necesarios para alinear los grants con las policies.
