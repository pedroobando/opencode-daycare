# SPEC 12 — Padres Vinculados: invitaciones pendientes en perfil + conteo real en `/kids`

> **Estado:** aprobado
> **Depende de:** DB-05 (`parent_children` + `invitations` + RLS), SPEC 10 (`listParentsByChild`, `listInvitationsByChild`, `createInvitation`), SPEC 11 (`createInvitation` con Resend)
> **Fecha:** 2026-08-27
> **Objetivo:** Mostrar las invitaciones pendientes con badge `PENDIENTE` dentro de la sección Padres Vinculados de `/kids/[id]` y reflejar el conteo real (activos + pendientes) en la card del listado `/kids`.

## Por qué este spec existe

Tras SPEC 10, la sección "Padres Vinculados" de `/kids/[id]` ya consulta `parent_children` en DB y muestra correctamente a los padres aceptados. Pero la sección ignora las invitaciones pendientes — viven en `public.invitations` con `status='pending'` y el staff no tiene forma visual de ver "a quién le escribí y todavía no aceptó". Además, `app/lib/kid-mapper.ts:47` hardcodea `linkedParents: []`, por lo que la card de `/kids` siempre dice "sin padres vinculados" aunque el niño tenga padres o invitaciones pendientes en DB. Ambos huecos hacen que la UI no refleje la realidad de la base.

El usuario quiere que la UI "se actualice desde los datos existentes en la base y no desde mocks". El cambio en el perfil es puramente cosmético (sumar filas a la lista con badge `PENDIENTE`); el cambio en `/kids` corrige un bug de conteo. Ambos comparten el mismo trabajo de fetching: traer `parent_children` + `invitations (status='pending')` por niño.

Decisiones cerradas con el usuario durante la fase de preguntas:

- Las invitaciones pendientes se renderizan en la **misma** sección Padres Vinculados de `/kids/[id]` (no en una sección aparte), con la paleta `pending` que ya existe en `ParentsList.tsx:21-25` (`bg-[#F7E7A6]` + `text-[#9A7B1E]`).
- El conteo en la card de `/kids` suma activos + pendientes (no solo activos). Cuando `total > 0` se oculta el badge rosa `VINCULAR`; cuando `total === 0` se mantiene la lógica actual ("sin padres vinculados" + badge).

## Alcance

**Incluye:**

- **Helper compartido `app/lib/parent-view-model.ts`** (puro, arrow functions, sin `'use server'`):
  - `ROLE_LABEL: Record<RelationshipType, string>` exportado (`father` → `Papá`, `mother` → `Mamá`, `guardian` → `Tutor/a`).
  - `parentChildToViewModel(link: ParentChildWithUser, existing: ParentViewModel[]): ParentViewModel | null` — extraído del cuerpo de `KidProfileBody.tsx:43-60`. Devuelve `null` si el `users.full_name` está vacío.
  - `pendingInvitationToViewModel(inv: InvitationWithInviter, existing: ParentViewModel[]): ParentViewModel` — equivalente para invitaciones pendientes. Usa `inv.full_name` (lo tipeó el staff) y `inv.relationship`. Devuelve siempre (no null) porque `invitations.full_name` es NOT NULL.
  - `mergeParentRows(link, inv, existing): ParentViewModel[]` — combina `listParentsByChild` + `listInvitationsByChild` en una sola lista, orden alfabético por `name`.
- **Server action `app/actions/parent-children/list-with-pending-by-child.ts`** (`'use server'`, arrow function): `listParentsWithPendingByChild(childId: string): Promise<ParentViewModel[]>`. Llama en paralelo `listParentsByChild(childId)` + `listInvitationsByChild(childId, { status: 'pending' })`, mapea con los helpers, ordena por nombre. NO reemplaza `listParentsByChild` (lo siguen usando otras pantallas si las hay).
- **Modificar `app/components/kids/KidProfileBody.tsx`:**
  - Reemplazar la doble pasada (`listParentsByChild` + mapeo inline en `KidProfileBody`) por una sola llamada a `listParentsWithPendingByChild(kid.id)`.
  - Quitar la función inline `parentChildToViewModel` local y el `ROLE_LABEL` local — importar del nuevo helper.
  - Mantener el `useEffect` + `refreshParents` (decisión arquitectónica de SPEC 10 §Plan paso 16).
  - `LinkedParentModal` (submit) sigue llamando `createInvitation`; tras éxito, `refreshParents` repinta con la nueva fila `pending`.
- **Modificar `app/actions/children/list-children.ts`:**
  - Extender el `select` para incluir `parent_children (count)` y `invitations:invitations!child_id (count)` filtrado por `status='pending'`. PostgREST soporta `count` por relación con `head:false` + `count:'exact'` agregado, pero la forma portable es hacer **dos queries extra** en el mismo action: `parentCounts` (GROUP BY child_id) + `invitationCounts` (GROUP BY child_id, status='pending'), y mergear por `child_id` en JS. Mantener la query principal intacta para no romper el orden ni los filtros de `listChildren` ya usados.
  - Extender el tipo `ChildWithRoom` con `parentCount: number` y `pendingInvitationCount: number`.
  - Si la query de counts falla, devolver `parentCount: 0` + `pendingInvitationCount: 0` (no romper el listado).
- **Modificar `app/lib/kid-mapper.ts`:**
  - `childToKidWithoutColor` propaga `parentCount` y `pendingInvitationCount` desde `ChildWithRoom`.
  - **Eliminar el campo `linkedParents: Parent[]`** del view model `Kid` — ya nadie lo lee en producción (`KidCard` consume los counts). Esto evita futuros bugs donde se asuma que `linkedParents` está populado.
  - Actualizar `KidWithUnsetColor` y `Kid` (en `app/lib/kids.ts`) para reflejar la nueva forma sin `linkedParents`.
- **Modificar `app/components/kids/KidCard.tsx`:**
  - Reemplazar `const parentCount = kid.linkedParents.length` por `const parentCount = kid.parentCount + kid.pendingInvitationCount` (con la nueva forma del view model).
  - Lógica de label:
    - `total === 0` → `"sin padres vinculados"` + badge `VINCULAR` (sin cambios).
    - `total > 0 && pendingCount === 0` → `"{active} {padre/padres} vinculado(s)"` + chevron.
    - `total > 0 && activeCount === 0` → `"{pending} invitación(es) pendiente(s)"` + chevron + badge amarillo pequeño `PENDIENTE` (estilo igual al de `ParentsList.tsx:48-52`).
    - `total > 0 && activeCount > 0 && pendingCount > 0` → `"{active} vinculado(s) · {pending} pendiente(s)"` + chevron + badge amarillo pequeño.
  - Badge `VINCULAR` solo aparece cuando `total === 0` (mantiene la decisión del usuario).
- **Regenerar `database.types.ts`** si fuera necesario (no debería; las tablas no cambian). Verificar con `mcp__supabase__list_tables` que no haya drift.
- **Verificación funcional end-to-end** con `pnpm dev`:
  1. Login `pedro@gmail.com` (staff). `/kids/af33a1b3-b78a-4672-bb96-b6e7e899864d` (Juana) muestra "Lucioano Fernandez · Papá · activa" + badge `ACTIVA` verde (estado actual, no rompe).
  2. Crear invitación pendiente: Vincular Padre → "Maria Lopez" / `maria.test+12@gmail.com` / `Mamá` → submit. Modal cierra. La sección Padres Vinculados ahora muestra 2 filas: Juana (activa) + Maria Lopez (pendiente, badge amarillo).
  3. Volver a `/kids` → la card de Juana muestra "1 vinculado · 1 pendiente" + badge amarillo (sin badge `VINCULAR`).
  4. Cancelar la invitación desde DB (no hay UI de cancelación aún): `update public.invitations set status='cancelled' where email='maria.test+12@gmail.com';`. Recargar `/kids/af33a1b3-...` → vuelve a 1 fila activa. Recargar `/kids` → card muestra "1 padre vinculado" sin pendientes.
  5. Negativo: niño sin padres ni invitaciones (Jose) → card muestra "sin padres vinculados" + badge `VINCULAR` (regresión cero).
- **Verificación técnica:** `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.

**Fuera de alcance (siguientes specs):**

- UI para cancelar invitaciones pendientes desde la sección Padres Vinculados (botón × por fila pendiente).
- UI para re-enviar invitación si expiró (SPEC 11 lo dejó pendiente).
- Realtime: la sección hoy se repinta al montar + al `refreshParents` post-mutación. Suscripción Realtime sobre `invitations` queda fuera.
- Paginación / filtros en el listado de invitaciones pendientes.
- Orden distinto al alfabético (e.g. activos primero, pendientes después).
- Mostrar el email o el código de la invitación pendiente en la fila (privacidad; solo `full_name` + `role`).
- Acción de "Re-vincular" si un padre existente (en `parent_children`) tiene además una invitación pendiente duplicada.
- Refactor de `KidCard` para extraer un `<ParentCountLabel>` reusable (queda para spec de pulido visual).
- Tests automatizados (no hay framework configurado).

## Modelo de datos

Este spec no introduce tablas. Reutiliza `public.parent_children` (DB-05) y `public.invitations` (DB-05, extendida con `sent_at`/`last_send_error` en DB-06).

Tipos TypeScript a introducir / modificar:

```ts
// app/lib/parent-view-model.ts (nuevo, módulo puro)
import type { ParentChildWithUser } from '@/app/actions/parent-children';
import type { InvitationWithInviter } from '@/app/actions/invitations';
import type { RelationshipType } from '@/app/actions/parent-children';
import { pickNextColor } from '@/app/utils/avatar-colors';

export type ParentViewModel = {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'pending';
  initial: string;
  color: string;
};

export const ROLE_LABEL: Record<RelationshipType, string> = {
  father: 'Papá',
  mother: 'Mamá',
  guardian: 'Tutor/a',
};

export const parentChildToViewModel = (
  link: ParentChildWithUser,
  existing: ParentViewModel[],
): ParentViewModel | null => {
  const fullName = link.users?.full_name ?? '';
  if (fullName === '') {
    return null;
  }
  return {
    id: link.id,
    name: fullName,
    role: ROLE_LABEL[link.relationship],
    status: 'active',
    initial: fullName.charAt(0).toUpperCase(),
    color: pickNextColor(existing, (p) => p.color),
  };
};

export const pendingInvitationToViewModel = (
  inv: InvitationWithInviter,
  existing: ParentViewModel[],
): ParentViewModel => {
  const fullName = inv.full_name;
  return {
    id: `inv:${inv.id}`,
    name: fullName,
    role: ROLE_LABEL[inv.relationship],
    status: 'pending',
    initial: fullName.charAt(0).toUpperCase(),
    color: pickNextColor(existing, (p) => p.color),
  };
};

export const mergeParentRows = (
  links: ParentChildWithUser[],
  invitations: InvitationWithInviter[],
): ParentViewModel[] => {
  const result: ParentViewModel[] = [];
  for (const link of links) {
    const mapped = parentChildToViewModel(link, result);
    if (mapped !== null) {
      result.push(mapped);
    }
  }
  for (const inv of invitations) {
    if (inv.status === 'pending') {
      result.push(pendingInvitationToViewModel(inv, result));
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
};
```

```ts
// app/actions/children/types.ts (modificado)
export type ChildWithRoom = ChildRow & {
  rooms: { id: string; name: string; daycare_id: string } | null;
  parentCount: number;
  pendingInvitationCount: number;
};
```

```ts
// app/lib/kids.ts (modificado — se quita linkedParents)
export interface Kid {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  birthDate: string;
  roomId: string;
  roomName: string;
  enrollmentDate: string;
  initial: string;
  color: string;
  allergies?: string;
  parentCount: number;
  pendingInvitationCount: number;
}
```

```ts
// app/lib/kid-mapper.ts (modificado — se quita linkedParents: [] y se propagan los counts)
export const childToKidWithoutColor = (
  child: ChildWithRoom,
): KidWithUnsetColor => {
  const { firstName, lastName } = splitFullName(child.full_name);
  const roomName = child.rooms?.name ?? '';
  return {
    id: child.id,
    firstName,
    lastName,
    age: computeAge(child.birth_date),
    birthDate: child.birth_date,
    roomId: child.room_id,
    roomName,
    enrollmentDate: child.enrolled_at,
    initial: firstName.charAt(0).toUpperCase(),
    allergies:
      child.allergy_tags.length > 0 ? child.allergy_tags.join(', ') : undefined,
    parentCount: child.parentCount,
    pendingInvitationCount: child.pendingInvitationCount,
  };
};
```

## Plan de implementación

1. Cargar skills `context7-mcp` (API actual de `@supabase/supabase-js` para `count` agregado en joins) y `supabase` (regenerar types si hace falta).
2. **Verificar `database.types.ts`** con `mcp__supabase__list_tables` para `parent_children` y `invitations`. Si están al día, saltar. Si hay drift, regenerar con `mcp__supabase__generate_typescript_types`.
3. **Crear `app/lib/parent-view-model.ts`** con `ParentViewModel`, `ROLE_LABEL`, `parentChildToViewModel`, `pendingInvitationToViewModel`, `mergeParentRows` (todos arrow functions, sin `'use server'`).
4. **Crear `app/actions/parent-children/list-with-pending-by-child.ts`** (`'use server'`, arrow function):
   - `export const listParentsWithPendingByChild = async (childId: string): Promise<ParentViewModel[]> => { ... }`.
   - `const [links, invitations] = await Promise.all([listParentsByChild(childId), listInvitationsByChild(childId, { status: 'pending' })]);`
   - `return mergeParentRows(links, invitations);`
   - Si `listParentsByChild` o `listInvitationsByChild` devuelven `[]` por error, la lista combinada queda `[]` (sin propagar excepción).
5. **Modificar `app/actions/parent-children/index.ts`** para exportar `listParentsWithPendingByChild`. Añadir el tipo `ParentViewModel` al barrel de tipos (re-export desde `@/app/lib/parent-view-model`).
6. **Modificar `app/components/kids/KidProfileBody.tsx`:**
   - Borrar la función inline `parentChildToViewModel` (líneas 43-60) y la constante `ROLE_LABEL` (líneas 37-41).
   - Cambiar el import: `import { listParentsByChild } from '@/app/actions/parent-children';` → `import { listParentsWithPendingByChild } from '@/app/actions/parent-children';`.
   - Cambiar el import del tipo: `import type { ParentChildWithUser } from '@/app/actions/parent-children';` → `import type { ParentViewModel } from '@/app/lib/parent-view-model';` (y borrar el `Parent` import si ya no se usa directo — la lógica del componente ya no instancia `Parent[]`).
   - `useState<Parent[]>([])` → `useState<ParentViewModel[]>([])` (mismo cambio en el helper `refreshParents`).
   - `refreshParents`: `const rows = await listParentsWithPendingByChild(kid.id); setParents(rows);` — una línea.
   - `parentChildToViewModel` ya no se llama localmente; se llama dentro del server action via el helper.
   - El `eslint-disable react-hooks/set-state-in-effect` sigue siendo necesario (decisión arquitectónica de SPEC 10); documentar el por qué en el comentario de bloque.
7. **Modificar `app/actions/children/list-children.ts`:**
   - Después de la query principal (`let query = supabase.from('children').select(...)...`), ejecutar dos queries en paralelo:
     ```ts
     const [childrenRes, parentCountsRes, invitationCountsRes] = await Promise.all([
       query, // ya construida arriba
       supabase
         .from('parent_children')
         .select('child_id', { count: 'exact', head: false })
         .in('child_id', /* ids aún no conocidos */), // problema: necesito los ids primero
       ...
     ]);
     ```
   - **Alternativa más simple y portable:** ejecutar la query principal primero, tomar los `ids`, y después correr las dos queries de count filtradas por `in('child_id', ids)`. Total: 3 queries (1 children + 2 counts). Esto evita depender del `count` agregado en joins, que es menos estable en PostgREST.
   - Mapear `parentCounts` a `Record<childId, number>` e `invitationCounts` a `Record<childId, number>` (con `status='pending'`).
   - Enriquecer cada `ChildRow` con `parentCount` y `pendingInvitationCount`. Si la query de count falla, default `0`/`0` y `console.warn` (no romper el listado).
8. **Modificar `app/actions/children/types.ts`:** agregar `parentCount: number; pendingInvitationCount: number;` a `ChildWithRoom`.
9. **Modificar `app/lib/kid-mapper.ts`:** borrar `linkedParents: []` de `childToKidWithoutColor`, agregar `parentCount` + `pendingInvitationCount` propagando de `child`.
10. **Modificar `app/lib/kids.ts`:** borrar `linkedParents: Parent[]` del interface `Kid`. Agregar `parentCount: number` + `pendingInvitationCount: number`. Borrar el import `Parent` si queda sin uso (verificar que `ParentsList.tsx`, `KidProfileBody.tsx`, etc. ya no dependen del tipo `Parent` desde `kids.ts`; si dependen, mantener el export).
11. **Migrar `ParentsList.tsx` a `ParentViewModel`:** cambiar `import type { Parent } from '@/app/lib/kids';` → `import type { ParentViewModel } from '@/app/lib/parent-view-model';`. Cambiar `parents: Parent[]` → `parents: ParentViewModel[]`. No tocar el render: ya soporta `status='active'` y `status='pending'` (statusConfig ya cubre ambos).
12. **Migrar `KidCard.tsx`:**
    - Borrar `const parentCount = kid.linkedParents.length;`.
    - Reemplazar con:
      ```ts
      const activeCount = kid.parentCount;
      const pendingCount = kid.pendingInvitationCount;
      const totalCount = activeCount + pendingCount;
      ```
    - Reescribir `parentLabel` con la lógica de 4 casos documentada en §Alcance.
    - Agregar un `<span>` opcional con el badge `PENDIENTE` amarillo cuando `pendingCount > 0` (mismo estilo que `ParentsList.tsx:48-52`: `bg-[#F7E7A6] text-[#9A7B1E]`, `text-[10.5px] font-extrabold`, padding consistente).
    - `showLinkBadge = totalCount === 0` (mantiene la regla del usuario).
13. **Verificación técnica:** `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.
14. **Verificación funcional** con `pnpm dev` (5 pasos detallados en §Alcance):
    - Juana (`af33a1b3-b78a-4672-bb96-b6e7e899864d`) ya tiene `Lucioano Fernandez` activo → render OK.
    - Crear invitación pendiente para Juana → render 2 filas (activa + pendiente).
    - Cancelar invitación en DB → render 1 fila activa.
    - Card de Juana en `/kids` cuenta real.
    - Card de Jose (0/0) → "sin padres vinculados" + badge `VINCULAR` (regresión cero).
15. **Cleanup:** borrar la invitación de prueba de `public.invitations` y, si se creó, el `auth.users` de `maria.test+12@gmail.com`.

## Criterios de aceptación

- [ ] Existe `specs/12-padres-vinculados-pending-and-real-count.md` en estado `Borrador` que avanza a `Aprobado` / `Implementado` después de revisión.
- [ ] Existe `app/lib/parent-view-model.ts` con `ParentViewModel`, `ROLE_LABEL`, `parentChildToViewModel`, `pendingInvitationToViewModel`, `mergeParentRows`. Todas arrow functions. Sin `'use server'`.
- [ ] Existe `app/actions/parent-children/list-with-pending-by-child.ts` con `listParentsWithPendingByChild(childId)` exportada y `'use server'` en la primera línea. La función hace `Promise.all([listParentsByChild, listInvitationsByChild(_, { status: 'pending' })])` y devuelve `mergeParentRows(...)`.
- [ ] `app/actions/parent-children/index.ts` re-exporta `listParentsWithPendingByChild` y `ParentViewModel`.
- [ ] `KidProfileBody.tsx` ya no define `parentChildToViewModel` ni `ROLE_LABEL` localmente; los importa desde `@/app/lib/parent-view-model`. La carga de padres se hace vía `listParentsWithPendingByChild(kid.id)` en una sola línea.
- [ ] `ParentsList.tsx` renderiza correctamente una fila con `status='pending'` (badge amarillo `PENDIENTE`, descripción "invitación enviada") cuando hay invitaciones pendientes para el niño.
- [ ] `app/actions/children/list-children.ts` enriquece cada `ChildWithRoom` con `parentCount` + `pendingInvitationCount`. Las queries de count no rompen el listado si fallan (default 0/0 + `console.warn`).
- [ ] `app/actions/children/types.ts` declara `ChildWithRoom` con `parentCount: number` + `pendingInvitationCount: number`.
- [ ] `app/lib/kid-mapper.ts` no contiene `linkedParents: []`. Propaga `parentCount` y `pendingInvitationCount` desde `ChildWithRoom`.
- [ ] `app/lib/kids.ts` no contiene `linkedParents: Parent[]` en el interface `Kid`. Contiene `parentCount: number` + `pendingInvitationCount: number`.
- [ ] `KidCard.tsx` muestra el label correcto en los 4 casos: `0/0`, `X/0`, `0/Y`, `X/Y`. El badge `VINCULAR` solo aparece cuando `total === 0`. Cuando `pendingCount > 0`, se muestra un badge amarillo `PENDIENTE` (estilo consistente con `ParentsList.tsx`).
- [ ] `ParentsList.tsx` y `KidProfileBody.tsx` ya no importan `Parent` desde `@/app/lib/kids` (usan `ParentViewModel`).
- [ ] Verificación funcional paso 14 pasa las 5 sub-verificaciones (Juana render OK, crear pendiente render OK, cancelar OK, card con cuenta real OK, Jose con `0/0` OK).
- [ ] Mensajes en español con voseo donde aplique (no hay nuevos mensajes; solo labels).
- [ ] `npx tsc --noEmit` exit 0.
- [ ] `pnpm lint` exit 0.
- [ ] `pnpm build` exit 0.
- [ ] `mcp__supabase__get_advisors` sin nuevos `ERROR` después de los cambios (los cambios no tocan DB pero la query de count agrega un `IN (...)` que los advisors pueden revisar).

## Decisiones tomadas y descartadas

- **Sí: helper compartido `app/lib/parent-view-model.ts`** (no inline en el componente). SPEC 10 lo dejó inline en `KidProfileBody.tsx` por ser un único consumidor. Ahora con dos consumidores (perfil + listado) y dos fuentes (parent_children + invitations), extraer evita drift entre mappers.
- **Sí: nueva server action `listParentsWithPendingByChild`** que combina `listParentsByChild` + `listInvitationsByChild`. NO se modifica `listParentsByChild` porque la firma estable ayuda a futuros specs que necesiten solo los aceptados (e.g. UI de selección de padre para "agregar nota médica dirigida a X padre").
- **Sí: ordenar alfabéticamente por nombre**, mezclando activos + pendientes. Más predecible que "activos primero, pendientes después". Decisión reversible si el staff prefiere otra cosa.
- **Sí: borrar `linkedParents: Parent[]` del view model `Kid`.** Era un vestigio de SPEC 02 (mock) y SPEC 09 (wiring) — siempre quedaba `[]` en runtime. Borrarlo evita el bug de "asumir populado cuando no lo está". `Kid` queda como view model puro de "datos del niño" + "conteos agregados".
- **Sí: 3 queries en `listChildren`** (children + parent counts + invitation counts) en vez de count agregado via join. Más portable entre versiones de PostgREST y más fácil de debuggear con `get_advisors` / `query_logs`. Coste: una query extra round-trip al server por carga de `/kids`. Aceptable para MVP; optimizable en un spec futuro si el volumen crece.
- **Sí: badge amarillo `PENDIENTE` en la card de `/kids`** cuando `pendingCount > 0`, replicando el estilo de `ParentsList.tsx`. Da feedback inmediato sin obligar al staff a abrir el perfil.
- **Sí: prefijar el id de filas pendientes con `inv:`** en el `ParentViewModel` (`inv:${inv.id}`). Evita colisiones si `parent_children.id` y `invitations.id` llegasen a tener el mismo UUID (Postgres los genera en espacios disjuntos hoy, pero el prefijo blinda el `key={parent.id}` de React).
- **No: realtime sobre `invitations` o `parent_children`.** El repintado post-mutación (vía `refreshParents` y `revalidatePath('/kids/[id]')`) ya cubre el caso staff-activo. Realtime es futuro.
- **No: cambiar el orden a "activos primero, pendientes después".** Más simple seguir el orden alfabético. Reversible.
- **No: UI de cancelación desde Padres Vinculados.** SPEC 10 lo dejó para otro spec; este no lo agrega (fuera de alcance).
- **No: refactor de `KidCard` para extraer `<ParentCountLabel>` reusable.** Cambia la API del componente; no aporta a este spec.
- **No: tests automatizados.** No hay framework configurado.
- **No: paginación ni filtros.** Volumen bajo (decenas de niños por daycare).
- **No: usar el email o el código en la fila pendiente** (privacidad + ruido visual). Solo `full_name` + `role` + badge.

## Riesgos identificados

| Riesgo                                                                                                                                  | Mitigación                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query de count falla en runtime (RLS, drift de schema)                                                                                  | `listChildren` devuelve `parentCount: 0, pendingInvitationCount: 0` + `console.warn`. El listado sigue funcionando; solo se pierde el conteo. Aceptable para MVP.                                   |
| Drift entre `parent_children.id` (uuid v4) y `invitations.id` (uuid v4) — colisión                                                      | Prefijo `inv:` en el `ParentViewModel.id` para filas pendientes. `key={parent.id}` nunca colisiona.                                                                                                 |
| `listParentsByChild` y `listInvitationsByChild` requieren ambos `requireCurrentUserDaycareId`                                           | Se llaman en paralelo; si el usuario no tiene daycare asignado, ambos devuelven `[]` y la lista combinada queda `[]` (consistente).                                                                 |
| Staff abre `/kids` antes de que termine la query de counts                                                                              | La query principal (`listChildren`) ya devolvió; los counts se enriquecen antes del return. No hay estado intermedio donde `Kid.parentCount === undefined`. El tipo `ChildWithRoom` exige el campo. |
| Card muestra "X vinculado · Y pendiente" cuando un niño tiene **solo** invitaciones y los nombres tipeados por el staff son incorrectos | El staff puede cancelar y re-enviar desde la sección del perfil (futuro spec de cancelación). Aceptable.                                                                                            |
| Cambio en `Kid` view model rompe consumers no considerados                                                                              | Búsqueda con `grep -rn 'linkedParents' app/` para detectar todos los usos antes de borrar. Documentado en §Plan paso 10.                                                                            |
| `mergeParentRows` ordena con `localeCompare(name, 'es')` — puede dar resultados inesperados con tildes                                  | Test manual: "Ángel" vs "Ana" debe ir A, Á (regla española). Documentado; reversible si molesta.                                                                                                    |
| Las queries de count agregan latencia a `/kids`                                                                                         | 3 queries en paralelo (`Promise.all`), todas con índice en `child_id`. Medible con `query_logs`. Aceptable para MVP; optimizable con vista materializada si crece.                                  |

## Qué **no** entra en este spec

- UI de cancelación de invitaciones desde Padres Vinculados (otro spec).
- Realtime sobre `invitations` / `parent_children`.
- Refactor visual de `KidCard` para extraer subcomponentes.
- Tests automatizados.
- Paginación del listado de niños o del listado de padres por niño.
- Mostrar el email / código de la invitación pendiente en la fila.
- Orden distinto al alfabético.
- Acción de "re-vincular" si hay duplicados entre `parent_children` y `invitations`.
- Vista materializada con los counts por niño (optimización futura).
- Multi-tenant: cada daycare sigue aislado por RLS (DB-05) — sin cambios.

Cada uno, si aterriza, va en su propio spec (`13-…`, `14-…`, …).

## Resultados de verificación

_A completar durante implementación._
