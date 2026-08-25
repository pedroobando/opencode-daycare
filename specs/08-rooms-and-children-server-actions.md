# SPEC 08 — Server actions CRUD para `rooms` y `children`

> **Estado:** Implementado
> **Depende de:** SPEC DB-03 (tablas `public.rooms` y `public.children` + ENUM `child_status`), SPEC 07 (`createSupabaseServerClient`, `getCurrentUser`)
> **Fecha:** 2026-08-24
> **Objetivo:** Crear server actions CRUD para `rooms` y `children` en `app/actions/`, tipados contra `database.types.ts`, con validación inline y filtro multi-tenant por `daycare_id` del usuario actual, listos para que la UI (`/kids`, `/kids/[id]`, modal "Agregar niño") los invoque.

## Por qué este spec existe

Con las tablas `rooms` y `children` ya creadas en DB-03, la UI sigue tirando del mock `app/lib/kids.ts` (SPEC 02/04). Este spec cierra esa brecha sin tocar la UI todavía: aterriza la capa de server actions tipada que la UI podrá consumir cuando llegue el spec de wiring. Se sigue la convención de `app/actions/auth/` (SPEC 07): un archivo por action con `'use server'`, arrow functions, factory `createSupabaseServerClient()`, validación inline con state tipado `{ error: string | null }` para usar con `useActionState`.

> **CAVEAT IMPORTANTE — RLS bloquea las escrituras en este spec.** Este spec mantiene el patrón RLS de DB-03: SELECT abierto a `authenticated`, sin policies de INSERT/UPDATE/DELETE. Por lo tanto, las 5 acciones de escritura (`createRoom`, `updateRoom`, `deleteRoom`, `createChild`, `updateChild`, `archiveChild`) **fallarán en runtime con `new row violates row-level security policy`** hasta que un spec futuro habilite las policies de escritura por rol. Las 2 acciones de lectura (`listRooms`, `listChildren`) funcionan de inmediato y son las que se verifican funcionalmente en este spec. Las escrituras se verifican **estructuralmente** (cuerpo del action correcto + uso del cliente server + `.from(...).insert/update/delete(...)`). Esto queda documentado en §Decisiones y §Riesgos.

## Alcance

**Incluye:**

- Carpetas `app/actions/rooms/` y `app/actions/children/`, cada una con un archivo por action + barrel `index.ts`.
- `app/actions/rooms/types.ts` y `app/actions/children/types.ts` con tipos compartidos (`RoomRow`, `RoomInsert`, `ChildRow`, `ChildInsert`, `ChildWithRoom`) derivados de `Database['public']['Tables']['rooms' | 'children']` en `database.types.ts`.
- **Acciones de rooms (`app/actions/rooms/`):**
  - `list-rooms.ts` — `listRooms(): Promise<RoomRow[]>` — lee todas las rooms, filtra por `daycare_id = currentUserDaycareId`, ordena por `name` ascendente. Usada por la UI para poblar selectores de sala y divisores de `/kids`.
  - `create-room.ts` — `createRoom(prevState: CreateRoomState, formData: FormData): Promise<CreateRoomState>` — signature de `useActionState`. Lee `name` del form, resuelve `daycare_id` del usuario actual (no del form), valida nombre (≥ 2 chars, ≤ 60 chars, trim), inserta vía `supabase.from('rooms').insert(...)`. State: `{ error: string | null }`.
  - `update-room.ts` — `updateRoom(id: string, patch: { name?: string }): Promise<{ error: string | null }>` — actualiza `name`. Antes de update, valida que la room pertenece al `daycare_id` del usuario actual (lectura + comparación app-level). Si no pertenece, devuelve `{ error: 'No autorizado.' }` sin tocar DB.
  - `delete-room.ts` — `deleteRoom(id: string): Promise<{ error: string | null }>` — DELETE directo. Valida pertenencia al daycare. Captura error `23503` (FK violated) de Postgres y devuelve mensaje claro: `'No se puede borrar: la sala tiene niños activos.'`.
  - `index.ts` — barrel que re-exporta `listRooms`, `createRoom`, `updateRoom`, `deleteRoom` y los tipos de `types.ts`.
- **Acciones de children (`app/actions/children/`):**
  - `list-children.ts` — `listChildren(opts?: { roomId?: string }): Promise<ChildWithRoom[]>` — lee children con JOIN a `rooms` para nombre de sala, filtra por `daycare_id = currentUserDaycareId` (via subquery a `rooms` con `in (...)`), filtra opcionalmente por `room_id`, ordena por `full_name`. `ChildWithRoom` extiende `ChildRow` con `rooms: { id: string; name: string; daycare_id: string } | null`.
  - `create-child.ts` — `createChild(prevState: CreateChildState, formData: FormData): Promise<CreateChildState>` — signature de `useActionState`. Lee del form: `full_name`, `birth_date` (string `dd/mm/aaaa`), `room_id`, `medical_notes`, `allergy_tags` (CSV), `photo_consent` (`'on'` si marcado). Valida: nombre obligatorio y ≥ 2 chars; fecha válida, no futura, formato `dd/mm/aaaa`; `room_id` obligatorio y debe pertenecer al daycare del usuario; `medical_notes` opcional; `allergy_tags` se splitea por coma, se trimea y se filtran empty strings. Inserta vía `supabase.from('children').insert(...)`. State: `{ error: string | null }`.
  - `update-child.ts` — `updateChild(id: string, patch: Partial<{ full_name: string; birth_date: string; room_id: string; medical_notes: string | null; allergy_tags: string[]; photo_consent: boolean; status: 'active' | 'archived' }>): Promise<{ error: string | null }>` — actualiza subset de campos. Valida pertenencia al daycare (via `room_id → rooms.daycare_id`). Si cambia `room_id`, valida que la nueva sala pertenece al daycare.
  - `archive-child.ts` — `archiveChild(id: string): Promise<{ error: string | null }>` — actualiza `status='archived'`. Valida pertenencia. Devuelve `{ error: 'No autorizado.' }` si la child pertenece a otro daycare.
  - `index.ts` — barrel.
- Helper privado `app/actions/_lib/current-daycare.ts` (no es server action, es utility) con arrow function `getCurrentUserDaycareId(): Promise<string | null>`: combina `auth.getUser()` + `select daycare_id from public.users where id = auth.uid()`. Devuelve `null` si no hay sesión o no hay fila en `public.users` (defensivo). Exporta también `requireCurrentUserDaycareId(): Promise<string>` que tira excepción si devuelve `null` (uso interno de las actions que sí o sí necesitan daycare).
- Tipos exportados: `RoomRow`, `RoomInsert`, `RoomUpdate`, `ChildRow`, `ChildInsert`, `ChildUpdate`, `ChildWithRoom`, `CreateRoomState`, `CreateChildState`, `UpdateRoomState`, `UpdateChildState`.
- `database.types.ts` regenerado vía MCP `generate_typescript_types` o CLI `supabase gen types typescript --linked --schema=public` para que `Database['public']['Tables']['rooms' | 'children']` ya esté tipado y las actions compilen.
- Mensajes de error en español con voseo, igual que `app/actions/auth/sign-in.ts` (ej. `'Ingresá un nombre.'`, `'La fecha no puede ser en el futuro.'`, `'No autorizado.'`, `'No se puede borrar: la sala tiene niños activos.'`).

**Fuera de alcance (siguientes specs):**

- Refactor de `/kids`, `/kids/[id]` y modal "Agregar niño" para invocar estas actions (siguiente spec, `09-kids-ui-wired-to-db` o similar).
- Policies de INSERT/UPDATE/DELETE en DB (sin esto, las 5 escrituras fallan con RLS denial — caveat explícito).
- Server actions para `parent_children`, `invitations`, `posts`, `reactions`, `comments`, `daily_summaries`.
- Upload real de foto del niño (Storage); `photo_consent` sigue como boolean plano.
- Validación de duplicados por nombre.
- Validación de cupos por sala.
- Reasignación masiva de niños entre salas.
- Soft-delete de salas (no existe `status` en `rooms`; el delete es físico, protegido por FK RESTRICT).
- Cambio de `app/lib/kids.ts` (la UI sigue mockeada hasta el spec de wiring; este spec solo agrega la capa nueva, no rompe lo existente).
- Paginación / búsqueda server-side (la UI sigue mockeada, así que `listChildren` devuelve todo el set hasta un spec posterior que defina paginación).
- Auditoría / log de quién creó o modificó cada niño.
- Realtime subscriptions sobre `children` o `rooms`.
- Tests automatizados (no hay framework configurado).
- BroadcastChannel o revalidación de caché: la convención de Next.js 16 con `revalidatePath('/kids')` se aplica solo en el spec de wiring de UI.

## Modelo de datos

Este spec no introduce tablas. Reutiliza `public.rooms` y `public.children` de DB-03 y `public.users` de DB-02.

Tipos TypeScript a introducir (todos derivados de `Database`, no se duplica la forma):

```ts
// app/actions/rooms/types.ts
import type { Database } from '@/database.types';

export type RoomRow = Database['public']['Tables']['rooms']['Row'];
export type RoomInsert = Database['public']['Tables']['rooms']['Insert'];
export type RoomUpdate = Database['public']['Tables']['rooms']['Update'];

export type CreateRoomState = {
  error: string | null;
};

export type UpdateRoomState = {
  error: string | null;
};
```

```ts
// app/actions/children/types.ts
import type { Database } from '@/database.types';

export type ChildRow = Database['public']['Tables']['children']['Row'];
export type ChildInsert = Database['public']['Tables']['children']['Insert'];
export type ChildUpdate = Database['public']['Tables']['children']['Update'];

export type ChildWithRoom = ChildRow & {
  rooms: { id: string; name: string; daycare_id: string } | null;
};

export type CreateChildState = {
  error: string | null;
};

export type UpdateChildState = {
  error: string | null;
};
```

Helper privado (no server action):

```ts
// app/actions/_lib/current-daycare.ts
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getCurrentUserDaycareId = async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data } = await supabase
    .from('users')
    .select('daycare_id')
    .eq('id', user.id)
    .single();
  return data?.daycare_id ?? null;
};

export const requireCurrentUserDaycareId = async (): Promise<string> => {
  const daycareId = await getCurrentUserDaycareId();
  if (daycareId === null) {
    throw new Error('No authenticated user with daycare_id');
  }
  return daycareId;
};
```

> **Nota sobre la API del cliente:** `database.types.ts` (DB-02) ya tiene los tipos de `daycares` y `users`. Este spec requiere regenerarlo para incluir `rooms`, `children` y `child_status`. Si el comando de regeneración agrega tipos para tablas que no usamos, se mantienen (no son ruido para el compilador).

## Plan de implementación

1. Cargar la skill `supabase` antes de tocar el cliente (AGENTS.md lo exige).
2. Regenerar `database.types.ts` con las nuevas tablas: ejecutar `generate_typescript_types` (MCP) o `supabase gen types typescript --linked --schema=public` (CLI). Commitear el archivo regenerado.
3. Crear `app/actions/_lib/current-daycare.ts` con `getCurrentUserDaycareId` y `requireCurrentUserDaycareId` (arrow functions, según convención de AGENTS.md).
4. Crear `app/actions/rooms/types.ts` con los tipos `RoomRow`, `RoomInsert`, `RoomUpdate`, `CreateRoomState`, `UpdateRoomState`.
5. Crear `app/actions/rooms/list-rooms.ts` con `'use server'`:
   - `export const listRooms = async (): Promise<RoomRow[]>`.
   - Resuelve `daycareId = await getCurrentUserDaycareId()`. Si `null`, devuelve `[]`.
   - `const { data, error } = await supabase.from('rooms').select('*').eq('daycare_id', daycareId).order('name', { ascending: true });`.
   - Si `error`, devuelve `[]`. Si `data`, devuelve `data`.
6. Crear `app/actions/rooms/create-room.ts` con `'use server'`:
   - Tipo `CreateRoomState = { error: string | null }`.
   - `export const createRoom = async (_prev: CreateRoomState, formData: FormData): Promise<CreateRoomState>`.
   - Lee `name = (formData.get('name') ?? '').toString().trim()`.
   - Valida: si `name.length < 2 || name.length > 60`, devuelve `{ error: 'El nombre debe tener entre 2 y 60 caracteres.' }`.
   - `daycareId = await requireCurrentUserDaycareId()` (puede tirar si no hay sesión, pero la UI siempre está detrás del proxy de SPEC 07).
   - `const { error } = await supabase.from('rooms').insert({ daycare_id: daycareId, name }).select().single();`.
   - Si `error`, mapea códigos: `23505` (unique violation) → `'Ya existe una sala con ese nombre.'`; genérico → `'No pudimos crear la sala. Probá de nuevo.'`. Devuelve `{ error }`.
   - Si OK, `redirect('/kids')` (importado de `next/navigation`).
7. Crear `app/actions/rooms/update-room.ts` con `'use server'`:
   - `export const updateRoom = async (id: string, patch: { name?: string }): Promise<{ error: string | null }>`.
   - Si `patch.name` viene, valida longitud igual que create.
   - Valida pertenencia: `const { data: room } = await supabase.from('rooms').select('daycare_id').eq('id', id).single();` — si `room?.daycare_id !== currentDaycareId`, devuelve `{ error: 'No autorizado.' }`.
   - `await supabase.from('rooms').update(patch).eq('id', id);` maneja el `error` y devuelve state.
8. Crear `app/actions/rooms/delete-room.ts` con `'use server'`:
   - `export const deleteRoom = async (id: string): Promise<{ error: string | null }>`.
   - Valida pertenencia igual que update.
   - `await supabase.from('rooms').delete().eq('id', id);`.
   - Si `error.code === '23503'` (FK violation) → `{ error: 'No se puede borrar: la sala tiene niños activos.' }`. Genérico → `{ error: 'No pudimos borrar la sala.' }`.
9. Crear `app/actions/rooms/index.ts` con `export { listRooms, createRoom, updateRoom, deleteRoom } from './...';` y `export type { RoomRow, ... } from './types';`.
10. Crear `app/actions/children/types.ts` con `ChildRow`, `ChildInsert`, `ChildUpdate`, `ChildWithRoom`, `CreateChildState`, `UpdateChildState`.
11. Crear `app/actions/children/list-children.ts` con `'use server'`:
    - `export const listChildren = async (opts?: { roomId?: string }): Promise<ChildWithRoom[]>`.
    - Resuelve `daycareId = await getCurrentUserDaycareId()`. Si `null`, devuelve `[]`.
    - Construye query: `let q = supabase.from('children').select('*, rooms!inner(id, name, daycare_id)').eq('rooms.daycare_id', daycareId).order('full_name', { ascending: true });`.
    - Si `opts?.roomId`, agrega `.eq('room_id', opts.roomId)`.
    - Si `error`, devuelve `[]`. Si `data`, devuelve `data as ChildWithRoom[]`.
    - **Nota:** `rooms!inner` fuerza INNER JOIN porque filtramos por `rooms.daycare_id`. Si la room no existe o la FK está rota, la fila se filtra (no aparece).
12. Crear `app/actions/children/create-child.ts` con `'use server'`:
    - Tipo `CreateChildState = { error: string | null }`.
    - `export const createChild = async (_prev: CreateChildState, formData: FormData): Promise<CreateChildState>`.
    - Lee: `full_name`, `birth_date` (string `dd/mm/aaaa`), `room_id`, `medical_notes`, `allergy_tags` (CSV), `photo_consent` (`formData.get('photo_consent') === 'on'`).
    - Valida `full_name` (≥ 2 chars).
    - Parsea `birth_date` `dd/mm/aaaa` → `YYYY-MM-DD`. Función helper `parseDdMmYyyy(value: string): string | null`. Valida que la fecha parseada sea válida y no esté en el futuro.
    - Valida `room_id` no vacío y pertenencia: `const { data: room } = await supabase.from('rooms').select('daycare_id').eq('id', roomId).single();` — si `room?.daycare_id !== currentDaycareId`, devuelve `{ error: 'No autorizado.' }`.
    - Splitea `allergy_tags` por coma, trimea, filtra empty.
    - `const { error } = await supabase.from('children').insert({ room_id, full_name, birth_date, medical_notes: medicalNotes || null, allergy_tags, photo_consent }).select().single();`.
    - Mapea errores y devuelve state. OK → `redirect('/kids')`.
13. Crear `app/actions/children/update-child.ts` con `'use server'`:
    - `export const updateChild = async (id: string, patch: Partial<{ full_name: string; birth_date: string; room_id: string; medical_notes: string | null; allergy_tags: string[]; photo_consent: boolean; status: 'active' | 'archived' }>): Promise<{ error: string | null }>`.
    - Si `patch.birth_date` viene como `dd/mm/aaaa`, lo parsea a `YYYY-MM-DD` antes de update.
    - Si `patch.room_id` cambia, valida pertenencia de la nueva sala.
    - Valida pertenencia del child via `room → daycare_id`. Si no pertenece al daycare del usuario, `{ error: 'No autorizado.' }`.
    - `await supabase.from('children').update(patch).eq('id', id);`.
14. Crear `app/actions/children/archive-child.ts` con `'use server'`:
    - `export const archiveChild = async (id: string): Promise<{ error: string | null }>`.
    - Internamente hace `updateChild(id, { status: 'archived' })`.
15. Crear `app/actions/children/index.ts` con barrel.
16. Verificar compilación: `npx tsc --noEmit` debe pasar (los tipos de `database.types.ts` ya incluyen `rooms` y `children` por el paso 2).
17. Verificar linting: `pnpm lint` debe pasar.
18. Verificar build: `pnpm build` debe pasar (control de regresión).
19. Verificación funcional de las lecturas: ejecutar un script Node server-only en `/tmp/opencode/verify-list.ts` que se autentica como `pedro@gmail.com` y llama `listRooms()` y `listChildren()`. Debe devolver 3 rooms (`Soles`, `Lunitas`, `Estrellitas`) y 0 children. **Esta verificación confirma que las lecturas funcionan en el estado actual** (RLS permite SELECT).
20. Verificación estructural de las escrituras: revisar manualmente que cada action body contiene la llamada correcta (`supabase.from('rooms').insert/update/delete(...)` o `supabase.from('children').insert/update(...)`) con la validación de pertenencia antes. Documentar en §Resultados de verificación que la verificación runtime de las escrituras queda deferida al spec de "policies de escritura".

## Criterios de aceptación

- [x] Existe `specs/08-rooms-and-children-server-actions.md` (estado avanzado a `Implementado`; el criterio original decía `Borrador`, obsoleto por flujo).
- [x] `database.types.ts` regenerado y commiteado, contiene `rooms: { Row: ..., Insert: ..., Update: ... }`, `children: { ... }`, y `Enums.child_status: 'active' | 'archived'`.
- [x] Existen los archivos:
  - `app/actions/_lib/current-daycare.ts`
  - `app/actions/rooms/types.ts`, `list-rooms.ts`, `create-room.ts`, `update-room.ts`, `delete-room.ts`, `index.ts`
  - `app/actions/children/types.ts`, `list-children.ts`, `create-child.ts`, `update-child.ts`, `archive-child.ts`, `index.ts`
- [x] Cada archivo de action tiene `'use server'` en la primera línea.
- [x] Cada action es una arrow function exportada.
- [x] `app/actions/rooms/index.ts` re-exporta `listRooms`, `createRoom`, `updateRoom`, `deleteRoom` y los tipos `RoomRow`, `RoomInsert`, `RoomUpdate`, `CreateRoomState`, `UpdateRoomState`.
- [x] `app/actions/children/index.ts` re-exporta `listChildren`, `createChild`, `updateChild`, `archiveChild` y los tipos `ChildRow`, `ChildInsert`, `ChildUpdate`, `ChildWithRoom`, `CreateChildState`, `UpdateChildState`.
- [x] `listRooms()` filtra por `daycare_id = currentUserDaycareId` (verificable por lectura del body).
- [x] `listChildren()` filtra por `rooms.daycare_id = currentUserDaycareId` vía `!inner` JOIN (verificable por lectura del body).
- [x] `createRoom` y `createChild` resuelven `daycare_id` (o `room_id`) desde el usuario actual, no desde el form (verificable por lectura del body).
- [x] `updateRoom`, `updateChild`, `archiveChild`, `deleteRoom` validan pertenencia al daycare del usuario antes de tocar la fila (verificable por lectura del body).
- [x] `deleteRoom` captura el código de error `23503` de Postgres y devuelve el mensaje `'No se puede borrar: la sala tiene niños activos.'` (verificable por lectura del body).
- [x] `createChild` parsea `birth_date` de `dd/mm/aaaa` a `YYYY-MM-DD` antes del INSERT (verificable por lectura del body).
- [x] Mensajes de error en español con voseo, consistentes con `app/actions/auth/sign-in.ts`.
- [x] Verificación funcional de lecturas: tras autenticarse como `pedro@gmail.com` y llamar `listRooms()`, devuelve 3 filas (`Soles`, `Lunitas`, `Estrellitas`). `listChildren()` devuelve 0 filas. Verificado vía script Node server-only en `/tmp/opencode/verify-list.ts`.
- [x] Caveat de RLS documentado en §Decisiones, §Riesgos y comentario al top de `app/actions/rooms/create-room.ts` y `app/actions/children/create-child.ts`.
- [x] `npx tsc --noEmit` exit 0.
- [x] `pnpm lint` exit 0.
- [x] `pnpm build` exit 0 (control de regresión).

## Decisiones

- **Sí: helper privado `app/actions/_lib/current-daycare.ts`.** Encapsula la query a `public.users` para resolver el `daycare_id` del usuario actual. Se usa en las 8 actions. La convención con underscore-prefixed folder `_lib/` indica que no son server actions públicas — son utilities.
- **Sí: nombres `getCurrentUserDaycareId` y `requireCurrentUserDaycareId`.** API tipo `get*` (devuelve `null` si no hay) y `require*` (tira excepción). Patrón estándar.
- **Sí: validación de pertenencia en cada action de escritura.** `update*` y `delete*` validan app-level leyendo la fila antes de update/delete. Esto es defensa en profundidad: aunque RLS está abierto, evitamos que un usuario modifique una sala de otro daycare por accidente.
- **Sí: `createRoom` y `createChild` resuelven `daycare_id`/`room_id` desde el usuario actual, no del form.** Esto evita que un padre envíe un `room_id` de otro daycare por manipulación del form. La UI no expone ese input; las actions lo ignoran si viene.
- **Sí: signature `(prevState, formData)` en `createRoom` y `createChild` (no en las otras).** Patrón de `useActionState` para forms (SPEC 07). Las demás (`list`, `update`, `archive`, `delete`) son programáticas — se llaman desde client components directamente, no desde un `<form action={...}>`. El caller maneja el state.
- **Sí: en `createRoom` y `createChild`, `redirect('/kids')` en el happy path.** Sigue el patrón de `app/actions/auth/sign-in.ts`. El client component `useActionState` no necesita manejar `data`; el redirect cierra el ciclo.
- **Sí: `deleteRoom` con DELETE físico (no archivado lógico).** `rooms` no tiene columna `status` en DB-03 (no estaba en el schema doc original). El archivado lógico no aplica. La FK RESTRICT protege contra borrar salas con niños activos.
- **Sí: `archiveChild` con UPDATE `status='archived'` (archivado lógico).** `children` sí tiene `status child_status`. Mantener histórico de posts, comentarios y reacciones referidas al niño.
- **Sí: `listChildren` con `rooms!inner(...)` JOIN.** INNER JOIN fuerza a descartar children huérfanos (sin room válida o con room de otro daycare). Esto combina el filtro multi-tenant con la validación de integridad referencial en una sola query.
- **Sí: helper `parseDdMmYyyy` privado en `app/actions/children/create-child.ts` (o en `_lib/`).** Consistente con la máscara `dd/mm/aaaa` del modal "Agregar niño" actual (SPEC 04). Centralizar el parser facilita migrar a otro formato después.
- **Sí: `allergy_tags` se splitea por coma, se trimea y se filtran empty strings.** Input humano del form.
- **Sí: tipos derivados de `database.types.ts` con `Database['public']['Tables']['rooms']['Row']` etc.** No se duplica la forma — si la tabla cambia, los tipos cambian con ella. Solo `ChildWithRoom` agrega el campo `rooms` que es la relación embebida del JOIN.
- **No: barrel con `export *`.** Export explícito de cada nombre — más legible, evita exportar por accidente algo interno.
- **No: validación de duplicados por nombre.** Mismo razonamiento que DB-03: el dominio no exige unicidad de nombre de niño. Si se quiere uniqueness por guardería, va en otro spec.
- **No: paginación.** `listChildren` devuelve todo el set; la UI está mockeada y no consume esta action todavía. Cuando llegue el spec de wiring de UI, se evalúa paginación si el dataset lo justifica.
- **No: storage ni upload de foto del niño.** `photo_consent` se persiste como boolean plano.
- **No: policies de INSERT/UPDATE/DELETE en DB.** **Caveat central:** este spec mantiene el RLS de DB-03 (SELECT abierto, 0 writes). Por lo tanto `createRoom`, `updateRoom`, `deleteRoom`, `createChild`, `updateChild` y `archiveChild` van a fallar en runtime con `new row violates row-level security policy` o `permission denied for table X` hasta que un spec futuro habilite las policies de escritura. Esto se documenta explícitamente en comentarios al top de los archivos de creación y como WARNING al inicio de este spec. La verificación funcional de las escrituras queda deferida a ese spec futuro. Las 2 lecturas (`listRooms`, `listChildren`) sí se verifican funcionalmente en este spec.
- **No: revalidación de caché con `revalidatePath`.** La UI sigue mockeada; no hay nada que revalidar todavía. Cuando llegue el wiring, se aplica `revalidatePath('/kids')` y `revalidatePath('/kids/[id]')` después de las mutaciones.
- **No: tests automatizados.** No hay framework configurado en el proyecto. La verificación funcional de lecturas se hace con un script Node server-only en `/tmp/opencode/`, fuera del repo.

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS bloquea INSERT/UPDATE/DELETE en runtime** (caveat central del spec)                                    | Documentado en §Por qué este spec existe, §Decisiones, §Riesgos y como comentario al top de `create-room.ts` / `create-child.ts` / `update-room.ts` / `delete-room.ts` / `update-child.ts` / `archive-child.ts`. Verificación funcional de escrituras queda deferida al spec de "policies de escritura por rol". |
| `database.types.ts` no se regenera y los tipos `Database['public']['Tables']['rooms']` no existen            | Paso 2 del plan regenera antes de crear las actions. Sin este paso, `pnpm build` falla.                                                                                                                                                                                                                          |
| `getCurrentUserDaycareId` devuelve `null` para usuario no autenticado y rompe la action con excepción        | Las actions de escritura usan `requireCurrentUserDaycareId` que tira excepción clara. Las de lectura usan `getCurrentUserDaycareId` y devuelven `[]` defensivamente. La UI está detrás del proxy de SPEC 07 — un usuario no autenticado nunca llega acá.                                                         |
| Manipulación del form: el cliente envía un `room_id` de otro daycare                                         | `createChild` y `updateChild` validan que `room.daycare_id === currentUserDaycareId` antes del INSERT/UPDATE. Si no coincide, devuelve `{ error: 'No autorizado.' }`. Defensa en profundidad (la UI no expone ese input).                                                                                        |
| SQL injection o input malicioso en `name` / `full_name` / `medical_notes`                                    | Todas las queries pasan por el cliente parametrizado de `@supabase/ssr` (no raw SQL). Las strings se trimean y se valida longitud. No hay riesgo de inyección.                                                                                                                                                   |
| `parseDdMmYyyy` no maneja bien años bisiestos o meses de 30/31 días                                          | Validación adicional: después de parsear a `Date`, se verifica que `getDate() === parseInt(dd)` para confirmar que la fecha es real (rechaza `31/02/2024`). Mensaje: `'Fecha inválida.'`.                                                                                                                        |
| FK RESTRICT de `children.room_id` rompe `deleteRoom` con error genérico de Postgres                          | `deleteRoom` captura `error.code === '23503'` y devuelve mensaje claro. Si el código de error de Postgres cambia en el futuro, fallback al mensaje genérico.                                                                                                                                                     |
| `listChildren` con `rooms!inner` devuelve menos filas que el total si hay FK rotas                           | Es el comportamiento deseado: un child con `room_id` apuntando a una sala inexistente no aparece en el listado. Es consistente con el INNER JOIN.                                                                                                                                                                |
| Helper `_lib/current-daycare.ts` importa `'server-only'` para impedir uso accidental desde client components | Se agrega `import 'server-only';` al top del archivo. AGENTS.md no lo exige pero es buena práctica de Next.js 16 para utilities que solo deben correr en server.                                                                                                                                                 |
| `npx tsc --noEmit` falla si los tipos de `database.types.ts` no se regeneraron                               | Paso 2 es prerequisito. Sin regeneración, los tipos `Database['public']['Tables']['rooms']` no existen y el build falla con error claro.                                                                                                                                                                         |
| Listar `listChildren()` devuelve 0 siempre porque la policy SELECT exige algo más que `using (true)`         | DB-03 deja `using (true)` abierto. Verificado en paso 19 con script Node. Si falla, revisar policy en DB.                                                                                                                                                                                                        |

## Qué **no** entra en este spec

- Refactor de `/kids`, `/kids/[id]`, modal "Agregar niño" para invocar estas server actions.
- Policies de INSERT/UPDATE/DELETE en DB (sin esto, las escrituras fallan — caveat explícito).
- Server actions para `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`.
- Upload real de foto del niño (Storage); `photo_consent` se persiste como boolean plano.
- Validación de duplicados por nombre.
- Validación de cupos por sala.
- Reasignación masiva de niños entre salas.
- Soft-delete de salas (no existe `status` en `rooms`).
- Cambio de `app/lib/kids.ts` (la UI sigue mockeada hasta el spec de wiring; este spec agrega la capa nueva sin romper lo existente).
- Paginación / búsqueda server-side.
- Auditoría / log de quién creó o modificó cada niño.
- Realtime subscriptions sobre `children` o `rooms`.
- `revalidatePath` post-mutación (la UI no consume las actions todavía).
- Tests automatizados.
- BroadcastChannel para sincronizar cambios entre tabs.
- Regeneración del script de signup (`/tmp/opencode/`) — sigue siendo el mismo de DB-02.

Cada uno de estos, si aterriza, va en su propio spec (con numeración `09-`, `10-`, …) o en `specs/dbase/` (si toca DB).

## Resultados de verificación

Implementado en la rama `spec-08-rooms-and-children-server-actions` (2026-08-24).

- **Paso 16** — `npx tsc --noEmit`: exit 0.
- **Paso 17** — `pnpm lint`: exit 0 (0 errors, 0 warnings).
- **Paso 18** — `pnpm build`: exit 0; rutas intactas (`/`, `/auth`, `/auth/active`, `/kids`, `/kids/[id]` + Proxy).
- **Paso 19 (verificación funcional de lecturas)** — script Node server-only en `/tmp/opencode/verify-list.mjs` (equivalente ESM del `verify-list.ts` previsto): autentica como `pedro@gmail.com`, resuelve `daycare_id` y replica exactamente las queries de `listRooms()` y `listChildren()`.
  - `listRooms()` → `['Estrellitas', 'Lunitas', 'Soles']` — 3 filas, ordenadas por `name` asc. ✅
  - `listChildren()` → 0 filas. ✅
- **Paso 20 (verificación estructural de escrituras)** — revisión de bodies confirmada:
  - `create-room.ts` → `.from('rooms').insert({ daycare_id, name })` con `daycare_id` desde `requireCurrentUserDaycareId()`. ✅
  - `update-room.ts` / `delete-room.ts` → ownership check (`room.daycare_id !== daycareId`) antes de `.update()/.delete()`. ✅
  - `create-child.ts` → `.from('children').insert({...})` tras validar pertenencia de `room_id` al daycare del usuario. ✅
  - `update-child.ts` → doble ownership check (room actual + nueva room) antes de `.update()`. ✅
  - `archive-child.ts` → delega en `updateChild(id, { status: 'archived' })`. ✅
  - **La verificación runtime de las escrituras queda deferida al spec de "policies de escritura por rol"** (RLS de DB-03 bloquea INSERT/UPDATE/DELETE — ver caveat al inicio y §Riesgos).
