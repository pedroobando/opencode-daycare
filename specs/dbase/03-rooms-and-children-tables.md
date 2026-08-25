# SPEC 03 (DB) — Tablas `rooms` y `children` con ENUM `child_status`, RLS y seed de 3 salas

> **Estado:** Implementado
> **Folder:** `specs/dbase/` (DB-03)
> **Depende de:** SPEC DB-01 (`daycares`), SPEC DB-02 (`set_updated_at()` y convenciones de RLS)
> **Fecha:** 2026-08-24
> **Objetivo:** Crear las tablas `public.rooms` (salas de la guardería) y `public.children` (niños inscritos) con el ENUM `child_status`, RLS con SELECT abierto a `authenticated` y sin policies de escritura, e insertar 3 salas semilla para pruebas, todas vinculadas a `Sala Soles`.

## Por qué este spec existe

El modelo de datos necesita `rooms` y `children` para reemplazar los mocks en memoria de SPEC 02 (`app/lib/kids.ts`) y para sostener el flujo del feed (SPEC 01), el perfil de niño (SPEC 02), el modal "Agregar niño" (SPEC 04) y la vinculación de padres (SPEC 05). Hoy no hay ninguna de las dos tablas en `public`; sin ellas no se puede escribir contra DB ni hacer las validaciones de FK que ya prevén `parent_children`, `invitations`, `posts.room_id` y `post_children`. Este spec aterriza las dos tablas con la convención ya establecida en DB-01/DB-02 (RLS SELECT abierto, `drop policy if exists` antes de `create policy`, reutilización de `set_updated_at`, seed bundled) y deja el modelo listo para que SPEC 08 enchufe server actions tipadas.

## Alcance

**Incluye:**

- ENUM `public.child_status` con valores `active`, `archived` (default `active`).
- Tabla `public.rooms` con `id uuid PK default gen_random_uuid()`, `daycare_id uuid NOT NULL references public.daycares(id) on delete restrict`, `name text NOT NULL`, `created_at` / `updated_at` timestamptz NOT NULL default `now()`, índice `rooms_daycare_id_idx`, trigger `rooms_set_updated_at` (reutilizando la función pública `set_updated_at()` creada en DB-02), RLS habilitada, 1 policy `rooms_select_authenticated` (SELECT abierto a `authenticated` con `using (true)`), 0 policies de INSERT/UPDATE/DELETE.
- Tabla `public.children` con `id uuid PK default gen_random_uuid()`, `room_id uuid NOT NULL references public.rooms(id) on delete restrict`, `full_name text NOT NULL`, `birth_date date NOT NULL`, `enrolled_at date NOT NULL default current_date`, `medical_notes text`, `allergy_tags text[] NOT NULL default '{}'`, `photo_consent boolean NOT NULL default true`, `status public.child_status NOT NULL default 'active'`, `created_at` / `updated_at` timestamptz NOT NULL default `now()`, índices `children_room_id_idx` y `children_status_idx`, trigger `children_set_updated_at`, RLS habilitada, 1 policy `children_select_authenticated` (mismo patrón), 0 policies de INSERT/UPDATE/DELETE.
- Seed bundled en la propia migración: 3 rooms llamadas `Soles`, `Lunitas` y `Estrellitas`, todas con `daycare_id` resuelto en runtime apuntando a `Sala Soles` (vía `select id from public.daycares where name = 'Sala Soles'`).
- Migración limpia generada con `supabase db pull create_rooms_children --local --yes` y commiteada en `supabase/migrations/<timestamp>_create_rooms_children.sql`.
- `get_advisors` (MCP) en `security` y `performance` sin issues críticos sobre `public.rooms`, `public.children` o `public.child_status`.
- Verificación de catálogo contra `pg_class`, `pg_policy`, `pg_type`, `pg_enum`, `pg_trigger`, `pg_indexes` e `information_schema.role_table_grants`.

**Fuera de alcance (siguientes specs):**

- Tablas `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`.
- ENUMs `relationship_type`, `invitation_status`, `post_type`.
- Policies de INSERT/UPDATE/DELETE en `rooms` o `children` (llegan cuando se decida el modelo de autorización por rol).
- Server actions en `app/actions/` (SPEC 08).
- Refactor de la UI (`/kids`, `/kids/[id]`, modal "Agregar niño") para que lea de DB.
- Avatar/photo upload real para niños (`photo_consent` queda como boolean, sin storage).
- Storage buckets, Edge Functions, Realtime, pg_cron, pgvector.
- Migración a esquema declarativo (`supabase/schemas/`).
- Tests automatizados (no hay framework configurado).
- Multi-tenant scoping en policies de RLS (sigue SELECT abierto a `authenticated` como DB-01/DB-02; el aislamiento por guardería llega cuando se definan policies por membresía de daycare).
- Triggers adicionales sobre `children` (ej. recálculo de edad) — se calcula en la app.

## Modelo de datos

DDL exacto (idéntico al que vivirá en el archivo de migración, salvo whitespace):

```sql
-- supabase/migrations/<timestamp>_create_rooms_children.sql

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
```

Notas:

- `set_updated_at()` ya existe en `public` desde DB-02; se reusa sin redeclarar. Si la función no existiera, este spec falla loudly con `function public.set_updated_at() does not exist` — depende de DB-02.
- `pgcrypto` debe estar activo (validado en paso 3 del plan); sin él `gen_random_uuid()` falla.
- `on delete restrict` en `room_id` evita borrar una sala con niños asociados: cualquier `DELETE FROM public.rooms WHERE id = …` que matchee niños activos falla con `violates foreign key constraint`. El server action de delete (SPEC 08) debe capturar este error y devolver un mensaje claro a la UI.
- `allergy_tags text[] NOT NULL DEFAULT '{}'`: array vacío por defecto para que la columna nunca quede NULL. Valores en inglés (`peanut`, `lactose`, etc.) según convención del doc de schema. La UI traduce a MANÍ, LACTOSA, etc.
- `birth_date date NOT NULL` sin default: la columna es obligatoria desde el formulario; no se permiten niños sin fecha de nacimiento.
- `enrolled_at date NOT NULL DEFAULT current_date`: se completa con la fecha actual en el INSERT si la app no la manda; la app puede override.
- `photo_consent boolean NOT NULL DEFAULT true`: default optimista (consentimiento hasta que se diga lo contrario). El campo se mantiene como boolean plano (no array de consentimientos granulares).
- `status child_status NOT NULL DEFAULT 'active'`: archivado lógico (`archived`) en lugar de DELETE físico para preservar historial de posts, comentarios y reacciones referidas al niño.
- El seed se hace dentro de un `do $$ ... $$` para resolver `daycare_id` en runtime y validar que `Sala Soles` exista antes de los INSERTs. Si no existe, `raise exception` falla loudly con mensaje claro.
- El orden de creación es importante: ENUM primero (necesario para `children.status`), después `rooms` (necesario para la FK de `children`), después `children`. Si se reordena, falla por dependencia.

## Plan de implementación

1. **Cargar la skill `supabase-postgres-best-practices`** antes de cualquier cambio en Postgres (AGENTS.md lo exige).
2. **Validar dependencias existentes**: `select 1 from public.daycares where name = 'Sala Soles';` debe devolver 1 fila (DB-01); `select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'set_updated_at';` debe devolver 1 fila (DB-02). Si cualquiera de las dos falla, abortar.
3. **Validar `pgcrypto` activo** vía `select extname from pg_extension where extname = 'pgcrypto';`. Si devuelve vacío, aplicar `create extension if not exists pgcrypto;` en una migración previa antes de continuar.
4. **Aplicar DDL iterativo con `execute_sql` (MCP), nunca `apply_migration`** — mismo patrón que DB-01/DB-02. Ejecutar de a pasos para detectar errores temprano:
   - 4.1 `create type public.child_status as enum ('active', 'archived');`.
   - 4.2 `create table if not exists public.rooms (...)` con FK a `daycares`.
   - 4.3 `create index if not exists rooms_daycare_id_idx ...;` + `drop trigger if exists ...` + `create trigger rooms_set_updated_at ...`.
   - 4.4 `alter table public.rooms enable row level security;` + `drop policy if exists rooms_select_authenticated on public.rooms;` + `create policy rooms_select_authenticated ...`.
   - 4.5 `create table if not exists public.children (...)` con FK a `rooms`, `allergy_tags text[]`, `status child_status`.
   - 4.6 `create index if not exists children_room_id_idx ...;` + `create index if not exists children_status_idx ...;` + `drop trigger if exists ...` + `create trigger children_set_updated_at ...`.
   - 4.7 `alter table public.children enable row level security;` + `drop policy if exists children_select_authenticated on public.children;` + `create policy children_select_authenticated ...`.
   - 4.8 `do $$ declare v_sala_soles_id uuid; begin select id into v_sala_soles_id from public.daycares where name = 'Sala Soles'; if v_sala_soles_id is null then raise exception '...'; end if; insert into public.rooms (daycare_id, name) values (..., 'Soles'), (..., 'Lunitas'), (..., 'Estrellitas'); end $$;`.
5. **Verificar grants** vía `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('rooms', 'children');`. Debe haber al menos `SELECT` para `authenticated` en ambas tablas. Si falta, agregar `grant select on public.rooms to authenticated;` y `grant select on public.children to authenticated;` antes de generar la migración.
6. **Verificar catálogo**:
   - `select relrowsecurity from pg_class where relname in ('rooms','children') and relnamespace = 'public'::regnamespace;` → ambas filas con `true`.
   - `select count(*) from pg_policy where polrelid in ('public.rooms'::regclass, 'public.children'::regclass);` → exactamente `2` (1 por tabla).
   - `select count(*) from pg_policy where polrelid in ('public.rooms'::regclass, 'public.children'::regclass) and polcmd in ('i','u','d');` → `0`.
   - `select count(*) from pg_trigger where tgname in ('rooms_set_updated_at','children_set_updated_at') and tgrelid in ('public.rooms'::regclass, 'public.children'::regclass);` → `2`.
   - `select count(*) from pg_indexes where schemaname = 'public' and tablename in ('rooms','children') and indexname in ('rooms_daycare_id_idx','children_room_id_idx','children_status_idx');` → `3`.
   - `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'child_status' order by enumsortorder;` → `active`, `archived`.
7. **Correr `get_advisors`** (MCP) en `security` y `performance`. Resolver cualquier issue crítico sobre `public.rooms`, `public.children` o `public.child_status` antes de continuar. WARNs heredados (de DB-01/DB-02: `function_search_path_mutable` sobre `set_updated_at`, `rls_auto_enable` pre-existente) son aceptables y se documentan en §Riesgos.
8. **Generar la migración limpia** con `supabase db pull create_rooms_children --local --yes`. Verificar antes `supabase --version` (la flag `--local --yes` requiere CLI ≥ 2.81.3). Si la versión no alcanza, escribir la migración a mano desde el DDL de §Modelo de datos (es trivial).
9. **Diff manual** del archivo `supabase/migrations/<timestamp>_create_rooms_children.sql` generado contra §Modelo de datos: debe ser semánticamente equivalente. Puede diferir en whitespace, en orden de sentencias dentro del `do $$` block, o en nombres de constraint inferidos por Postgres (`rooms_daycare_id_fkey`); no en contenido.
10. **Commitear** `supabase/migrations/<timestamp>_create_rooms_children.sql` + `specs/dbase/03-rooms-and-children-tables.md` (el usuario corre `git commit` con su mensaje; este spec no ejecuta el commit).
11. **Verificación final** contra los criterios de aceptación (queries de catálogo detalladas abajo).

## Criterios de aceptación

- [x] Existe `specs/dbase/03-rooms-and-children-tables.md` en estado `Aprobado` o posterior.
- [ ] Existe `supabase/migrations/<timestamp>_create_rooms_children.sql` commiteado, con el DDL completo de §Modelo de datos (ENUM + tabla `rooms` + índice + trigger + RLS + policy + tabla `children` + 2 índices + trigger + RLS + policy + seed DO block).
- [x] `select count(*) from pg_type where typname = 'child_status' and typnamespace = 'public'::regnamespace;` devuelve `1`.
- [x] `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'child_status' order by enumsortorder;` devuelve, en orden, `active`, `archived`.
- [x] `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('rooms', 'children');` devuelve `2`.
- [x] `select relrowsecurity from pg_class where relname = 'rooms' and relnamespace = 'public'::regnamespace;` devuelve `true`.
- [x] `select relrowsecurity from pg_class where relname = 'children' and relnamespace = 'public'::regnamespace;` devuelve `true`.
- [x] `select count(*) from pg_policy where polrelid = 'public.rooms'::regclass;` devuelve exactamente `1`.
- [x] `select count(*) from pg_policy where polrelid = 'public.children'::regclass;` devuelve exactamente `1`.
- [x] Esas 2 policies tienen `polcmd = 'r'` y rol `authenticated` (consulta `pg_policy` + `pg_roles` con `ANY(p.polroles)`).
- [x] `select count(*) from pg_policy where polrelid in ('public.rooms'::regclass, 'public.children'::regclass) and polcmd in ('i','w','d');` devuelve `0`.
- [x] `select count(*) from pg_trigger where tgname in ('rooms_set_updated_at','children_set_updated_at') and tgrelid in ('public.rooms'::regclass, 'public.children'::regclass);` devuelve `2`.
- [x] `select count(*) from pg_indexes where schemaname = 'public' and tablename = 'rooms' and indexname = 'rooms_daycare_id_idx';` devuelve `1`.
- [x] `select count(*) from pg_indexes where schemaname = 'public' and tablename = 'children' and indexname in ('children_room_id_idx', 'children_status_idx');` devuelve `2`.
- [x] `select count(*) from public.rooms r join public.daycares d on d.id = r.daycare_id where d.name = 'Sala Soles' and r.name in ('Soles', 'Lunitas', 'Estrellitas');` devuelve `3`.
- [x] `select count(*) from public.rooms;` devuelve `3` (solo estas 3 salas existen en MVP).
- [x] `select count(*) from public.children;` devuelve `0` (sin seed de niños en este spec).
- [x] `select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ('rooms','children') and grantee = 'authenticated' and privilege_type = 'SELECT';` devuelve al menos `2`.
- [x] `get_advisors` (MCP) no reporta issues críticos (ERROR) sobre `public.rooms`, `public.children` o `public.child_status` después de aplicar el DDL.
- [x] `pnpm lint` y `npx tsc --noEmit` siguen verdes (la app Next.js no cambia en este spec; control de regresión).
- [ ] `git log -1 -- supabase/migrations/` muestra el commit con la migración.

## Decisiones

- **Sí: ENUM `child_status` con `active` y `archived`.** Coherente con el doc de schema (default `active`, archivado lógico en lugar de DELETE físico). Crea el ENUM en este spec porque la tabla `children` lo requiere y no existe aún.
- **Sí: `set_updated_at()` reutilizada de DB-02.** No se redeclara. Nombre de trigger específico por tabla (`rooms_set_updated_at`, `children_set_updated_at`) para evitar colisiones, igual que en DB-02.
- **Sí: RLS SELECT abierto a `authenticated` con `using (true)`.** Mismo patrón que `daycares` y `users` (DB-01/DB-02). Multi-tenant MVP: toda guardería y todas las salas/niños visibles para usuarios autenticados. El scoping por `daycare_id` se hace a nivel de app (SPEC 08) por ahora.
- **Sí: 0 policies de INSERT/UPDATE/DELETE.** Sin rol `staff`/`admin` modelado en RLS todavía, las escrituras quedan denegadas por defecto. Llega en un spec de "policies de escritura" cuando se defina el modelo de autorización.
- **Sí: `daycare_id NOT NULL references daycares(id) on delete restrict`.** Coherente con `users.daycare_id` (DB-02). Impide borrar una guardería con salas asociadas (debe hacerse soft-delete o reasignación previa).
- **Sí: `name text NOT NULL` en `rooms`.** Salas sin nombre no tienen sentido en el dominio.
- **Sí: `room_id NOT NULL references rooms(id) on delete restrict` en `children`.** No se permiten niños huérfanos de sala. La FK RESTRICT falla loudly si alguien intenta borrar una sala con niños activos — el server action de `deleteRoom` (SPEC 08) captura el error y muestra mensaje claro.
- **Sí: `birth_date date NOT NULL` (sin default).** Coherente con la validación del modal "Agregar niño" (SPEC 04) que exige fecha. No tiene sentido un niño sin fecha de nacimiento.
- **Sí: `enrolled_at date NOT NULL DEFAULT current_date`.** Default a hoy si la app no la manda. Útil para migraciones de datos donde solo se conoce la fecha de nacimiento.
- **Sí: `medical_notes text` (nullable).** Campo opcional — la mayoría de los niños no tienen notas médicas.
- **Sí: `allergy_tags text[] NOT NULL DEFAULT '{}'`.** Array de Postgres por simplicidad según doc de schema; valores en inglés (`peanut`, `lactose`, `gluten`, etc.). Default `'{}'` evita NULLs y simplifica la lógica del server action.
- **Sí: `photo_consent boolean NOT NULL DEFAULT true`.** Default optimista (consentimiento hasta que se diga lo contrario). Mantenido como boolean plano, no como array de consentimientos granulares.
- **Sí: `status child_status NOT NULL DEFAULT 'active'`.** Archivado lógico (`archived`) en lugar de DELETE físico para preservar historial de posts, comentarios y reacciones.
- **Sí: 2 índices en `children` (`room_id`, `status`).** Cubren queries esperadas: listado por sala (feed de la sala, profile de la sala) y filtrado por activos vs archivados.
- **Sí: 1 índice en `rooms` (`daycare_id`).** Cubre el filtro multi-tenant del server action `listRooms()`.
- **No: índice único sobre `rooms.name` ni sobre `rooms(daycare_id, name)`.** Mismo razonamiento que DB-01 con `daycares.name`: dos salas distintas pueden compartir nombre comercial. Si más adelante hace falta uniqueness por guardería, se evalúa con datos reales.
- **No: índice único sobre `children.full_name`.** Homónimos son posibles; el dominio no exige unicidad.
- **No: trigger de recálculo de edad en `children`.** La edad es derivada de `birth_date`; se calcula en la app con `differenceInYears(now, birth_date)` igual que hoy hace `AddKidForm` (SPEC 04). Mantenerlo en la app evita un trigger ineficiente y permite tests sin DB.
- **No: grants explícitos en el DDL.** El rol `authenticated` hereda `SELECT` sobre tablas nuevas de `public` por configuración por defecto de Supabase. Se valida en el paso 5 del plan; solo se agregan si faltan.
- **No: storage buckets ni photo upload real.** `photo_consent` queda como boolean; la URL de la foto (cuando llegue) será texto libre, igual que `users.avatar_url`.
- **No: políticas de admin/staff que escriban.** No existe el modelo de autorización todavía. Llega en spec posterior.
- **Sí: seed de 3 rooms en `Sala Soles` (`Soles`, `Lunitas`, `Estrellitas`).** Decisión del usuario. Se usa `Sala Soles` porque es la guardería del usuario de prueba `pedro@gmail.com` (DB-02), útil para validar visualmente en `/kids` cuando SPEC 08 enchufe la UI.
- **Sí: seed dentro de un `do $$ ... $$` block con lookup de `daycare_id` por nombre y validación.** Falla loudly si `Sala Soles` no existe, en lugar de insertar con `daycare_id = NULL` (que violaría la FK).

## Riesgos

| Riesgo                                                                                                                      | Mitigación                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_updated_at()` no existe (DB-02 no aplicado)                                                                            | Paso 2 del plan valida su existencia con `pg_proc`; abortar si no existe.                                                                                                                                                 |
| `Sala Soles` no existe en `public.daycares` (DB-01 no aplicado)                                                             | Paso 2 del plan valida con `select 1 from daycares where name = 'Sala Soles'`; abortar si no existe.                                                                                                                      |
| `pgcrypto` no habilitado → `gen_random_uuid()` falla                                                                        | Paso 3 valida con `pg_extension`; si falta, migración previa con `create extension if not exists pgcrypto;`.                                                                                                              |
| RLS impide `INSERT` en el seed si se ejecuta bajo rol restringido                                                           | El seed se ejecuta vía `execute_sql` (MCP) con privilegios de service role — no afectado por RLS. Migration commiteada la ejecuta con service role también.                                                               |
| Re-ejecución manual de la migración falla por INSERTs duplicados (3 salas llamadas Soles/Lunitas/Estrellitas en Sala Soles) | Aceptable: `supabase migration up` no re-ejecuta migraciones aplicadas. Si se re-corre manualmente, el `do $$` falla con `duplicate key value violates unique constraint` (cuando haya UNIQUE; actualmente solo PK y FK). |
| `drop policy if exists` aparece como `NOTICE` ruidoso en logs                                                               | No es un error real: la policy no existe en la primera ejecución. Documentado también en DB-01/DB-02.                                                                                                                     |
| `function_search_path_mutable` warning sobre `set_updated_at` en `get_advisors`                                             | Heredado de DB-02. Aceptable: función trivial. La fix (agregar `set search_path = ''`) se evalúa en un spec aparte si crece la lista de warnings.                                                                         |
| FK `children.room_id → rooms.id` RESTRICT impide borrar sala con niños                                                      | Comportamiento deseado. SPEC 08 captura el error de Postgres en `deleteRoom` y devuelve mensaje claro a la UI ("No se puede borrar: tiene niños activos").                                                                |
| `enrolled_at DEFAULT current_date` puede sorprender si la zona horaria del server difiere de la del usuario                 | MVP acepta este riesgo. La columna se puede override desde la app; el default es solo fallback.                                                                                                                           |
| Bundled seed hace el primer deploy irreversible en datos (no se puede "des-sembrar" desde la migración)                     | Aceptable para MVP. Si después se quiere revertir, se hace con `delete from public.rooms where name in ('Soles','Lunitas','Estrellitas');` ad-hoc.                                                                        |

## Qué **no** entra en este spec

- Cualquier otra tabla del modelo (`parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`).
- ENUMs `relationship_type`, `invitation_status`, `post_type`.
- Policies de INSERT/UPDATE/DELETE en `rooms` o `children` (esperando modelo de autorización por rol).
- Server actions de rooms/children (SPEC 08 — `app/actions/rooms/` y `app/actions/children/`).
- Refactor de la UI (`/kids`, `/kids/[id]`, modal "Agregar niño") para leer de DB en lugar de `app/lib/kids.ts`.
- Avatar/photo upload real para niños.
- Storage buckets, Edge Functions, Realtime, pg_cron, pgvector.
- Migración a esquema declarativo (`supabase/schemas/`).
- Tests automatizados.
- Triggers de recálculo de edad, validación de cupos por sala, ni lógica de capacidad.
- Soft-delete o reasignación masiva de niños entre salas (vía UI).

Cada uno de estos, si aterriza, va en su propio spec dentro de `specs/dbase/` (con numeración `04-`, `05-`, …) o en `specs/` (si toca UI / app).

## Resultados de verificación

**Fecha:** 2026-08-24
**Verificador:** spec-verifier (subagente)
**Proyecto:** `open-daycare` (Supabase ref `fshwfkppcetvqnrccllq`)
**Rama:** `spec-03-rooms-and-children-tables`

### Resumen

- ✅ Pasados: **19 / 21**
- ❌ Fallidos: **2 / 21**
- ⚠️ Advertencias: 0
- **Estado global:** **PARTIAL** — la base de datos está correctamente creada y todos los criterios técnicos de catálogo/SQL pasan, pero dos criterios documentales/de control de versiones fallan.

### Resultados por criterio

| #   | Criterio                                                                   | Estado | Evidencia                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Spec existe en estado `Borrador`                                           | ❌     | El archivo existe pero su estado es `aprobado` (línea 3). El criterio es **stale**: refleja el estado inicial del spec, no el actual. Considerar actualizarlo a "existe en estado `Aprobado` o `Implementado`" para reflejar el flujo real del workflow (`Borrador → En revisión → Aprobado → Implementado`).                                   |
| 2   | Migración SQL commiteada con DDL completo                                  | ❌     | `supabase/migrations/20260824150000_create_rooms_children.sql` existe en disco (87 líneas, coincide semánticamente con §Modelo de datos) pero está **untracked** (`git status` lo lista como archivo sin seguimiento). El commit `a3fe600` ("Paso 0 - feat(db): create rooms and children tables...") incluye el spec pero **no la migración**. |
| 3   | ENUM `child_status` existe                                                 | ✅     | `pg_type` count = `1` en `public`.                                                                                                                                                                                                                                                                                                              |
| 4   | ENUM values `active`, `archived` en orden                                  | ✅     | `pg_enum` retorna `["active","archived"]` ordenado por `enumsortorder`.                                                                                                                                                                                                                                                                         |
| 5   | Tablas `rooms` y `children` existen                                        | ✅     | `information_schema.tables` count = `2`.                                                                                                                                                                                                                                                                                                        |
| 6   | RLS habilitado en `rooms`                                                  | ✅     | `relrowsecurity = true`.                                                                                                                                                                                                                                                                                                                        |
| 7   | RLS habilitado en `children`                                               | ✅     | `relrowsecurity = true`.                                                                                                                                                                                                                                                                                                                        |
| 8   | 1 policy en `rooms`                                                        | ✅     | `pg_policy` count = `1` (`rooms_select_authenticated`).                                                                                                                                                                                                                                                                                         |
| 9   | 1 policy en `children`                                                     | ✅     | `pg_policy` count = `1` (`children_select_authenticated`).                                                                                                                                                                                                                                                                                      |
| 10  | Policies con `polcmd = SELECT` y rol `authenticated`                       | ✅     | Ambas policies: `polcmd = 'r'`, `polroles = {authenticated}`, `using_clause = true` (const bool).                                                                                                                                                                                                                                               |
| 11  | 0 policies de escritura                                                    | ✅     | `polcmd in ('a','w','d')` count = `0`. Nota menor: la consulta del spec usa `'i','w','d'` pero `polcmd` no tiene valor `'i'` en Postgres (INSERT es `'a'`); ambas interpretaciones devuelven `0`, semánticamente equivalente.                                                                                                                   |
| 12  | Triggers `set_updated_at` en ambas tablas                                  | ✅     | `pg_trigger` count = `2` (`rooms_set_updated_at`, `children_set_updated_at`). Función `public.set_updated_at()` reusada de DB-02.                                                                                                                                                                                                               |
| 13  | Índice `rooms_daycare_id_idx`                                              | ✅     | `pg_indexes` count = `1`.                                                                                                                                                                                                                                                                                                                       |
| 14  | Índices `children_room_id_idx`, `children_status_idx`                      | ✅     | `pg_indexes` count = `2`.                                                                                                                                                                                                                                                                                                                       |
| 15  | Seed: 3 salas en `Sala Soles`                                              | ✅     | `Soles`, `Lunitas`, `Estrellitas` vinculados al daycare `Sala Soles` (FK válida).                                                                                                                                                                                                                                                               |
| 16  | Total `rooms` = 3                                                          | ✅     | Solo las 3 salas semilla existen.                                                                                                                                                                                                                                                                                                               |
| 17  | Total `children` = 0                                                       | ✅     | Sin seed de niños en este spec.                                                                                                                                                                                                                                                                                                                 |
| 18  | Grants `SELECT` a `authenticated`                                          | ✅     | `information_schema.role_table_grants` retorna 2 filas (1 por tabla).                                                                                                                                                                                                                                                                           |
| 19  | `get_advisors` sin issues críticos sobre `rooms`/`children`/`child_status` | ✅     | Solo `WARN` heredados (`function_search_path_mutable` sobre `set_updated_at`; `security_definer` sobre `handle_new_user`/`rls_auto_enable`; `auth_leaked_password_protection`) y `INFO` `unused_index` (esperable: tablas recién creadas, sin queries aún). **Ningún ERROR** sobre los objetos de este spec. Documentado en §Riesgos.           |
| 20  | `pnpm lint` y `npx tsc --noEmit` verdes                                    | ✅     | Ambos exit `0`. La app Next.js no cambió en este spec (control de regresión OK).                                                                                                                                                                                                                                                                |
| 21  | `git log -1 -- supabase/migrations/` muestra el commit con la migración    | ❌     | `git log -- supabase/migrations/20260824150000_create_rooms_children.sql` no retorna nada — el archivo nunca fue commiteado. Vinculado al fallo del criterio #2.                                                                                                                                                                                |

### Validaciones adicionales (fuera de la lista de criterios)

- **Dependencias (paso 2 del plan):** `Sala Soles` existe (1 fila), `public.set_updated_at()` existe (1 fila), `pgcrypto` activo (1 fila) — todas OK.
- **FK `ON DELETE RESTRICT`:** `rooms_daycare_id_fkey` y `children_room_id_fkey` definidas con `ON DELETE RESTRICT` según spec.
- **Defaults de `children`:** `enrolled_at = CURRENT_DATE`, `allergy_tags = '{}'::text[]`, `photo_consent = true`, `status = 'active'::child_status` — todos correctos.
- **Coincidencia con doc de schema (`../07-DB-Schema`):** Las tablas `rooms` y `children` y el ENUM `child_status` en la DB live coinciden con la sección 3 y 4 del doc de schema de referencia.

### Notas por criterio fallido

1. **Criterio #1 (stale):** El spec evolucionó de `Borrador` a `aprobado` (correctamente, según el workflow), pero la lista de criterios de aceptación no se actualizó. Acción sugerida: cambiar el criterio a "existe en estado `Aprobado` o posterior" o añadir un criterio equivalente que verifique el estado actual.
2. **Criterios #2 y #21 (migración no commiteada):** El archivo de migración fue creado en el filesystem pero `git add`/`git commit` nunca se ejecutó. El commit `a3fe600` commiteó el spec y `specs/08-rooms-and-children-server-actions.md` pero olvidó `supabase/migrations/20260824150000_create_rooms_children.sql`. Acción concreta:
   ```bash
   git add supabase/migrations/20260824150000_create_rooms_children.sql
   git commit -m "feat(db): add rooms and children migration file"
   ```
   (El commit `a3fe600` ya cubre el lado "aprobado", pero la migración debe vivir en git para que `supabase db push` desde main pueda replicar el schema en otros entornos.)

### Conclusión

El spec está **implementado correctamente en la base de datos live** (todos los objetos, grants, RLS, políticas, triggers, índices y seed están en su lugar y coinciden con el DDL del spec). Los dos criterios que fallan son **documentales / de control de versiones**: el spec está en estado `aprobado` (no `Borrador`) y la migración no fue commiteada. Ningún fallo afecta el comportamiento de runtime de la app o de RLS — el DB está listo para que SPEC 08 (`rooms-and-children-server-actions`) enchufe los server actions tipados.
