# SPEC 01 (DB) — Tabla raíz `daycares`

> **Estado:** Aprobado
> **Folder:** `specs/dbase/` (primer spec de DB; numeración independiente de `specs/`)
> **Depende de:** —
> **Fecha:** 2026-08-23
> **Objetivo:** Crear la tabla `daycares` (raíz del modelo) en Supabase con RLS habilitada, las 4 filas semilla temáticas y la primera migración versionada del proyecto, siguiendo el patrón imperativo de migraciones del repo.

## Alcance

**Incluye:**

- Carpeta `specs/dbase/` con `.gitkeep` para anclar la convención del folder DB.
- Carpeta `supabase/migrations/` con `.gitkeep` para que git la registre aún sin migraciones aplicadas.
- Tabla `public.daycares` con `id uuid PK default gen_random_uuid()`, `name text not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- `alter table public.daycares enable row level security`.
- Una (1) policy de SELECT: `to authenticated using (true)`. Sin policies de `INSERT` / `UPDATE` / `DELETE`.
- `drop policy if exists` previo a `create policy` (robustez ante re-ejecución manual).
- Seed bundled en la propia migración con los 4 nombres: `Sala Soles`, `Sala Mariposas`, `Sala Estrellitas`, `Sala Arcoíris`.
- Migración limpia generada con `supabase db pull create_daycares --local --yes` y committeada en `supabase/migrations/<timestamp>_create_daycares.sql`.
- `get_advisors` (security + performance) sin issues críticos al final del flujo.
- Verificación de catálogo contra `pg_class`, `pg_policy` y `information_schema.role_table_grants`.

**Fuera de alcance (siguientes specs):**

- Tablas `users`, `rooms`, `children`, `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`.
- Trigger `before update` para auto-actualizar `updated_at`.
- Policies de escritura (llegan con `users.role = admin`).
- ENUMs (`user_role`, `user_status`, `relationship_type`, `invitation_status`, `post_type`, `child_status`).
- Cambios en la app Next.js (`app/`, `lib/`, componentes, mocks).
- UI para listar / crear / editar daycares.
- Storage, Edge Functions, Realtime, pg_cron, pgvector.
- Esquema declarativo (`supabase/schemas/`).
- Tests automatizados (no hay framework configurado en el proyecto).

## Modelo de datos

DDL exacto (idéntico al que vivirá en el archivo de migración):

```sql
-- supabase/migrations/<timestamp>_create_daycares.sql

create table if not exists public.daycares (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.daycares enable row level security;

drop policy if exists daycares_select_authenticated on public.daycares;
create policy daycares_select_authenticated
  on public.daycares
  for select
  to authenticated
  using (true);

-- Sin policies de INSERT/UPDATE/DELETE: escritura denegada por defecto.
-- Se agregan policies por rol admin en un spec posterior (post users.role=admin).

insert into public.daycares (name) values
  ('Sala Soles'),
  ('Sala Mariposas'),
  ('Sala Estrellitas'),
  ('Sala Arcoíris');
```

Notas:

- `pgcrypto` debe estar activo en el proyecto (necesario para `gen_random_uuid()`); se valida en el paso 3 del plan y, si falta, se agrega en una migración previa.
- No hay `grant select … to authenticated` explícito en el DDL: el rol `authenticated` hereda `SELECT` sobre tablas de `public` por defecto en Supabase. Se valida vía `information_schema.role_table_grants` en el paso 5.
- No hay trigger `before update` para auto-actualizar `updated_at`: la migración se mantiene mínima. Si más adelante se quiere, va en una migración aparte.
- No hay índice único sobre `name`: dos guarderías distintas pueden compartir nombre comercial.

## Plan de implementación

1. **Cargar la skill `supabase-postgres-best-practices`** antes de cualquier cambio en Postgres (AGENTS.md lo exige).
2. **Crear las carpetas ancla en git**: `supabase/migrations/.gitkeep` y `specs/dbase/.gitkeep`. Sin estos archivos la carpeta no queda tracked hasta el primer commit con contenido real.
3. **Validar `pgcrypto` activo** vía `execute_sql` (MCP): `select extname from pg_extension where extname = 'pgcrypto';`. Si la consulta devuelve vacío, aplicar `create extension if not exists pgcrypto;` antes de continuar y commitearlo como una migración previa.
4. **Aplicar DDL iterativo con `execute_sql` (MCP), nunca `apply_migration`** — la skill `supabase` es más estricta que AGENTS.md en este punto. Ejecutar de a pasos para detectar errores temprano:
   - 4.1 `create table if not exists public.daycares (...)`.
   - 4.2 `alter table public.daycares enable row level security`.
   - 4.3 `drop policy if exists …` + `create policy daycares_select_authenticated …`.
   - 4.4 `insert into public.daycares (name) values (...), (...), (...), (...);`.
5. **Verificar grants existentes** con `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'daycares';`. Debe aparecer `authenticated` con `SELECT`. Si falta, agregar `grant select on public.daycares to authenticated;` antes de commitear la migración (no después de generada).
6. **Correr `get_advisors`** (MCP) en modo security y performance. Resolver cualquier issue crítico antes de continuar.
7. **Generar la migración limpia** con `supabase db pull create_daycares --local --yes`. Verificar antes `supabase --version` (la flag `--local --yes` requiere CLI ≥ 2.81.3). Si la versión no alcanza, escribir la migración a mano desde el DDL de §Modelo de datos (es trivial).
8. **Diff manual** del archivo `supabase/migrations/<timestamp>_create_daycares.sql` generado contra el DDL de §Modelo de datos: debe ser semánticamente equivalente (puede diferir en whitespace u orden de sentencias, no en contenido).
9. **Commitear** `supabase/migrations/` + `specs/dbase/01-daycares-table.md` (el usuario corre `git commit` con su mensaje; este spec no ejecuta el commit).
10. **Verificación final** contra los criterios de aceptación (queries de catálogo detalladas abajo).

## Criterios de aceptación

- [ ] Existe `specs/dbase/01-daycares-table.md` en estado `Borrador`.
- [ ] Existe `supabase/migrations/<timestamp>_create_daycares.sql` commiteado, con el DDL completo de Modelo de datos (tabla + RLS + policy + 4 INSERTs).
- [ ] Existen `supabase/migrations/.gitkeep` y `specs/dbase/.gitkeep`.
- [ ] `select count(*) from public.daycares;` devuelve `4`.
- [ ] `select name from public.daycares order by name;` devuelve, en orden, `Sala Arcoíris`, `Sala Estrellitas`, `Sala Mariposas`, `Sala Soles`.
- [ ] `select relrowsecurity from pg_class where relname = 'daycares' and relnamespace = 'public'::regnamespace;` devuelve `true`.
- [ ] `select count(*) from pg_policy where polrelid = 'public.daycares'::regclass;` devuelve `1`.
- [ ] Esa única policy tiene `polcmd = 'r'` y su rol asociado es `authenticated` (consulta a `pg_policy` + `pg_roles`).
- [ ] `select count(*) from pg_policy where polrelid = 'public.daycares'::regclass and polcmd in ('i','u','d');` devuelve `0`.
- [ ] `select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'daycares' and grantee = 'authenticated' and privilege_type = 'SELECT';` devuelve al menos una fila.
- [ ] `get_advisors` (MCP) no reporta issues críticos sobre `public.daycares` después de aplicar el DDL.
- [ ] `pnpm lint` y `npx tsc --noEmit` siguen verdes (la app Next.js no cambia en este spec; esto es control de regresión).
- [ ] `git log -1 -- supabase/migrations/` muestra el commit con la migración.

## Decisiones

- **Sí: ubicación del spec en `specs/dbase/` con numeración independiente DB-01.** AGENTS.md es explícito: las specs de DB no van en `specs/`. Folder se crea con este spec.
- **Sí: workflow `execute_sql` (MCP) para iterar + `supabase db pull --local --yes` para commitear.** La skill `supabase` es más estricta que AGENTS.md: `apply_migration` escribe historial en cada llamada y rompe el flujo de iteración, así que no se usa.
- **Sí: `drop policy if exists` previo a `create policy`.** Robustez ante re-ejecución manual del SQL; costo cero, ningún efecto colateral real.
- **Sí: seed bundled en la propia migración** con los 4 nombres temáticos (`Sala Soles`, `Sala Mariposas`, `Sala Estrellitas`, `Sala Arcoíris`). Decisión del usuario. `supabase migration up` no re-ejecuta la migración aplicada, así que no hay riesgo de duplicados en flujo normal.
- **Sí: SELECT abierto a `authenticated` con `using (true)`.** Necesario para que la app pueda filtrar por `daycare_id` cuando exista `users`. Multi-tenant MVP — toda guardería visible para todo usuario autenticado. Se acota en specs futuros con policies que comparen `auth.uid()` contra `users.daycare_id`.
- **No: policies de escritura en este spec.** No existe el rol `admin` todavía (depende de `users`). Crearlas leyendo `auth.jwt() -> 'app_metadata' ->> 'admin'` sería prematuro.
- **Sí: incluir `updated_at`** aunque la entrada de `daycares` en el doc de schema lo omita. La convención global (`created_at` / `updated_at`) figura en el preámbulo del doc y en AGENTS.md; mantener la convención evita una migración correctiva futura. La omisión en la fila de `daycares` parece descuido editorial del doc.
- **No: trigger `before update` para auto-actualizar `updated_at`.** Migración mínima. Si después se quiere, va en su propia migración.
- **No: índice único sobre `name`.** Distintas guarderías pueden compartir nombre comercial (ej. "Guardería Sagrada Familia" en dos ciudades distintas). PK cubre lo único que necesita ser único: `id`.
- **No: grants explícitos en el DDL.** El rol `authenticated` hereda `SELECT` sobre tablas nuevas de `public` por configuración por defecto de Supabase. Se valida en el paso 5 del plan y, solo si falta, se agrega un `grant select on public.daycares to authenticated;` antes de commitear la migración.
- **No: esquema declarativo (`supabase/schemas/`).** AGENTS.md lo descarta. Sigue imperativo.

## Riesgos

| Riesgo                                                                                                          | Mitigación                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pgcrypto` no habilitado → `gen_random_uuid()` falla                                                            | Paso 3 valida antes de aplicar; si falta, migración previa con `create extension if not exists pgcrypto;`.                                                                     |
| Data API settings del proyecto no expone `public` a `authenticated` → SELECT falla desde cliente                | Paso 5 consulta `information_schema.role_table_grants`; si falta el grant, agregar `grant select on public.daycares to authenticated;` antes de generar la migración (paso 7). |
| CLI < 2.81.3 → `db pull --local --yes` no soportado                                                             | Verificar `supabase --version` en el paso 7 antes de invocar el comando. Si la versión no alcanza, escribir la migración a mano desde el DDL de §Modelo de datos.              |
| Re-ejecución manual de la migración falla por INSERTs duplicados                                                | Aceptable: `supabase migration up` no re-ejecuta migraciones aplicadas; el seed se documenta como one-shot dentro del archivo.                                                 |
| `drop policy if exists` aparece como `NOTICE` ruidoso en logs de Supabase                                       | No es un error real: la policy no existe en la primera ejecución. Documentado en decisiones.                                                                                   |
| Bundled seed inicial hace el primer deploy irreversible en datos (no se puede "des-sembrar" desde la migración) | Aceptable para MVP. Si después se quiere revertir, se hace con `delete from public.daycares;` ad-hoc; no exige otra migración.                                                 |

## Qué **no** entra en este spec

- Cualquier otra tabla del modelo (`users`, `rooms`, `children`, `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`).
- Trigger de auto-update para `updated_at`.
- Policies de `INSERT` / `UPDATE` / `DELETE` sobre `daycares`.
- Tipo `user_role` ni ningún otro ENUM.
- Lógica de aplicación, componentes React, cambios en `app/` o `lib/`, reemplazo de mocks en memoria por lecturas a Supabase.
- Auth UI o flujo de signup.
- Storage, Edge Functions, Realtime, pg_cron, pgvector.
- Migración a esquema declarativo (`supabase/schemas/`).
- Tests automatizados.

Cada uno de estos, si aterriza, va en su propio spec dentro de `specs/dbase/` (con numeración `02-`, `03-`, …) o en `specs/` (si toca UI / app).
