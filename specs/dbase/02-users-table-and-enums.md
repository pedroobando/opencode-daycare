# SPEC 02 (DB) — Tabla `users` con ENUMs, RLS y trigger de signup

> **Estado:** Aprobado
> **Folder:** `specs/dbase/` (DB-02)
> **Depende de:** SPEC DB-01 (`daycares`)
> **Fecha:** 2026-08-23
> **Objetivo:** Crear la tabla `public.users` con sus ENUMs (`user_role`, `user_status`), RLS con SELECT abierto y UPDATE propio, FK a `auth.users` y `daycares`, y un trigger `AFTER INSERT` sobre `auth.users` que cree la fila leyendo `daycare_id`/`role`/`full_name` desde `raw_user_meta_data`.

## Alcance

**Incluye:**

- ENUMs `public.user_role` (`staff`, `parent`, `admin`) y `public.user_status` (`pending`, `active`, default `active`).
- Tabla `public.users` con FK a `auth.users(id)` ON DELETE CASCADE, FK a `daycares(id)` ON DELETE RESTRICT NOT NULL, columnas de dominio (`role`, `status`, `full_name`, `avatar_url`, `notify_on_post`, `daily_summary_enabled`, timestamps), índices sobre `daycare_id` y `role`.
- Función genérica `public.set_updated_at()` y trigger `users_set_updated_at` para auto-actualizar `updated_at` en cada UPDATE.
- RLS habilitada en `public.users`.
- Policies:
  - `users_select_authenticated` — SELECT abierto a `authenticated` con `using (true)`.
  - `users_update_self` — UPDATE a `authenticated` con `using (id = (select auth.uid()))` y `with check (id = (select auth.uid()) and daycare_id y role inmutables)`.
  - Sin policies de INSERT/DELETE (inserción exclusiva vía trigger; borrado vía cascade desde `auth.users`).
- Función `public.handle_new_user()` con trigger `on_auth_user_created` AFTER INSERT sobre `auth.users` que crea la fila en `public.users` leyendo `raw_user_meta_data ->> 'daycare_id'`, `raw_user_meta_data ->> 'role'`, `raw_user_meta_data ->> 'full_name'`. Validación: falla loudly si `daycare_id` o `full_name` faltan, o si `role` no pertenece al enum.
- Migración limpia generada con `supabase db pull create_users --local --yes` y committeada en `supabase/migrations/<timestamp>_create_users.sql`.
- `get_advisors` (security + performance) sin issues críticos sobre `public.users` ni sobre `handle_new_user`.
- Verificación funcional: signup del usuario Staff de prueba `pedro@gmail.com` (password `abcd1234#`) vía `supabase.auth.signUp` con `raw_user_meta_data = { daycare_id: <UUID Sala Soles>, role: 'staff', full_name: 'Pedro Tester' }` produce fila correcta en `public.users`.

**Fuera de alcance (siguientes specs):**

- Tablas `rooms`, `children`, `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`.
- ENUMs `relationship_type`, `invitation_status`, `post_type`, `child_status`.
- Flujo de invitación de padres.
- UI / signup UI en Next.js (llega con specs de UI en `specs/`).
- Cualquier policy de admin / staff que escriba sobre otros usuarios.
- Soft-delete del usuario (borrado sigue siendo cascade desde `auth.users`).
- Avatar upload (Storage); `avatar_url` queda como texto libre.
- Realtime subscriptions sobre `users`.
- Edge Functions, pg_cron, pgvector.
- Migración a esquema declarativo (`supabase/schemas/`).
- Tests automatizados.

## Modelo de datos

DDL exacto (idéntico al que vivirá en el archivo de migración):

```sql
-- supabase/migrations/<timestamp>_create_users.sql

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
```

Notas:

- La función `handle_new_user` se declara `SECURITY DEFINER` y con `set search_path = ''` (convención Supabase para funciones de trigger sobre `auth.users` — la inserción en `auth.users` no es accesible desde otros roles sin esto). `AGENTS.md` advierte sobre `SECURITY DEFINER` en `public`; la mitigación es: body mínimo (un solo `INSERT`), `set search_path = ''` para evitar hijacking, y validación estricta de inputs.
- `on delete restrict` en `daycare_id` evita borrar una guardería con usuarios asociados (debe hacerse soft-delete o reasignación previa).
- El cast `(new.raw_user_meta_data ->> 'role')::public.user_role` falla con un error claro de Postgres si el valor no está en el enum.
- `with check` en `users_update_self` impide que un usuario se auto-promueva de rol o se cambie de guardería.
- El trigger corre en el contexto del usuario que insertó en `auth.users`; con `SECURITY DEFINER` se ejecuta con los privilegios del dueño de la función, evitando tropiezos con RLS al insertar.

### Datos del usuario Staff de prueba (solo para verificación, no se persiste en la migración)

| Campo | Valor |
|---|---|
| `email` | `pedro@gmail.com` |
| `password` | `abcd1234#` |
| `full_name` (metadata) | `Pedro Tester` |
| `role` (metadata) | `staff` |
| `daycare_id` (metadata) | UUID de `Sala Soles` (resuelto en runtime con `select id from public.daycares where name = 'Sala Soles';`) |

El signup de este usuario se ejecuta desde un script Node server-only al final del plan de implementación. **No** queda embebido en la migración SQL.

## Plan de implementación

1. **Cargar la skill `supabase-postgres-best-practices`** antes de cualquier cambio en Postgres (AGENTS.md lo exige).
2. **Validar `auth.users` accesible**: `select 1 from auth.users limit 0;` debe ejecutarse sin error. Supabase lo crea por defecto; este paso es defensivo.
3. **Validar que `Sala Soles` existe en `public.daycares`**: `select id from public.daycares where name = 'Sala Soles';`. Si no existe, abortar (depende de SPEC DB-01).
4. **Aplicar DDL iterativo con `execute_sql` (MCP)** — mismo patrón que SPEC DB-01, nunca `apply_migration`. Ejecutar de a pasos para detectar errores temprano:
   - 4.1 `create type public.user_role …` y `create type public.user_status …`.
   - 4.2 `create table if not exists public.users …` con FKs y defaults.
   - 4.3 `create index if not exists users_daycare_id_idx …` y `create index if not exists users_role_idx …`.
   - 4.4 Crear función `public.set_updated_at()` + `drop trigger if exists users_set_updated_at on public.users;` + `create trigger users_set_updated_at …`.
   - 4.5 `alter table public.users enable row level security` + `drop policy if exists …` + `create policy users_select_authenticated …` + `create policy users_update_self …`.
   - 4.6 Crear función `public.handle_new_user()` + `drop trigger if exists on_auth_user_created on auth.users;` + `create trigger on_auth_user_created …`.
5. **Verificar grants**: `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'users';`. Debe haber al menos `SELECT` para `authenticated`. Si falta, agregar grants explícitos antes de generar la migración.
6. **Verificar catálogo**:
   - `select relrowsecurity from pg_class where relname = 'users' and relnamespace = 'public'::regnamespace;` → `true`.
   - `select count(*) from pg_policy where polrelid = 'public.users'::regclass;` → exactamente `2` (SELECT + UPDATE).
   - `select count(*) from pg_policy where polrelid = 'public.users'::regclass and polcmd in ('i','d');` → `0`.
   - `select tgname, tgrelid::regclass from pg_trigger where tgrelid in ('public.users'::regclass, 'auth.users'::regclass) and tgname in ('users_set_updated_at', 'on_auth_user_created');` → ambas filas presentes.
7. **Correr `get_advisors`** (MCP) en security y performance. Resolver cualquier issue crítico sobre `public.users` o `handle_new_user` antes de continuar.
8. **Verificación funcional** del trigger y de las policies — script Node server-only en `/tmp/opencode/signup-pedro.ts`:
   - 8.1 Resolver UUID de `Sala Soles` con `execute_sql`.
   - 8.2 Antes del signup, verificar idempotencia: `select id from auth.users where email = 'pedro@gmail.com';` — si existe fila, eliminarla (cascade limpia `public.users`).
   - 8.3 Crear cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY` desde env (el script vive fuera del repo, en `/tmp/opencode/`; las claves no se commitean).
   - 8.4 `await supabase.auth.admin.createUser({ email: 'pedro@gmail.com', password: 'abcd1234#', email_confirm: true, user_metadata: { daycare_id: '<UUID Sala Soles>', role: 'staff', full_name: 'Pedro Tester' } });`.
   - 8.5 Esperar a que el trigger corra (Postgres lo hace en la misma transacción del INSERT en `auth.users` — lectura inmediata tras `createUser` debe verlo).
   - 8.6 `execute_sql`: `select u.id, u.role, u.full_name, u.daycare_id, d.name as daycare_name, au.email from public.users u join public.daycares d on d.id = u.daycare_id join auth.users au on au.id = u.id where au.email = 'pedro@gmail.com';` — debe devolver `role='staff'`, `full_name='Pedro Tester'`, `daycare_name='Sala Soles'`, `email='pedro@gmail.com'`.
9. **Verificación de la policy UPDATE self**: con un cliente Supabase autenticado como `pedro@gmail.com` (anon key + `signInWithPassword`), ejecutar:
   - 9.1 `update public.users set role='admin' where id = auth.uid();` → debe afectar `0` filas (RLS bloquea por `with check`).
   - 9.2 `update public.users set daycare_id = (select id from public.daycares where name = 'Sala Mariposas') where id = auth.uid();` → debe afectar `0` filas.
   - 9.3 `update public.users set full_name = 'Otro nombre' where id = auth.uid();` → debe afectar `1` fila (cambios de campos no congelados sí pasan).
10. **Correr `get_advisors`** (MCP) nuevamente después de la verificación funcional — capturar cualquier issue post-triggers.
11. **Generar la migración limpia** con `supabase db pull create_users --local --yes`. Verificar antes `supabase --version` (la flag `--local --yes` requiere CLI ≥ 2.81.3). Si la versión no alcanza, escribir la migración a mano desde el DDL de §Modelo de datos.
12. **Diff manual** del archivo `supabase/migrations/<timestamp>_create_users.sql` generado contra §Modelo de datos: debe ser semánticamente equivalente (puede diferir en whitespace u orden, no en contenido).
13. **Commitear** `supabase/migrations/<timestamp>_create_users.sql` + `specs/dbase/02-users-table-and-enums.md` (el usuario corre `git commit` con su mensaje; este spec no ejecuta el commit).
14. **Verificación final** contra los criterios de aceptación (queries de catálogo detalladas abajo).

## Criterios de aceptación

- [ ] Existe `specs/dbase/02-users-table-and-enums.md` en estado `Aprobado`.
- [ ] Existe `supabase/migrations/<timestamp>_create_users.sql` commiteado, con el DDL completo de §Modelo de datos (ENUMs + tabla + 2 índices + `set_updated_at` + trigger + RLS + 2 policies + `handle_new_user` + trigger auth).
- [ ] `select count(*) from pg_type where typname in ('user_role', 'user_status') and typnamespace = 'public'::regnamespace;` devuelve `2`.
- [ ] `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'user_role' order by enumsortorder;` devuelve, en orden, `staff`, `parent`, `admin`.
- [ ] `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'user_status' order by enumsortorder;` devuelve, en orden, `pending`, `active`.
- [ ] `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'users';` devuelve `1`.
- [ ] `select relrowsecurity from pg_class where relname = 'users' and relnamespace = 'public'::regnamespace;` devuelve `true`.
- [ ] `select count(*) from pg_policy where polrelid = 'public.users'::regclass;` devuelve exactamente `2`.
- [ ] `select count(*) from pg_policy where polrelid = 'public.users'::regclass and polcmd = 'r';` devuelve `1`.
- [ ] `select count(*) from pg_policy where polrelid = 'public.users'::regclass and polcmd = 'u';` devuelve `1`.
- [ ] `select count(*) from pg_policy where polrelid = 'public.users'::regclass and polcmd in ('i','d');` devuelve `0`.
- [ ] `select count(*) from pg_trigger where tgname = 'users_set_updated_at' and tgrelid = 'public.users'::regclass;` devuelve `1`.
- [ ] `select count(*) from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass;` devuelve `1`.
- [ ] `select count(*) from pg_indexes where schemaname = 'public' and tablename = 'users' and indexname in ('users_daycare_id_idx', 'users_role_idx');` devuelve `2`.
- [ ] `select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'users' and grantee = 'authenticated' and privilege_type = 'SELECT';` devuelve al menos una fila.
- [ ] **Verificación funcional — usuario Staff `pedro@gmail.com`**: tras `supabase.auth.admin.createUser` con `raw_user_meta_data = { daycare_id: <UUID Sala Soles>, role: 'staff', full_name: 'Pedro Tester' }`, existe una fila en `public.users` con `role = 'staff'`, `full_name = 'Pedro Tester'`, `daycare_id` apuntando a `Sala Soles`, y `auth.users.email = 'pedro@gmail.com'`.
- [ ] **Verificación de policy UPDATE self — cambio de `role`**: tras autenticarse como `pedro@gmail.com`, `update public.users set role='admin' where id = (select auth.uid());` afecta `0` filas.
- [ ] **Verificación de policy UPDATE self — cambio de `daycare_id`**: tras autenticarse como `pedro@gmail.com`, `update public.users set daycare_id = '<UUID Sala Mariposas>' where id = (select auth.uid());` afecta `0` filas.
- [ ] **Verificación de policy UPDATE self — cambio permitido de `full_name`**: `update public.users set full_name = 'Pedro Modificado' where id = (select auth.uid());` afecta exactamente `1` fila.
- [ ] `get_advisors` (MCP) no reporta issues críticos sobre `public.users` ni sobre `public.handle_new_user` después de aplicar el DDL y de la verificación funcional.
- [ ] `pnpm lint` y `npx tsc --noEmit` siguen verdes (la app Next.js no cambia en este spec; control de regresión).
- [ ] `git log -1 -- supabase/migrations/` muestra el commit con la migración.

## Decisiones

- **Sí: `daycare_id NOT NULL`.** Coherente con el modelo multi-tenant del proyecto. No se prevén admins cross-daycare en el MVP.
- **Sí: `id` PK + FK a `auth.users(id) ON DELETE CASCADE`.** Patrón canónico Supabase: misma UUID que la fila de Auth, borrado en cascada cuando se borra el usuario de Auth.
- **Sí: `daycare_id ... ON DELETE RESTRICT`.** Impide borrar una guardería con usuarios asociados (debe hacerse soft-delete o reasignación). Defensive default.
- **Sí: `role` NOT NULL, `status` NOT NULL DEFAULT `'active'`.** Toda fila de `public.users` debe tener un rol; estado default `active` cubre el caso post-signup. `pending` se usa cuando hay invitación previa (llega con `invitations`).
- **Sí: `notify_on_post` y `daily_summary_enabled` booleanos NOT NULL con default `true`.** Coherente con el doc de schema; NOT NULL evita filas con NULL que la UI tendría que tratar como "sin preferencia".
- **Sí: trigger genérico `set_updated_at` reutilizable.** Aplica a `users` y puede aplicarse a `children`, `posts`, etc. sin duplicar lógica. Nombre de trigger específico por tabla (`users_set_updated_at`) para evitar colisiones.
- **Sí: `SECURITY DEFINER` en `handle_new_user` con `set search_path = ''`.** Patrón estándar de Supabase para triggers sobre `auth.users` (la inserción en `auth.users` no es escribible desde otros roles sin esto). Mitigado con `set search_path = ''`, validación de inputs y body mínimo.
- **Sí: validación en `handle_new_user` que falle loudly** si `daycare_id` o `full_name` faltan en metadata. Mejor signup fallido que fila huérfana.
- **Sí: SELECT abierto a `authenticated` con `using (true)`.** Mismo patrón que `daycares` (SPEC DB-01): necesario para filtrar por `daycare_id`, se acota en specs futuros con policies por membresía de daycare.
- **Sí: UPDATE propio con `WITH CHECK` que congela `role` y `daycare_id`.** Impide auto-escalación de privilegios y movimiento cross-daycare. Combinado con `USING` cubre el patrón de AGENTS.md para evitar BOLA.
- **No: policy de INSERT.** Solo el trigger crea filas. Bloquea inserciones manuales desde la API.
- **No: policy de DELETE.** Borrado se hace desde `auth.users` (cascade). Mantenerlo bloqueado desde la API evita soft-delete accidental.
- **No: grants explícitos en el DDL.** Se valida en el paso 5 del plan. Solo se agregan si faltan.
- **No: índice único sobre `users.email`.** El email vive en `auth.users.email` (UNIQUE ahí). Duplicarlo rompe la regla de "no duplicar email".
- **No: índice único sobre `(daycare_id, role)`.** Necesario solo cuando se hagan queries pesadas por combinación; las cardinalidades actuales no lo justifican. Índices simples `daycare_id` y `role` cubren los casos esperados.
- **No: flow de invitación incluido.** Pertenece al spec de `invitations` (siguiente lógico).
- **No: avatar upload.** `avatar_url` queda como texto libre. Storage llega cuando se especifique.
- **Sí: usuario de prueba `pedro@gmail.com` con password `abcd1234#`.** Decisión del usuario en este prompt. Se crea vía `supabase.auth.admin.createUser` con metadata al final del flujo (no se persiste en la migración SQL).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `SECURITY DEFINER` sobre `handle_new_user` ejecuta con privilegios amplios | `set search_path = ''` evita hijacking; validación de inputs (UUID válido, role válido, full_name no vacío) cierra el attack surface; la función solo hace INSERT en `public.users` con valores del metadata. |
| Trigger sobre `auth.users` se dispara para TODOS los signups, incluidos usuarios sin metadata (OAuth sin custom claims) | `handle_new_user` lanza excepción si falta `daycare_id` o `full_name`. Signups OAuth sin metadata fallan al crear el usuario de Auth (Postgres revierte la transacción). Comportamiento deseable: no queremos filas en `public.users` sin daycare. |
| Cast `(raw_user_meta_data ->> 'role')::public.user_role` falla si llega un role inválido | Excepción clara de Postgres. La app cliente puede validar antes de signup. No degrada el sistema; mejor fail-fast que fila inválida. |
| Re-ejecución manual de la migración falla por `create type` duplicado | Aceptable: `supabase migration up` no re-ejecuta migraciones aplicadas. Si se re-corre manualmente, `create type` falla claramente. |
| Trigger genérico `set_updated_at` colisiona con el de otra migración futura | Nombre específico por tabla (`users_set_updated_at`) — cada spec crea el suyo. |
| `pedro@gmail.com` ya existe en `auth.users` por un test previo | Paso 8.2 del plan limpia antes del signup. |
| `Sala Soles` no existe aún en `public.daycares` (depende de SPEC DB-01) | Paso 3 del plan valida antes del DDL; abortar si no existe. |
| `email_confirm` requerido en el proyecto impide signups desde `createUser` | Se usa `supabase.auth.admin.createUser` con `email_confirm: true`, que saltea el flujo de confirmación. Si el proyecto tiene reglas más estrictas, ajustar el script. |
| `SUPABASE_SERVICE_ROLE_KEY` filtrada al commitar el script de verificación | El script vive en `/tmp/opencode/`, fuera del repo. No se commitea. Si más adelante se necesita dentro del repo, mover a scripts server-only con permiso de gitignore explícito. |

## Qué **no** entra en este spec

- Cualquier otra tabla del modelo (`rooms`, `children`, `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`).
- ENUMs `relationship_type`, `invitation_status`, `post_type`, `child_status`.
- Flow de invitación de padres (spec propio, depende de `invitations`).
- UI / signup UI en Next.js (specs en `specs/`).
- Policies de admin / staff que escriban sobre otros usuarios.
- Soft-delete de usuario.
- Avatar upload (Storage); `avatar_url` queda como texto libre.
- Dispositivos push (`devices`).
- Realtime subscriptions sobre `users`.
- Edge Functions para signup customizado.
- Migración a esquema declarativo (`supabase/schemas/`).
- Tests automatizados.
- Commitear el script de signup (vive en `/tmp/opencode/`, no en repo).

Cada uno de estos, si aterriza, va en su propio spec dentro de `specs/dbase/` (con numeración `03-`, `04-`, …) o en `specs/` (si toca UI / app).
