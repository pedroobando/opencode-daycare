# SPEC 09 — Wiring de UI: `/kids` y modal "Agregar niño" contra server actions

> **Estado:** Aprobado
> **Depende de:** SPEC 07 (Supabase server client), SPEC 08 (`app/actions/children/*`, `app/actions/rooms/*`), DB-04 (policies de escritura staff/admin) — ambos Implementado
> **Fecha:** 2026-08-25
> **Objetivo:** Cablear el listado de niños, el combobox de Sala y el alta del modal "Agregar niño" de `/kids` contra los server actions ya implementados, eliminando la dependencia del mock `app/lib/kids.ts` y dejando la pantalla funcional contra la base de datos real.

## Por qué este spec existe

Tras SPEC 04 (modal), `/kids` mostraba 16 niños hardcodeados en `app/lib/kids.ts` y el alta del modal insertaba en estado local — se perdía al recargar. SPEC 08 implementó los server actions tipados (`listRooms`, `listChildren`, `createChild`, `getChildById`) contra las tablas `rooms` y `children` de DB-03, pero explícitamente dejó el wiring de UI fuera de alcance. DB-04 habilita las policies de escritura. Este spec cierra el ciclo: la UI pasa a leer y escribir contra la DB. La lista arranca vacía por decisión del usuario (no se siembra mock); los niños se cargan desde el modal y persisten. El perfil `/kids/[id]` también migra al server action `getChildById` para mantener coherencia.

> **Precondición de runtime:** sin DB-04 aplicado, los writes fallan con `new row violates row-level security policy`. SPEC 09 depende formalmente de DB-04 — se aplica primero.

## Alcance

**Incluye:**

- **`app/actions/children/get-child-by-id.ts`** (nuevo, arrow function, `'use server'`): `getChildById(id: string): Promise<ChildWithRoom | null>`. Misma forma de query que `listChildren` + `.eq('id', id).maybeSingle()`. Devuelve `null` si no existe o pertenece a otro daycare.
- **`app/actions/children/index.ts`**: exportar `getChildById`.
- **`app/lib/kid-mapper.ts`** (nuevo, helpers puros arrow):
  - Tipo exportado `KidWithUnsetColor = Omit<Kid, 'color'>` — tipo intermedio sin color asignado, para que las dos pasadas del mapper compilen sin `any`.
  - `computeAge(birthDateIso: string): number` — diferencia entera en años entre hoy y la fecha (local time).
  - `splitFullName(fullName: string): { firstName: string; lastName: string }` — parte por el primer espacio; si hay una sola palabra, `lastName` queda vacío.
  - `childToKidWithoutColor(child: ChildWithRoom): KidWithUnsetColor` — primera pasada: convierte `ChildWithRoom` al view model `Kid` sin asignar color. Calcula `firstName/lastName`, `age`, `roomName` (de la relación embebida), `enrollmentDate` (de `enrolled_at`), `initial`, `allergies` (join de `allergy_tags`), `linkedParents: []`. No toca color.
  - `assignColorsDeterministic(kids: KidWithUnsetColor[]): Kid[]` — segunda pasada: itera la lista en orden estable (el mismo orden que devolvió `listChildren()`, alfabético por `full_name`) y para cada niño asigna `color: pickNextColor(yaAsignados, k => k.color)`. La primera iteración recibe `[]` → toma el primer color del palette; la siguiente el menos usado entre los ya asignados; etc. Reproduce la lógica del modal original (`buildKid` usaba `pickNextColor(existingKids, k => k.color)` sobre el state local).
- **`app/kids/page.tsx`** (server component): reemplaza el `getCurrentUser` + render directo por: `await listRooms()`, `await listChildren()`, mapeo en dos pasadas a `Kid[]`, pasa todo a `<KidsBody rooms={rooms} kids={kidsView} />`.
- **`app/kids/KidsBody.tsx`**:
  - Recibe `rooms: RoomRow[]` y `kids: Kid[]` como props.
  - Borra `import { rooms, kids } from '@/app/lib/kids';` y el state local `kidsList`. Importa `RoomRow` desde `@/app/actions/rooms` (no usa el view model `Room` que se eliminó).
  - Agrupa por sala con `rooms` (no más `useMemo` sobre `kidsList` mockeado).
  - **Empty state:** si `kids.length === 0`, muestra un bloque centrado "Todavía no hay niños cargados. Usá el botón 'Agregar niño' para empezar." en lugar del grid.
  - El botón "Agregar niño" sigue abriendo el modal con `setIsModalOpen`.
- **`app/components/kids/AddKidModal.tsx`**: se simplifican las props:
  - Elimina `existingKids` y `onAddKid` (el id lo genera Postgres; el alta no es local).
  - Elimina la función `buildKid`, los imports `slugify`, `pickNextColor`, `differenceInYears`, `formatLocalDate`.
  - Conserva el portal, los efectos de scroll/foco/Escape/backdrop.
  - **Pasa a poseer el `useActionState`** (decisión arquitectónica — ver §Decisiones): `const [state, formAction] = useActionState(createChild, { error: null });`.
  - Trackea con `useRef<boolean>(false)` si hubo un submit attempted; se setea a `true` vía callback que `AddKidForm` invoca en su `onSubmit` handler cuando la validación cliente pasa.
  - `useEffect` que observa `state.error === null && submitAttemptedRef.current` → llama `onClose()` y resetea el ref.
  - Pasa a `<AddKidForm>` las props: `rooms: RoomRow[]`, `open`, `onCancel={onClose}`, `formAction`, `state`, `onSubmitAttempted={() => { submitAttemptedRef.current = true; }}`. El form ya no maneja state ni lógica de submit completa — solo validación cliente + UI.
- **`app/components/kids/AddKidForm.tsx`**: se simplifica — ya no maneja `useActionState`, solo UI + validación cliente:
  - `<form action={formAction} onSubmit={validateBefore}>` con `validateBefore` que ejecuta la validación cliente actual (nombre, fecha no futura, sala seleccionada) y llama `event.preventDefault()` si falla. Si pasa, dispara `onSubmitAttempted()` y deja que `formAction` submitee el form.
  - Inputs llevan `name="full_name"`, `"birth_date"` (se envía `dd/mm/aaaa`, el action ya parsea), `"room_id"`, `"medical_notes"`, `"allergy_tags"`.
  - Botón "Guardar" → `type="submit"` con componente interno `<SubmitButton>` que usa `useFormStatus().pending` → disabled + texto "Guardando…".
  - **Side-effect implícito:** al pasar de `onSubmit(payload)` (que omitía `medicalNotes`) a un server action form con `name="medical_notes"` en el `<textarea>`, FormData pasa a incluir las notas médicas. Esto es una mejora funcional que el spec reconoce (las notas hoy no se persisten en la UI actual). Documentado en §Decisiones.
  - `state.error` (server) se muestra inline en un `<p className="...">` rojo bajo el header del modal.
- **`app/kids/[id]/page.tsx`**: reemplaza `getKidById(id)` por `await getChildById(id)`. Si `null` → `notFound()`. Si existe, lo mapea via `childToKidWithoutColor` + `assignColorsDeterministic([mappedKid])[0]` (lista de un elemento; el color se calcula igual que en el listado) y renderiza `<KidProfileBody kid={mappedKid} />`. Mantiene la auth guard (`redirect('/auth')`).
- **`app/actions/children/create-child.ts`** (ajuste menor justificado):
  - Se quita `redirect('/kids')` → en su lugar devuelve `{ error: null }` en éxito. Razón: con `redirect`, el state `isModalOpen` (client) sobrevive a la recarga y el modal queda visible mostrando datos stale.
  - Se agrega `revalidatePath('/kids')` antes del return de éxito.
  - Se elimina la lectura de `photo_consent` del formData y la columna del INSERT → aplica el default `true` de DB. Decisión transitoria hasta un spec futuro que defina la UI de consentimiento (no en scope de SPEC 09).
  - **Nota:** el `<form>` actual de `AddKidForm.tsx` no contiene ningún input `name="photo_consent"` (solo se lee en `createChild` por defensa). La eliminación es solo del lado del server action — no hay JSX que tocar acá.
- **`app/lib/kids.ts`**: se eliminan los arrays `kids`, `rooms`, la función `getKidById` **y el tipo `Room`** (decisión arquitectónica — ver §Decisiones). Se conservan los tipos `Kid`, `Parent`, `ParentStatus` y `getAvatarTextColor` (helper usado por `KidCard`, `KidProfileHeader`). Los componentes importan `RoomRow` desde `@/app/actions/rooms`.
- Verificación: `npx tsc --noEmit`, `pnpm lint`, `pnpm build`. Smoke test con Playwright contra `pnpm dev`: abrir modal → combobox muestra Estrellitas/Lunitas/Soles desde DB → guardar → modal cierra y niño aparece agrupado → abrir perfil → editar URL con UUID inválido → 404 "Niño inexistente".

**Fuera de alcance:**

- Edición de niño desde el perfil (botón Editar sigue inactivo).
- Eliminación / archivado de niños desde UI.
- Subida de foto del niño (Storage).
- UI de `photo_consent` (consentimiento se modela en spec futuro).
- Vinculación de padres (la tabla `parent_children` no existe; SPEC 05 sigue mockeado).
- Seed de niños en DB (la lista arranca vacía por decisión del usuario).
- Paginación / búsqueda server-side.
- Realtime updates en `/kids` cuando alguien crea un niño en otro tab.
- Tests automatizados (no hay framework configurado).
- Sidebar `currentUser`: SPEC 07 ya lo popula; no se toca.
- `/feed` (post modal sigue mockeado en su propio spec).

## Modelo de datos

No se introducen tablas ni columnas. El modelo canónico vive en DB-03 y DB-04; SPEC 09 lo consume tal cual. La vista interna `Kid` (en `app/lib/kids.ts`) pasa de estar poblada por mock a ser un **view model** derivado de `ChildWithRoom` via el mapper. El mapeo se hace en **dos pasadas** para resolver el problema del color (ver §Decisiones y Fix #1 en el review).

Forma del mapper:

```ts
// app/lib/kid-mapper.ts

import type { ChildWithRoom } from '@/app/actions/children';
import type { Kid } from '@/app/lib/kids';
import { pickNextColor } from '@/app/utils/avatar-colors';

export type KidWithUnsetColor = Omit<Kid, 'color'>;

export const computeAge = (birthDateIso: string): number => {
  const [year, month, day] = birthDateIso.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

export const splitFullName = (
  fullName: string,
): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim(),
  };
};

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
    linkedParents: [],
  };
};

export const assignColorsDeterministic = (
  kids: KidWithUnsetColor[],
): Kid[] => {
  const result: Kid[] = [];
  for (const k of kids) {
    result.push({ ...k, color: pickNextColor(result, (kid) => kid.color) });
  }
  return result;
};
```

Uso desde `app/kids/page.tsx`:

```ts
const childrenRaw = await listChildren();
const rooms = await listRooms();
const kids = assignColorsDeterministic(
  childrenRaw.map(childToKidWithoutColor),
);
return <KidsBody rooms={rooms} kids={kids} currentUser={currentUser} />;
```

Notas:

- `Kid.color` en el mock era un color de avatar predefinido (`#A9D9E8`, etc.). En DB no hay columna de color (decisión: no persistir color — se calcula determinísticamente). La estrategia es **two-pass**: `childToKidWithoutColor` no toca color; `assignColorsDeterministic` itera la lista (mismo orden que devolvió `listChildren()`, alfabético por `full_name`) y para cada niño toma el color menos usado entre los ya asignados vía `pickNextColor`. Reproduce la lógica del modal original (`buildKid` usaba `pickNextColor(existingKids, k => k.color)` sobre el state local). **Por qué dos pasadas:** `pickNextColor` exige items con `color` ya asignado para contar distribution; pasarle `ChildWithRoom[]` (sin `color`) con `getColor: c => c.id` (UUID) contaba 0 matches en cada palette color y devolvía siempre el mismo color para todos. Fix documentado en §Riesgos.
- `Kid.birthDate` (`YYYY-MM-DD`) coincide con `ChildRow.birth_date` (Postgres `date` se serializa como `YYYY-MM-DD`).
- `Kid.enrollmentDate` ← `ChildRow.enrolled_at` (mismo formato).
- `Kid.linkedParents` queda `[]` hasta que exista el join con `parent_children` (spec futuro).
- El tipo `Room` se eliminó de `app/lib/kids.ts`. Los componentes importan `RoomRow` directamente desde `@/app/actions/rooms` (decisión arquitectónica — ver §Decisiones).

## Plan de implementación

1. **Cargar la skill `supabase`** antes de tocar el cliente (AGENTS.md).
2. **DB-04 ya aplicado** (precondición; SPEC 09 no funciona sin policies de escritura).
3. **Crear `app/actions/children/get-child-by-id.ts`** (arrow function, `'use server'`):
   - Resuelve `daycareId = await getCurrentUserDaycareId()`; si `null`, devuelve `null`.
   - Query: `supabase.from('children').select('*, rooms!inner(id, name, daycare_id)').eq('rooms.daycare_id', daycareId).eq('id', id).maybeSingle()`.
   - Devuelve `data as ChildWithRoom | null` o `null` si `error`.
4. **Actualizar `app/actions/children/index.ts`**: agregar `export { getChildById } from './get-child-by-id';`.
5. **Crear `app/lib/kid-mapper.ts`** con `KidWithUnsetColor`, `computeAge`, `splitFullName`, `childToKidWithoutColor` y `assignColorsDeterministic` (arrow functions, tipos explícitos en retornos).
6. **Modificar `app/actions/children/create-child.ts`**:
   - Importar `revalidatePath` de `next/navigation`.
   - Quitar `redirect` del import y del happy path.
   - En éxito: `revalidatePath('/kids'); return { error: null };`.
   - Eliminar lectura de `photo_consent` y la columna del INSERT (rely on DB default).
   - Agregar comentario al top explicando el cambio vs SPEC 08 (redirect → revalidatePath + return null; omission de photo_consent transitoria).
   - **Nota:** el `<form>` actual de `AddKidForm.tsx` no contiene ningún input `name="photo_consent"` (solo se lee en `createChild` por defensa). La eliminación es solo del lado del server action — no hay JSX que tocar acá.
7. **Modificar `app/lib/kids.ts`**:
   - Borrar los arrays `kids`, `rooms` (mocks), la función `getKidById` **y el tipo `Room`** (los componentes importan `RoomRow` desde `@/app/actions/rooms`).
   - Mantener `Kid`, `Parent`, `ParentStatus` y `getAvatarTextColor`.
   - Agregar comentario en el top: "Mock data removed in SPEC 09; view-model types only (Kid + Parent hierarchy + avatar helpers)".
8. **Modificar `app/kids/page.tsx`** (server component):
   - Importar `listRooms` de `@/app/actions/rooms`, `listChildren` de `@/app/actions/children`, `assignColorsDeterministic` y `childToKidWithoutColor` de `@/app/lib/kid-mapper`.
   - `const [rooms, childrenRaw] = await Promise.all([listRooms(), listChildren()]);` (rooms y children paralelos).
   - `const kids = assignColorsDeterministic(childrenRaw.map(childToKidWithoutColor));` (dos pasadas, ver §Modelo de datos).
   - `rooms` se pasa tal cual a `<KidsBody>` (ya es `RoomRow[]`, no requiere mapping al view model eliminado).
   - Pasar `currentUser`, `rooms`, `kids` a `<KidsBody />`.
9. **Modificar `app/kids/KidsBody.tsx`**:
   - Cambiar firma: `({ currentUser, rooms, kids }: { currentUser?: SidebarUser | null; rooms: RoomRow[]; kids: Kid[] })`.
   - Borrar `import { rooms, kids } from '@/app/lib/kids';` y `useState<Kid[]>(kids)`. Importar `RoomRow` desde `@/app/actions/rooms` y `Kid` (solo el tipo) desde `@/app/lib/kids`.
   - `const [isModalOpen, setIsModalOpen] = useState(false);` (sin `kidsList`).
   - `filteredKids` se calcula sobre `kids` prop. `kidsByRoom` agrupa con `rooms` prop.
   - Empty state: `if (kids.length === 0) { /* bloque centrado con copy + ilustración opcional */ }`.
   - `<AddKidModal open={isModalOpen} onClose={() => setIsModalOpen(false)} rooms={rooms} triggerRef={triggerButtonRef} />` (sin `existingKids` ni `onAddKid`).
10. **Modificar `app/components/kids/AddKidModal.tsx`**:
    - Borrar imports: `Kid` type; `pickNextColor`, `slugify`.
    - Importar `RoomRow` desde `@/app/actions/rooms` y `useActionState`, `useEffect`, `useRef` desde `'react'`.
    - Borrar funciones internas: `buildKid`, `differenceInYears`, `formatLocalDate`, y la lógica de generación de `Kid`.
    - Cambiar `AddKidModalProps`: `({ open, onClose, rooms, triggerRef })` (sin `existingKids` ni `onAddKid`).
    - **Poseer `useActionState`:** `const [state, formAction] = useActionState(createChild, { error: null });`.
    - `const submitAttemptedRef = useRef(false);` + `useEffect` que observa `state.error === null && submitAttemptedRef.current` → llama `onClose()` y resetea el ref.
    - El `<AddKidForm>` recibe `rooms`, `open`, `onCancel={onClose}`, `formAction`, `state`, `onSubmitAttempted={() => { submitAttemptedRef.current = true; }}`. La prop `onSubmit` desaparece — el form se submitea solo via `formAction` (después de pasar validación cliente).
11. **Modificar `app/components/kids/AddKidForm.tsx`**:
    - Eliminar el `useActionState` y la prop `onSubmit` — ambos viven ahora en `AddKidModal`.
    - El form ya no maneja la lógica completa de submit: solo validación cliente + UI + delegar a `formAction`.
    - Imports nuevos: `useFormStatus` de `'react-dom'` (para el componente `<SubmitButton>`). `createChild` ya no se importa acá.
    - **Props del form:** `({ rooms, open, onCancel, formAction, state, onSubmitAttempted })`.
    - `<form action={formAction} onSubmit={handleValidateBefore}>` — `handleValidateBefore` corre la validación cliente actual (nombre, fecha no futura, sala seleccionada); si falla llama `event.preventDefault()`; si pasa, llama `onSubmitAttempted()` y deja que `formAction` submitee el form (Enter envía naturalmente).
    - Inputs: agregar `name="full_name"`, `"birth_date"` (valor `birthDateInput`, el server parsea `dd/mm/aaaa` directo), `"room_id"` (select con `name`), `"medical_notes"`, `"allergy_tags"`. Conservar `id` y `onChange` actuales para UX cliente.
    - **Side-effect implícito:** al pasar de `onSubmit(payload)` (que omitía `medicalNotes`) a un server action form con `name="medical_notes"` en el `<textarea>`, FormData pasa a incluir las notas médicas. Hoy el modal mockeado no persiste notas; este cambio las hace persistir. Mejora funcional documentada en §Decisiones.
    - Botón Guardar: `type="submit"` + componente interno `<SubmitButton>` que usa `useFormStatus().pending` → disabled + texto "Guardando…".
    - Server error inline: debajo del header, `<p className="text-[12.5px] text-[#D9583C]">{state.error}</p>` si existe.
12. **Modificar `app/kids/[id]/page.tsx`**:
    - Reemplazar `getKidById` por `await getChildById(id)`.
    - Si `null` → `notFound()`.
    - Si existe, `const kid = assignColorsDeterministic([childToKidWithoutColor(child)])[0];` (lista de un elemento; el color se calcula igual que en el listado).
    - Mantener `redirect('/auth')` si no hay user.
13. **Verificación técnica:**
    - `npx tsc --noEmit` exit 0.
    - `pnpm lint` exit 0.
    - `pnpm build` exit 0 (control de regresión).
14. **Verificación funcional con Playwright** (`pnpm dev` en `localhost:3000`):
    - Login como `pedro@gmail.com` (vía SPEC 07), ir a `/kids`.
    - Lista vacía muestra empty state con copy correcto.
    - Click "Agregar niño" → modal abre, combobox "Sala" tiene 3 opciones en orden alfabético: Estrellitas, Lunitas, Soles (orden de `listRooms()` por `name` ascendente).
    - Llenar "Martina Test", `15/05/2021`, "Soles", dejar alergias y notas vacías → click Guardar → modal cierra → niño aparece agrupado bajo "SALA SOLES 1 niño".
    - Click en la tarjeta → navega a `/kids/<uuid>` → perfil carga con avatar, nombre, edad 5 (en 2026, cumpleaños de mayo ya pasó), sala Soles, padres "—".
    - Editar URL a `/kids/00000000-0000-0000-0000-000000000000` → 404 "Niño inexistente".
    - Repetir alta con `15/05/2030` → modal muestra error inline "La fecha no puede ser en el futuro." y NO cierra.
    - Repetir alta con sala vacía → error "Este campo es obligatorio." debajo del select.
    - Screenshots en `.playwright-mcp/spec-09-*.png`.

## Criterios de aceptación

- [ ] Existe `app/actions/children/get-child-by-id.ts` con `getChildById` arrow function + `'use server'`.
- [ ] Existe `app/lib/kid-mapper.ts` con `computeAge`, `splitFullName`, `childToKidWithoutColor`, `assignColorsDeterministic` (arrow functions) y el tipo `KidWithUnsetColor`.
- [ ] `app/actions/children/index.ts` exporta `getChildById`.
- [ ] `app/lib/kids.ts` ya no contiene los arrays `kids`, `rooms`, la función `getKidById` **ni el tipo `Room`**.
- [ ] `app/kids/page.tsx` (server) llama `listRooms()` y `listChildren()`, aplica `assignColorsDeterministic(childrenRaw.map(childToKidWithoutColor))` y pasa `rooms`, `kids`, `currentUser` a `<KidsBody>`.
- [ ] `app/kids/KidsBody.tsx` no importa de `@/app/lib/kids` ningún dato (solo el tipo `Kid`), importa `RoomRow` desde `@/app/actions/rooms`, y recibe `rooms` y `kids` por props.
- [ ] Cuando `kids.length === 0`, `/kids` muestra un empty state con copy amigable.
- [ ] El combobox "Sala" del modal se popula desde `listRooms()` (verificable: 3 opciones Estrellitas/Lunitas/Soles en orden alfabético).
- [ ] `app/components/kids/AddKidModal.tsx` posee `useActionState(createChild, { error: null })`, pasa `formAction`/`state`/`onSubmitAttempted` a `<AddKidForm>`, y cierra el modal via `useEffect` cuando `state.error === null && submitAttemptedRef.current`.
- [ ] `app/components/kids/AddKidForm.tsx` envuelve el contenido en `<form action={formAction} onSubmit={handleValidateBefore}>` donde `handleValidateBefore` corre la validación cliente y llama `event.preventDefault()` si falla.
- [ ] El botón "Guardar" usa `useFormStatus().pending` → disabled + texto "Guardando…" durante el submit.
- [ ] `state.error` se muestra inline en rojo dentro del modal.
- [ ] Tras un submit exitoso, el modal cierra (sin `redirect` desde el server; via client effect en `AddKidModal`).
- [ ] Tras un submit exitoso, el niño aparece en `/kids` agrupado bajo su sala (refresca la lista via `revalidatePath`).
- [ ] `app/kids/[id]/page.tsx` usa `getChildById`, mapea via `assignColorsDeterministic([childToKidWithoutColor(child)])[0]`, y renderiza `KidProfileBody` con datos reales.
- [ ] `/kids/<uuid-inexistente>` muestra la página 404 "Niño inexistente".
- [ ] `app/actions/children/create-child.ts` ya no llama `redirect('/kids')` (sustituido por `revalidatePath` + return null) y ya no lee `photo_consent` del formData.
- [ ] El color de avatar se asigna determinísticamente por `assignColorsDeterministic` (verificable: primer niño siempre recibe `#A9D9E8`, segundo el menos usado, etc.). No se persiste en DB.
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.
- [ ] Screenshots `.playwright-mcp/spec-09-kids-empty.png`, `spec-09-add-modal.png`, `spec-09-after-add.png`, `spec-09-profile.png`, `spec-09-404.png` capturados.

## Decisiones

- **Sí: lista de niños leída desde DB (no más mocks).** Coherente con "eliminando la dependencia de datos estáticos" y con SPEC 09.
- **Sí: lista arranca vacía (sin seed de los 16 mocks).** Decisión del usuario: los niños se cargan por el modal.
- **Sí: `getChildById` como server action nueva.** Reutiliza el patrón de `listChildren` (mismo JOIN y filtro). Alternativa descartada: query inline en el `page.tsx` — duplica lógica, menos testeable.
- **Sí: `app/lib/kid-mapper.ts` separado.** Mantiene `app/lib/kids.ts` como solo tipos/view models. Testeable como funciones puras.
- **Sí: validación cliente conservada.** UX inmediata (no esperar al server). El server re-valida (defense-in-depth).
- **Sí: `createChild` modificado para devolver `{ error: null }` en vez de `redirect`.** Con `redirect`, el state `isModalOpen` (client) sobrevive a la navegación y el modal queda visible con datos stale. Devolver null permite que el client controle el cierre y `revalidatePath` actualiza la lista. Es un cambio mínimo a SPEC 08 (justificado y documentado al top del archivo).
- **Sí: `photo_consent` se omite del INSERT (DB default `true` aplica).** Decisión del usuario: la UI de consentimiento se trabaja en spec futuro. Insertar `false` explícito sería semánticamente incorrecto (consentimiento revocado). Omitir el campo deja el default. **El `<form>` actual no contiene un input `name="photo_consent"`**, así que la eliminación es solo del lado del server action — no hay JSX que quitar.
- **Sí: empty state con copy amigable.** Decisión de UX: cuando la lista arranca vacía, no mostrar solo "No se encontraron niños" (que sugiere búsqueda vacía).
- **Sí: color de avatar asignado por `assignColorsDeterministic` (two-pass).** La primera pasada (`childToKidWithoutColor`) no toca color. La segunda pasada itera la lista y para cada niño toma el color menos usado entre los ya asignados vía `pickNextColor(yaAsignados, k => k.color)`. **Por qué dos pasadas:** el primer borrador del spec hacía una sola pasada `pickNextColor(allChildren, c => c.id)`, pero como `pickNextColor` cuenta cuántos items matchean cada palette color, y los UUIDs nunca matchean `#A9D9E8`/etc., todos los counts quedaban en 0 y la función devolvía siempre el primer color del array para todos los niños — bug grave. El patrón del modal original (`buildKid` en SPEC 04) usaba `pickNextColor(existingKids, k => k.color)` sobre el state local; el two-pass generaliza eso a la lista completa de DB.
- **Sí: `useActionState` vive en `AddKidModal`, no en `AddKidForm`.** Lift-up state: una sola fuente de verdad para el effect de cierre (que mira `state.error === null && submitAttemptedRef.current`). `AddKidForm` solo valida cliente y dispara `onSubmitAttempted()`. Alternativa descartada: state en `AddKidForm` + callback al padre — más prop-drilling, doble render innecesario.
- **Sí: patrón de submit `<form onSubmit={validateBefore}>` con `event.preventDefault()` si falla.** Más estándar que `<button type="button" onClick={...}> + formRef.current.requestSubmit()`. Enter envía el form naturalmente. La validación cliente corre antes que el server action; si pasa, no hace nada y deja que `formAction` dispare.
- **Sí: borrar tipo `Room` de `app/lib/kids.ts`; los componentes importan `RoomRow` directo.** Cero tipos duplicados. `Room` solo tenía `{ id, name }` — submapping trivial que no aporta valor frente a `RoomRow`. Decisión de limpieza.
- **Sí: side-effect funcional — `medicalNotes` pasa a persistirse.** El `handleSubmit` actual del form arma `onSubmit({ fullName, birthDate, roomId, allergies })` — `medicalNotes` queda en estado React pero **no se envía**. Al pasar a server action form con `name="medical_notes"` en el `<textarea>`, FormData lo incluye. Mejora funcional que el spec reconoce: el mock actual no persiste notas médicas; este cambio las hace persistir.
- **No: persistir color de avatar en DB.** El mock tenía `color` como parte del dominio; el doc de schema de DB no la incluye. Se calcula determinísticamente por `assignColorsDeterministic` sobre la lista. Trade-off: un niño puede cambiar de color si se reordena la lista; aceptable para MVP.
- **No: tests automatizados.** No hay framework configurado.
- **No: revalidatePath del perfil (`/kids/[id]`) después de edit.** La edición no está en scope de SPEC 09.
- **No: realtime subscription sobre `children`.** Out of scope; los updates entre tabs no se reflejan en vivo.

## Riesgos

| Riesgo                                                                                              | Mitigación                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Si DB-04 no está aplicado, `createChild` falla con `permission denied`                              | DB-04 ya está Implementado (commit `49fe830`). Verificable con `pg_policy` antes de implementar SPEC 09.                                                              |
| `redirect('/kids')` eliminado de `createChild` puede romper otros callers                           | Hoy `createChild` solo lo llama `AddKidForm`. No hay otros consumidores. Verificable con grep en el paso 13.                                                           |
| Color del avatar cambia entre renders por orden de lista                                            | Aceptable; se documenta en §Decisiones. Si molesta, se agrega `color text` a `ChildRow` en un spec futuro.                                                             |
| **Bug latente:** el primer borrador del spec usaba `pickNextColor(allChildren, c => c.id)` que devolvía el mismo color para todos los niños (UUIDs nunca matchean palette). | Resuelto en §Decisiones: two-pass `assignColorsDeterministic` sobre la lista ya mapeada. Testeable: el primer niño siempre recibe `#A9D9E8`.                          |
| Mapper `childToKidWithoutColor` rompe si `rooms` (relación) es `null`                               | El JOIN es `rooms!inner` que garantiza `rooms` no-null. El mapper tolera `null` con `child.rooms?.name ?? ''` por defensa.                                             |
| Modal queda abierto tras error de servidor                                                          | El state `state.error` se muestra y el modal permanece (no se cierra). El effect de cierre solo dispara con `error === null` tras un submit attempted.                 |
| `submitAttemptedRef` queda en `true` si el usuario cierra el modal con error                        | El effect no cierra (porque `state.error !== null`); pero el ref persiste para el próximo intento. Aceptable: cada submit lo setea de nuevo.                            |
| `revalidatePath('/kids')` no invalida la caché de `/kids/[id]`                                      | Aceptable para SPEC 09; el perfil no se edita en este spec. Si en el futuro se navega al perfil del niño recién creado, hace fetch fresco porque es una ruta distinta. |
| Validación cliente bloquea submit pero no muestra error visual si el server devuelve error distinto | La validación cliente y la server son complementarias; si discrepan (e.g. sala ya borrada en DB entre carga y submit), el server error se muestra.                     |
| `medical_notes` del form llega vacío y el server guarda `null` (correcto) vs string vacío           | `create-child.ts` ya hace `medicalNotes \|\| null`. OK.                                                                                                                |
| Side-effect: `medicalNotes` pasa a persistirse (antes no se enviaba)                                | Mejora funcional; el mock actual no las persistía. Documentado en §Decisiones.                                                                                         |
| `addKidModal` sin `existingKids` pierde la asignación de color previa al alta                       | El color se asigna server-side vía `assignColorsDeterministic` (two-pass), aceptable.                                                                                  |

## Qué no entra en este spec

- Edición, eliminación o archivado de niños desde la UI.
- UI de `photo_consent`.
- Subida de foto del niño (Storage).
- Vinculación de padres (tabla `parent_children`).
- Seed de niños en DB (decisión del usuario).
- Paginación / búsqueda server-side.
- Realtime updates.
- Tests automatizados.
- Sidebar / feed / otros flujos fuera de `/kids` y `/kids/[id]`.

## Resultados de verificación

_(A llenar tras la implementación.)_
