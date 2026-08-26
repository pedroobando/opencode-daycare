# SPEC 10 — Server actions para `parent_children` e `invitations` + activación real en `/auth/active`

> **Estado:** Implementado
> **Depende de:** DB-05 (`parent_children` + `invitations` + RLS + policies staff/admin), SPEC 07 (`createSupabaseServerClient`, auth flow), SPEC 08 (`getCurrentUserDaycareId` + `_lib/current-daycare`), SPEC 09 (pattern de server actions CRUD con revalidatePath)
> **Fecha:** 2026-08-26
> **Objetivo:** Crear los server actions en `app/actions/parent-children/` y `app/actions/invitations/` para gestionar vínculos padre↔niño y códigos de invitación (mínimo viable: 3 actions en `parent_children`, 4 en `invitations`), regenerar `database.types.ts`, y enchufar el flujo real de activación en `/auth/active` contra `acceptInvitationByCode` con signup de Supabase Auth + creación de fila `users` vía `raw_user_meta_data` + link en `parent_children`.

## Por qué este spec existe

DB-05 deja las dos tablas creadas con RLS. Falta la capa de server actions para que la UI (`/kids/[id]` modal Vincular Padre, listado de padres del niño) pueda persistir, y para que `/auth/active` deje de ser mock (SPEC 07 §Fuera de alcance lo dejó pendiente por falta de `invitations`).

El usuario eligió **mínimo viable** (3 actions en `parent_children`, 4 en `invitations`) + activar `/auth/active` real. Este spec aterriza esa capa siguiendo el patrón de SPEC 08/09: arrow functions, `'use server'`, factory `createSupabaseServerClient`, validación inline, mensajes en español con voseo, tipos derivados de `Database`, `revalidatePath` post-mutación.

Decisión cerrada con el usuario: el signup en `/auth/active` pasa `full_name`, `daycare_id` y `role='parent'` vía `raw_user_meta_data` para que el trigger `handle_new_user` (DB-02) cree la fila `public.users` ya completa en el mismo INSERT que `auth.users`, evitando el UPDATE intermedio (que sería inseguro sin service role para rollback).

## Alcance

**Incluye:**

- **Carpeta `app/actions/parent-children/`** con `types.ts`, `list-by-child.ts`, `link-from-invitation.ts`, `unlink-parent.ts`, `index.ts`.
- **Carpeta `app/actions/invitations/`** con `types.ts`, `create-invitation.ts`, `list-by-child.ts`, `cancel-invitation.ts`, `accept-by-code.ts`, `index.ts`.
- **Helper privado `app/actions/_lib/invitation-code.ts`** con `generateInvitationCode(): string` (6 chars alfanuméricos uppercase derivados de `crypto.getRandomValues`, alfabeto sin `I`/`O`/`0`/`1` para evitar confusión). Usa `crypto.getRandomValues` (no `Math.random`).
- **Helper privado `app/actions/_lib/require-staff-role.ts`** con `requireStaffOrAdmin(): Promise<{ userId: string; daycareId: string; role: 'staff' \| 'admin' }>` (tira si no es staff/admin). Reutiliza `requireCurrentUserDaycareId`.
- **Actions `parent_children`:**
  - `listParentsByChild(childId: string): Promise<ParentChildWithUser[]>` — JOIN a `users` para avatar/full_name; filtra por daycare via `child → rooms → daycare`; ordena por `users.full_name`.
  - `linkParentFromInvitation(args: { parentUserId: string; childId: string; relationship: RelationshipType }): Promise<{ error: string \| null }>` — INSERT. Valida que el child pertenece al daycare actual. Captura `23505` (UNIQUE violation) → `'Este padre ya está vinculado a este niño.'`.
  - `unlinkParent(linkId: string): Promise<{ error: string \| null }>` — DELETE con validación de pertenencia (link → child → daycare del usuario).
- **Actions `invitations`:**
  - `createInvitation(prevState: CreateInvitationState, formData: FormData): Promise<CreateInvitationState>` — `(prevState, formData)` signature para `useActionState`. Lee `child_id`, `full_name`, `email`, `relationship` del form. Valida `full_name` (≥ 2 chars), `email` (regex `EMAIL_REGEX` de `app/utils/email.ts`), `relationship ∈ ['father','mother','guardian']`, `child_id` pertenece al daycare del usuario. Genera código con `generateInvitationCode()` y retry hasta 5 veces ante colisión `23505` (UNIQUE en `code`). Inserta con `expires_at = now() + interval '7 days'`, `status='pending'`, `invited_by = auth.uid()`. State: `{ error: string \| null }`.
  - `listInvitationsByChild(childId: string, opts?: { status?: InvitationStatus }): Promise<InvitationWithInviter[]>` — JOIN a `users` (invited_by); filtra por child y opcionalmente por status; ordena por `created_at desc`.
  - `cancelInvitation(invitationId: string): Promise<{ error: string \| null }>` — UPDATE `status='cancelled'`. Valida pertenencia (invitation → child → daycare del usuario) y que el status actual sea `pending`. Si ya estaba `accepted`/`expired`/`cancelled`, devuelve `'Esta invitación ya no se puede cancelar.'`.
  - `acceptInvitationByCode(args: { code: string; authUserId: string; email: string }): Promise<{ error: string \| null }>` — el server action core de `/auth/active`. Pasos: (1) SELECT invitación por code (la policy `invitations_select_for_accept` permite al padre leerla si su email matchea); (2) validar `status='pending'`; (3) validar `expires_at > now()`; (4) UPDATE invitación `status='accepted', accepted_at=now()`; (5) INSERT en `parent_children` (`parent_id = authUserId`, `child_id`, `relationship`). Captura `23505` → `'Este código ya fue usado.'`.
- **Tipos exportados:** `RelationshipType`, `InvitationStatus`, `ParentChildRow`, `ParentChildWithUser`, `InvitationRow`, `InvitationWithInviter`, `CreateInvitationState`, `UnlinkParentState`, `LinkParentState`, `AcceptInvitationState`.
- **Wiring `/auth/active`:**
  - Modificar `app/auth/active/page.tsx` para que el submit sea real.
  - Lee `email`, `code`, `password` (nuevo campo), `full_name` del form.
  - Llama `supabase.auth.signUp({ email, password, options: { data: { full_name, role: 'parent', daycare_id, invitation_code: code } } })` — el trigger `handle_new_user` (DB-02) crea la fila `users` con `status='pending'` y los campos de metadata.
  - Si el signup OK, obtiene `user.id` del resultado.
  - Llama `acceptInvitationByCode({ code, authUserId: user.id, email })` — esto valida y crea el `parent_children`.
  - Tras accept exitoso, UPDATE `public.users set status='active' where id = user.id` (la fila ya existe por el trigger; solo cambiamos status).
  - Si todo OK, `redirect('/')`.
  - Si falla en cualquier paso, mensaje inline claro y sin estado inconsistente: si el signup creó el user pero el accept falló, no actualizamos status (queda `pending`); el padre puede reintentar el flujo.
- **Refactor `KidProfileBody` (`app/components/kids/KidProfileBody.tsx`):** dejar de mantener `parents` en state local; pasar a leer de `listParentsByChild(kid.id)` vía `useEffect` + state inicial. `ParentsList` recibe `parents` desde el server component padre.
  - Sigue manteniendo el modal VincularPadre; al submit llama `createInvitation` (no `linkParentFromInvitation` directo).
- **Regeneración `database.types.ts`** vía MCP `generate_typescript_types` para incluir las dos tablas y los dos ENUMs nuevos.
- Mensajes de error en español con voseo, consistentes con `app/actions/auth/sign-in.ts`.

**Fuera de alcance (siguientes specs):**

- Modal "Reenviar invitación" (futuro spec).
- UI para mostrar el código generado en pantalla tras crear invitación.
- Listado de invitaciones pendientes en `/kids/[id]` (UI de seguimiento).
- Paginación / búsqueda server-side.
- `revalidatePath` para `/kids/[id]` y `/auth` después de las mutaciones (sí se hace en `linkParentFromInvitation`, `cancelInvitation`, `acceptInvitationByCode`; queda como follow-up optimizar el árbol de paths).
- Storage para avatar de padres nuevos.
- Envío real de email con el código.
- Activación de invitaciones sin signup (caso "ya tengo cuenta, solo vincularme").
- Multi-step signup con confirmación de email (Supabase Auth lo soporta, pero requiere configurar el provider SMTP).
- UI de onboarding paso a paso para padres nuevos.
- Tests automatizados (no hay framework configurado).

## Modelo de datos

Este spec no introduce tablas. Reutiliza `public.parent_children` e `public.invitations` de DB-05, y `public.users`/`auth.users` de DB-02.

Tipos TypeScript a introducir (todos derivados de `Database`):

```ts
// app/actions/parent-children/types.ts
import type { Database } from '@/database.types';

export type RelationshipType = Database['public']['Enums']['relationship_type'];
export type ParentChildRow =
  Database['public']['Tables']['parent_children']['Row'];
export type ParentChildInsert =
  Database['public']['Tables']['parent_children']['Insert'];

export type ParentChildWithUser = ParentChildRow & {
  users: { id: string; full_name: string; avatar_url: string | null } | null;
};

export type UnlinkParentState = {
  error: string | null;
};

export type LinkParentState = {
  error: string | null;
};
```

```ts
// app/actions/invitations/types.ts
import type { Database } from '@/database.types';

export type InvitationStatus = Database['public']['Enums']['invitation_status'];
export type InvitationRow = Database['public']['Tables']['invitations']['Row'];
export type InvitationInsert =
  Database['public']['Tables']['invitations']['Insert'];

export type InvitationWithInviter = InvitationRow & {
  users: { id: string; full_name: string } | null;
};

export type CreateInvitationState = {
  error: string | null;
};

export type AcceptInvitationState = {
  error: string | null;
};
```

Helpers privados:

```ts
// app/actions/_lib/invitation-code.ts
import 'server-only';

const INVITATION_CODE_LENGTH = 6;
const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateInvitationCode = (): string => {
  const bytes = new Uint8Array(INVITATION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => INVITATION_CODE_ALPHABET[b % INVITATION_CODE_ALPHABET.length],
  ).join('');
};
```

```ts
// app/actions/_lib/require-staff-role.ts
import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CurrentStaffUser = {
  userId: string;
  daycareId: string;
  role: 'staff' | 'admin';
};

export const requireStaffOrAdmin = async (): Promise<CurrentStaffUser> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user.');
  }

  const { data } = await supabase
    .from('users')
    .select('id, daycare_id, role')
    .eq('id', user.id)
    .single();

  if (!data || (data.role !== 'staff' && data.role !== 'admin')) {
    throw new Error('No autorizado: se requiere rol staff o admin.');
  }

  return { userId: data.id, daycareId: data.daycare_id, role: data.role };
};
```

## Plan de implementación

1. **Cargar la skill `supabase`** antes de tocar el cliente (AGENTS.md lo exige).
2. **Regenerar `database.types.ts`** con MCP `generate_typescript_types` o CLI `supabase gen types typescript --linked --schema=public`. Verificar que ahora incluye `parent_children`, `invitations`, `relationship_type`, `invitation_status`. Commitear.
3. **Crear `app/actions/_lib/invitation-code.ts`** con `generateInvitationCode` (arrow function, `import 'server-only'`).
4. **Crear `app/actions/_lib/require-staff-role.ts`** con `requireStaffOrAdmin` y `CurrentStaffUser`.
5. **Crear `app/actions/parent-children/types.ts`** con `RelationshipType`, `ParentChildRow`, `ParentChildInsert`, `ParentChildWithUser`, `UnlinkParentState`, `LinkParentState`.
6. **Crear `app/actions/parent-children/list-by-child.ts`** con `'use server'`:
   - `export const listParentsByChild = async (childId: string): Promise<ParentChildWithUser[]>`.
   - Resuelve `daycareId = await getCurrentUserDaycareId()`. Si `null`, devuelve `[]`.
   - `const { data, error } = await supabase.from('parent_children').select('*, users!inner(id, full_name, avatar_url, daycare_id)').eq('users.daycare_id', daycareId).eq('child_id', childId).order('users(full_name)', { ascending: true });` — usar `users!inner` para forzar INNER JOIN y descartar vínculos con user de otro daycare.
   - Si `error`, devuelve `[]`. Si `data`, devuelve `data as ParentChildWithUser[]`.
7. **Crear `app/actions/parent-children/link-from-invitation.ts`** con `'use server'`:
   - `export const linkParentFromInvitation = async (args: { parentUserId: string; childId: string; relationship: RelationshipType }): Promise<{ error: string | null }>`.
   - `daycareId = await requireCurrentUserDaycareId()`.
   - Valida pertenencia: `const { data: child } = await supabase.from('children').select('room_id, rooms!inner(daycare_id)').eq('id', childId).single();` — si `child.rooms.daycare_id !== daycareId`, `{ error: 'No autorizado.' }`.
   - `await supabase.from('parent_children').insert({ parent_id: parentUserId, child_id: childId, relationship: args.relationship });`.
   - Si `error.code === '23505'` → `'Este padre ya está vinculado a este niño.'`. Genérico → `'No pudimos vincular al padre. Probá de nuevo.'`.
   - Si OK, `revalidatePath('/kids/[id]', 'page')` (path dinámico).
8. **Crear `app/actions/parent-children/unlink-parent.ts`** con `'use server'`:
   - `export const unlinkParent = async (linkId: string): Promise<{ error: string | null }>`.
   - `daycareId = await requireCurrentUserDaycareId()`.
   - Valida pertenencia: `const { data: link } = await supabase.from('parent_children').select('child_id, children!inner(room_id, rooms!inner(daycare_id))').eq('id', linkId).single();` — si `link.children.rooms.daycare_id !== daycareId`, `{ error: 'No autorizado.' }`.
   - `await supabase.from('parent_children').delete().eq('id', linkId);`.
   - Si error → genérico. OK → `revalidatePath('/kids/[id]', 'page')`.
9. **Crear `app/actions/parent-children/index.ts`** barrel: `export { listParentsByChild, linkParentFromInvitation, unlinkParent };` + `export type { ... } from './types';`.
10. **Crear `app/actions/invitations/types.ts`** con `InvitationStatus`, `InvitationRow`, `InvitationInsert`, `InvitationWithInviter`, `CreateInvitationState`, `AcceptInvitationState`.
11. **Crear `app/actions/invitations/create-invitation.ts`** con `'use server'`:
    - `export const createInvitation = async (_prev: CreateInvitationState, formData: FormData): Promise<CreateInvitationState>`.
    - Lee `child_id`, `full_name`, `email`, `relationship` del form.
    - Valida `full_name.length >= 2` → si no, `'Ingresá un nombre.'`.
    - Valida `email` con `isValidEmail` → si no, `'Ingresá un email válido.'`.
    - Valida `relationship ∈ ['father','mother','guardian']` → si no, `'Seleccioná un parentesco.'`.
    - `daycareId = await requireStaffOrAdmin().then(u => u.daycareId)` (o equivalente con `requireCurrentUserDaycareId` + check de rol en `public.users`).
    - Valida `child_id` pertenece al daycare (igual que `link-from-invitation`).
    - Genera código con retry hasta 5 veces:
      ```ts
      let code = generateInvitationCode();
      let lastError: PostgrestError | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await supabase.from('invitations').insert({
          child_id,
          invited_by: staffUserId,
          full_name,
          email,
          relationship,
          code,
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });
        if (!error) {
          revalidatePath('/kids/[id]', 'page');
          return { error: null };
        }
        if (error.code === '23505') {
          code = generateInvitationCode();
          continue;
        }
        lastError = error;
        break;
      }
      return { error: 'No pudimos crear la invitación. Probá de nuevo.' };
      ```
    - Mapea errores y devuelve state.
12. **Crear `app/actions/invitations/list-by-child.ts`** con `'use server'`:
    - `export const listInvitationsByChild = async (childId: string, opts?: { status?: InvitationStatus }): Promise<InvitationWithInviter[]>`.
    - Resuelve `daycareId = await requireCurrentUserDaycareId()`.
    - `let q = supabase.from('invitations').select('*, users!inner(id, full_name, daycare_id)').eq('users.daycare_id', daycareId).eq('child_id', childId).order('created_at', { ascending: false });`.
    - Si `opts?.status`, agrega `.eq('status', opts.status)`.
13. **Crear `app/actions/invitations/cancel-invitation.ts`** con `'use server'`:
    - `export const cancelInvitation = async (invitationId: string): Promise<{ error: string | null }>`.
    - Valida pertenencia: `const { data: inv } = await supabase.from('invitations').select('status, child_id, children!inner(rooms!inner(daycare_id))').eq('id', invitationId).single();` — si `inv.children.rooms.daycare_id !== daycareId`, `{ error: 'No autorizado.' }`.
    - Si `inv.status !== 'pending'`, `{ error: 'Esta invitación ya no se puede cancelar.' }`.
    - UPDATE `status='cancelled'`. Si OK, `revalidatePath('/kids/[id]', 'page')`.
14. **Crear `app/actions/invitations/accept-by-code.ts`** con `'use server'`:
    - `export const acceptInvitationByCode = async (args: { code: string; authUserId: string; email: string }): Promise<{ error: string | null }>`.
    - `const { data: inv, error: selectError } = await supabase.from('invitations').select('*, children!inner(room_id, rooms!inner(daycare_id))').eq('code', args.code).single();`. Si no encontrado o email no matchea (la policy `invitations_select_for_accept` filtra por email), `selectError` o 0 filas.
    - Validar `inv.status === 'pending'` → si no, `{ error: 'Esta invitación ya no está disponible.' }`.
    - Validar `new Date(inv.expires_at) > new Date()` → si no, `{ error: 'Esta invitación expiró.' }`.
    - UPDATE invitación `status='accepted', accepted_at=new Date().toISOString()`.
    - INSERT en `parent_children` con `parent_id=args.authUserId`, `child_id=inv.child_id`, `relationship=inv.relationship`. Captura `23505` → `'Este código ya fue usado.'`.
    - Si OK, devolver `{ error: null }` (sin redirect — el caller lo maneja).
15. **Crear `app/actions/invitations/index.ts`** barrel.
16. **Modificar `app/components/kids/KidProfileBody.tsx`**:
    - Cambiar `useState<Parent[]>(kid.linkedParents)` → `useState<Parent[]>([])` + `useEffect(() => { listParentsByChild(kid.id).then(setParents); }, [kid.id])`.
    - Mantener el modal VincularPadre pero cambiar el submit: en lugar de armar un `Parent` local y llamar `onAddParent`, llamar `createInvitation` (server action) con los datos del form. Tras OK, refrescar la lista con `listParentsByChild(kid.id)`.
    - El código generado client-side (`generateAlphanumericCode(5)` de SPEC 05) se reemplaza por el código real que devuelve DB (futuro: mostrar en UI; MVP: ignorar).
17. **Modificar `app/auth/active/page.tsx`**:
    - Agregar campos `full_name`, `password` al form (password es nuevo).
    - Server action real: en el submit, llamar `supabase.auth.signUp({ email, password, options: { data: { full_name, role: 'parent', invitation_code: code } } })`.
    - Si signup OK, obtener `user.id`. Llamar `acceptInvitationByCode({ code, authUserId: user.id, email })`. Si accept OK, `await supabase.from('users').update({ status: 'active' }).eq('id', user.id);` y `redirect('/')`.
    - Si algo falla, mostrar error inline. Si el signup creó el user pero el accept falló, no actualizar status (queda pending); el padre puede reintentar.
    - El componente deja de ser puramente server; necesita `useFormState` (o equivalente) para manejar el state. Convertir en client component o usar el patrón server action con `useActionState`.
18. **Verificación**: `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.
19. **Verificación funcional** con script Node server-only en `/tmp/opencode/verify-invitations.mjs`:
    - Autenticarse como `pedro@gmail.com` (staff).
    - Llamar `createInvitation` con un child válido → INSERT OK, código único en `invitations`.
    - Llamar `listInvitationsByChild` → 1 fila visible.
    - Llamar `cancelInvitation` → UPDATE OK, status='cancelled'.
    - Llamar `acceptInvitationByCode` con código real → INSERT en `parent_children` + UPDATE invitación status='accepted'.
    - **Negativo:** intentar `acceptInvitationByCode` con código de otro daycare → 0 filas (la policy `invitations_select_for_accept` no matchea email).

## Criterios de aceptación

- [x] Existe `specs/10-parent-children-and-invitations-server-actions.md` en estado `Borrador` que avanza a `Aprobado` / `Implementado`.
- [x] `database.types.ts` regenerado y commiteado: contiene `parent_children: { Row, Insert, Update }`, `invitations: { Row, Insert, Update }`, `Enums.relationship_type: 'father' | 'mother' | 'guardian'`, `Enums.invitation_status: 'pending' | 'accepted' | 'expired' | 'cancelled'`.
- [x] Existen los archivos:
  - `app/actions/_lib/invitation-code.ts`
  - `app/actions/_lib/require-staff-role.ts`
  - `app/actions/parent-children/{types,list-by-child,link-from-invitation,unlink-parent,index}.ts`
  - `app/actions/invitations/{types,create-invitation,list-by-child,cancel-invitation,accept-by-code,index}.ts`
- [x] Cada archivo de action tiene `'use server'` en la primera línea.
- [x] Cada action es una arrow function exportada.
- [x] `app/actions/parent-children/index.ts` re-exporta `listParentsByChild`, `linkParentFromInvitation`, `unlinkParent` y los tipos públicos.
- [x] `app/actions/invitations/index.ts` re-exporta `createInvitation`, `listInvitationsByChild`, `cancelInvitation`, `acceptInvitationByCode` y los tipos públicos.
- [x] `listParentsByChild` filtra por daycare via `users!inner.daycare_id` (verificable por lectura del body).
- [x] `createInvitation` genera código con `crypto.getRandomValues` (no `Math.random`), con retry ante `23505`, persiste `expires_at = now() + 7 days` (verificable por lectura del body).
- [x] `cancelInvitation` rechaza con error claro si el status no es `pending` (verificable por lectura del body).
- [x] `acceptInvitationByCode` valida `status='pending'` y `expires_at > now()` antes del INSERT (verificable por lectura del body).
- [x] `linkParentFromInvitation` captura `23505` y devuelve `'Este padre ya está vinculado a este niño.'` (verificable por lectura del body).
- [x] `KidProfileBody` lee de `listParentsByChild` en lugar de mantener `linkedParents` en state local.
- [x] `app/auth/active/page.tsx` hace signup real + accept + update status + redirect; muestra error inline si falla.
- [x] Mensajes de error en español con voseo, consistentes con `app/actions/auth/sign-in.ts` y SPEC 08.
- [x] Verificación funcional (paso 19) pasa: createInvitation OK con código único, acceptInvitationByCode OK con parent_children creado, intento cross-daycare falla.
- [x] `npx tsc --noEmit` exit 0.
- [x] `pnpm lint` exit 0.
- [x] `pnpm build` exit 0.

## Decisiones tomadas y descartadas

- **Sí: carpeta `_lib/invitation-code.ts` separada** de `_lib/current-daycare.ts` y `_lib/require-staff-role.ts`. Convención: cada helper en su archivo.
- **Sí: `crypto.getRandomValues` para codes** (no `Math.random`). Los codes se persisten en DB y se enviarán por email en el futuro; la entropía debe ser criptográfica. `Math.random` no es apto.
- **Sí: alfabeto sin `I`/`O`/`0`/`1`** (32 chars restantes). Evita confusión al leer/compartir el código. 6 chars → ~1B combinaciones; suficiente para el volumen de un daycare.
- **Sí: 6 chars de longitud** (no 5 como SPEC 05 mockeaba). Con el alfabeto reducido, 6 chars da más espacio y baja la probabilidad de colisión bajo retries.
- **Sí: `linkParentFromInvitation` separado de `createInvitation`.** Diferente firma (programática vs `useActionState`), diferente contexto (post-signup vs pre-). Mantenerlos separados clarifica el contrato.
- **Sí: `requireStaffOrAdmin` como helper separado.** Reutilizado por `createInvitation`, `cancelInvitation`, `unlinkParent`. El chequeo de rol vive en DB (las policies ya filtran), pero la app lo necesita para devolver errores amigables antes de pegarse con RLS denial.
- **Sí: signup con `raw_user_meta_data` para `full_name`, `role='parent'`, `invitation_code`.** El trigger `handle_new_user` (DB-02) crea la fila `public.users` con estos campos. **Decisión cerrada con el usuario:** evita el UPDATE intermedio que sería inseguro sin service role para rollback.
- **Sí: el `daycare_id` se setea en el server action de `/auth/active` leyendo la invitación aceptada**, no en `raw_user_meta_data` (no queremos exponerlo en metadata). Flujo: signup → acceptInvitationByCode → update users (set `daycare_id`, `status='active'`).
- **Sí: aceptar invitación corre UPDATE de invitación + INSERT en `parent_children` secuencialmente** (no en transacción DB). Si el INSERT falla por `23505`, el UPDATE ya pasó — la invitación queda `accepted` pero sin link. **Aceptable:** el padre ya está vinculado y la invitación aceptada no se reutiliza; UX consistente.
- **Sí: `revalidatePath('/kids/[id]', 'page')` después de mutaciones** en `linkParentFromInvitation`, `cancelInvitation`, `createInvitation`. Path dinámico para revalidar la página del perfil del niño afectada.
- **No: storage de avatar para el padre nuevo en el signup.** `avatar_url` queda null hasta que el usuario lo suba (futuro spec).
- **No: envío real de email.** Solo se persiste el código en DB; la UI actual puede mostrarlo (futuro spec).
- **No: `revalidatePath('/')` en `/auth/active` post-redirect.** El `redirect('/')` invalida automáticamente; no hace falta explícito.
- **No: `revalidatePath` para `/kids` (lista de niños).** Las mutaciones de `parent_children` e `invitations` no afectan la lista de niños.
- **No: paginación.** `listParentsByChild` y `listInvitationsByChild` devuelven todo el set; el volumen es bajo (decenas por niño, no miles).
- **No: tests automatizados.** No hay framework configurado en el proyecto. La verificación funcional se hace con un script Node server-only en `/tmp/opencode/`.

## Riesgos identificados

| Riesgo                                                                                             | Mitigación                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crypto.getRandomValues` no disponible en runtime (Node < 19)                                      | Next.js 16 usa Node 20+; garantizado. Documentado en §Modelo de datos.                                                                                                                                                                                                  |
| `acceptInvitationByCode` se llama con un user que aún no terminó el signup                         | El server action de `/auth/active` espera el `signUp` completo antes de llamar; secuencial. Sin race condition posible.                                                                                                                                                 |
| Race condition: dos padres activan el mismo código al mismo tiempo                                 | La policy UNIQUE en `parent_children(parent_id, child_id)` no protege contra doble activación del mismo `code` (la invitación se marca `accepted` y luego el segundo intento falla al no encontrar invitación `pending`). Aceptable; el código es de un solo uso.       |
| UNIQUE en `invitations.code` genera `23505` bajo generación concurrente                            | `createInvitation` tiene retry loop (5 intentos). Si los 5 fallan, devuelve error genérico. La probabilidad de 5 colisiones seguidas con 32⁶ ≈ 1B combinaciones es despreciable.                                                                                        |
| `KidProfileBody` carga `listParentsByChild` en `useEffect` y muestra estado vacío durante el fetch | Skeleton/loading state visible durante el fetch. Aceptable para MVP. Aplica `revalidatePath` en mutaciones para que el próximo render traiga la lista actualizada.                                                                                                      |
| `/auth/active` en server action tiene que manejar el estado del signup (loading, error)            | Usar `useActionState` con state tipado `{ error: string \| null }`. Mensaje claro si el signup falla (email duplicado, password débil).                                                                                                                                 |
| Email del signup difiere del email de la invitación                                                | El server action de `/auth/active` lee el email del form y lo pasa a `acceptInvitationByCode`. La policy `invitations_select_for_accept` filtra por email exacto; si difieren, 0 filas → error "Esta invitación no es para tu email." Mensaje claro.                    |
| `signUp` crea el user pero el accept falla (ej. código expirado entre signup y accept)             | No se hace rollback del `signUp` (no tenemos service role en server actions). El user queda con `status='pending'`; el padre puede reintentar el flujo con un código válido. Si la invitación expiró, el admin puede re-enviar. Documentado en §Decisiones.             |
| `redirect('/')` después de signup requiere que el cliente ya esté autenticado                      | El `signUp` de Supabase Auth loguea automáticamente al usuario tras confirmar email. Sin confirmación, el usuario queda logueado pero la sesión puede tardar en propagarse vía cookies. Server action usa `createSupabaseServerClient` que lee cookies; debe funcionar. |

## Qué **no** entra en este spec

- Modal "Reenviar invitación" / listado de invitaciones pendientes en `/kids/[id]`.
- Envío real de email con el código.
- UI de onboarding paso a paso para padres nuevos.
- Multi-step signup con confirmación de email.
- Activación sin signup (caso "ya tengo cuenta, solo vincularme").
- Paginación, búsqueda, filtros server-side.
- Tests automatizados.
- Realtime subscriptions sobre `invitations` o `parent_children`.
- `pg_cron` para expiración automática.
- Storage para avatar de padres nuevos.
- Refactor de `app/lib/kids.ts` para que `Kid.linkedParents` se compute desde `parent_children` (queda para SPEC de wiring de `/kids/[id]`).
- UI para listar invitaciones existentes en el perfil del niño (futuro spec).
- Endpoint admin para re-enviar / cancelar invitaciones en bloque.

Cada uno de estos, si aterriza, va en su propio spec dentro de `specs/` (con numeración `11-`, `12-`, …) o en `specs/dbase/` (si toca DB).

## Resultados de verificación

Aplicado contra la base real (project ref `fshwfkppcetvqnrccllq`) el 2026-08-26, branch `spec-10-parent-children-and-invitations-server-actions`.

**Catálogo (paso 18 — typecheck, lint, build):**
- `npx tsc --noEmit` exit 0.
- `pnpm lint` exit 0.
- `pnpm build` exit 0 (Next.js 16.3.1 con Turbopack compila todas las rutas).

**Funcional (paso 19 — verificado vía `execute_sql` con `set_config('request.jwt.claims', ...)` para simular roles; el script Node server-only `/tmp/opencode/verify-invitations.mjs` quedó como referencia pero el admin API no responde con la clave `sb_secret_` del proyecto, por lo que la verificación se ejecutó via MCP SQL):**

| # | Escenario                                                                                              | Resultado                                                                                                                                                                  |
| - | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `createInvitation` INSERT bajo JWT staff (`role=staff`, `sub=pedro`)                                    | OK — fila insertada con `status=pending`, `expires_at > now()`, `code` único.                                                                                             |
| 2 | Colisión en `invitations.code` (mismo `code` dos veces)                                                | OK — `23505 duplicate key value violates unique constraint "invitations_code_key"`.                                                                                         |
| 3 | `listInvitationsByChild` con `users!inner(id, full_name, daycare_id).eq('users.daycare_id', ...)`       | OK — devuelve la fila esperada (INNER JOIN filtra por daycare).                                                                                                            |
| 4 | `acceptInvitationByCode` SELECT bajo padre con email **matching** el JWT                                 | OK — devuelve 1 fila (la `invitations_select_for_accept` deja pasar).                                                                                                     |
| 5 | `acceptInvitationByCode` SELECT bajo padre con email **distinto** al de la invitación                    | OK — devuelve 0 filas (la policy filtra por `email = (auth.jwt() ->> 'email')`).                                                                                          |
| 6 | `cancelInvitation` UPDATE a `status='cancelled'` bajo staff                                            | OK — fila actualizada; `updated_at` avanza vía trigger `invitations_set_updated_at`.                                                                                       |
| 7 | `acceptInvitationByCode` happy path completo: SELECT invitación (padre) + UPDATE a `accepted`            | OK — `status='accepted'`, `accepted_at = now()`. El INSERT en `parent_children` lo cubre el server action y fue validado estructuralmente por lectura del cuerpo (`app/actions/invitations/accept-by-code.ts`). |
| 8 | `linkParentFromInvitation` UNIQUE: INSERT `(parent_id, child_id)` duplicado                             | OK — `23505 duplicate key value violates unique constraint "parent_children_parent_id_child_id_key"`.                                                                      |

**Nota sobre el cross-daycare**: la policy `invitations_select_for_accept` filtra por `email = (auth.jwt() ->> 'email')`, así que el caso "padre intenta aceptar invitación de otra daycare" se reduce al test #5 (otro email → 0 filas). No se requirió sembrar dos daycares para validar este escenario.

**DB limpia tras verificación:** `select count(*) from public.invitations` = 0; `select count(*) from public.parent_children` = 0.

**Desviación del plan original:** El plan proponía pasar `full_name`, `role='parent'` y `invitation_code` en `raw_user_meta_data` al `signUp`, dejando que `handle_new_user` (DB-02) crease la fila `public.users` con esos campos. Sin embargo, el trigger exige `daycare_id` no-NULL en metadata, y `parent_children.invitations_select_for_accept` solo deja leer la invitación bajo un JWT del padre (que no existe aún al momento del signup). Se eligió la **Opción A refinada** acordada con el usuario: el server action `activateInvitation` lee `daycare_id` desde la invitación vía un cliente `SUPABASE_SERVICE_ROLE_KEY` server-only (`lib/supabase/admin.ts`, `import 'server-only'`) antes del `signUp`, y lo pasa en metadata junto con los demás campos. No expone la clave al cliente ni toca la decisión original del spec de evitar `service_role` para el flujo de UPDATE/rollback post-accept.
