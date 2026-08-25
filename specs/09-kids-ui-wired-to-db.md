# SPEC 09 — Wiring de UI: `/kids` y modal "Agregar niño" contra server actions

> **Estado:** Borrador
> **Depende de:** SPEC 07 (Supabase server client), SPEC 08 (`app/actions/children/*`, `app/actions/rooms/*`), DB-04 (policies de escritura staff/admin)
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
  - `computeAge(birthDateIso: string): number` — diferencia entera en años entre hoy y la fecha (local time).
  - `splitFullName(fullName: string): { firstName: string; lastName: string }` — parte por el primer espacio; si hay una sola palabra, `lastName` queda vacío.
  - `childToKid(child: ChildWithRoom, allChildren: ChildWithRoom[]): Kid` — convierte `ChildWithRoom` al view model `Kid` que consumen los componentes. Calcula `firstName/lastName`, `age`, `roomName` (de la relación embebida), `enrollmentDate` (de `enrolled_at` o `created_at`), `initial`, `color` (vía `pickNextColor(allChildren, c => c.id)` determinístico), `allergies` (join de `allergy_tags`), `linkedParents: []`.
- **`app/kids/page.tsx`** (server component): reemplaza el `getCurrentUser` + render directo por: `await listRooms()`, `await listChildren()`, mapeo a `Kid[]`, pasa todo a `<KidsBody rooms={rooms} kids={kidsView} />`.
- **`app/kids/KidsBody.tsx`**: 
  - Recibe `rooms: Room[]` y `kids: Kid[]` como props.
  - Borra `import { rooms, kids } from '@/app/lib/kids';` y el state local `kidsList`.
  - Agrupa por sala con `rooms` (no más `useMemo` sobre `kidsList` mockeado).
  - **Empty state:** si `kids.length === 0`, muestra un bloque centrado "Todavía no hay niños cargados. Usá el botón 'Agregar niño' para empezar." en lugar del grid.
  - El botón "Agregar niño" sigue abriendo el modal con `setIsModalOpen`.
- **`app/components/kids/AddKidModal.tsx`**: se simplifican las props:
  - Elimina `existingKids` y `onAddKid` (el id lo genera Postgres; el alta no es local).
  - Elimina la función `buildKid`, los imports `slugify`, `pickNextColor`, `differenceInYears`, `formatLocalDate`.
  - Conserva el portal, los efectos de scroll/foco/Escape/backdrop.
  - Pasa `onSubmit` directo al `<AddKidForm>` (el form es ahora un server action form).
- **`app/components/kids/AddKidForm.tsx`**: 
  - Convierte el submit a `<form action={formAction}>` con `useActionState(createChild, { error: null })`. Sigue el patrón de `AuthLoginForm` (SPEC 07).
  - Inputs llevan `name="full_name"`, `"birth_date"` (se envía `dd/mm/aaaa`, el action ya parsea), `"room_id"`, `"medical_notes"`, `"allergy_tags"`.
  - Botón "Guardar" → `type="submit"` con `useFormStatus().pending` → disabled + texto "Guardando…".
  - Se conserva la validación inline cliente (UX inmediata); si pasa, el form se submitea y el server re-valida.
  - `state.error` (server) se muestra inline en un `<p className="...">` rojo bajo el header del modal.
  - Al haber éxito (`state.error === null` después de un submit), `AddKidModal` cierra via `useEffect` que mira el flag de "submit attempted" + estado. (El modal no usa `redirect` — ver §Decisiones.)
- **`app/kids/[id]/page.tsx`**: reemplaza `getKidById(id)` por `await getChildById(id)`. Si `null` → `notFound()`. Si existe, lo mapea via `childToKid` y renderiza `<KidProfileBody kid={mappedKid} />`. Mantiene la auth guard (`redirect('/auth')`).
- **`app/actions/children/create-child.ts`** (ajuste menor justificado):
  - Se quita `redirect('/kids')` → en su lugar devuelve `{ error: null }` en éxito. Razón: con `redirect`, el state `isModalOpen` (client) sobrevive a la recarga y el modal queda visible mostrando datos stale.
  - Se agrega `revalidatePath('/kids')` antes del return de éxito.
  - Se elimina la lectura de `photo_consent` del formData y la columna del INSERT → aplica el default `true` de DB. Decisión transitoria hasta un spec futuro que defina la UI de consentimiento (no en scope de SPEC 09).
- **`app/lib/kids.ts`**: se eliminan los arrays `kids`, `rooms` y la función `getKidById`. Se conservan los tipos `Kid`, `Room`, `Parent`, `ParentStatus` y `getAvatarTextColor` (helper usado por `KidCard`, `KidProfileHeader`).
- Verificación: `npx tsc --noEmit`, `pnpm lint`, `pnpm build`. Smoke test con Playwright contra `pnpm dev`: abrir modal → combobox muestra Soles/Lunitas/Estrellitas desde DB → guardar → modal cierra y niño aparece agrupado → abrir perfil → editar URL con UUID inválido → 404 "Niño inexistente".

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

No se introducen tablas ni columnas. El modelo canónico vive en DB-03 y DB-04; SPEC 09 lo consume tal cual. La vista interna `Kid` (en `app/lib/kids.ts`) pasa de estar poblada por mock a ser un **view model** derivado de `ChildWithRoom` via el mapper `childToKid`.

Forma del mapper:

```ts
// app/lib/kid-mapper.ts

import type { ChildWithRoom } from '@/app/actions/children';
import type { Kid } from '@/app/lib/kids';
import { pickNextColor } from '@/app/utils/avatar-colors';

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

export const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim(),
  };
};

export const childToKid = (
  child: ChildWithRoom,
  allChildren: ChildWithRoom[],
): Kid => {
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
    color: pickNextColor(allChildren, (c) => c.id),
    allergies:
      child.allergy_tags.length > 0 ? child.allergy_tags.join(', ') : undefined,
    linkedParents: [],
  };
};
```

Notas:

- `Kid.color` en el mock era un color de avatar predefinido (`#A9D9E8`, etc.). En DB no hay columna de color (decisión: no persistir color — se calcula determinísticamente). Para SPEC 09, se elige un color del palette via `pickNextColor` sobre la lista de children usando como key el `id` (UUID). Documentado en §Decisiones.
- `Kid.birthDate` (`YYYY-MM-DD`) coincide con `ChildRow.birth_date` (Postgres `date` se serializa como `YYYY-MM-DD`).
- `Kid.enrollmentDate` ← `ChildRow.enrolled_at` (mismo formato).
- `Kid.linkedParents` queda `[]` hasta que exista el join con `parent_children` (spec futuro).

## Plan de implementación

1. **Cargar la skill `supabase`** antes de tocar el cliente (AGENTS.md).
2. **DB-04 ya aplicado** (precondición; SPEC 09 no funciona sin policies de escritura).
3. **Crear `app/actions/children/get-child-by-id.ts`** (arrow function, `'use server'`):
   - Resuelve `daycareId = await getCurrentUserDaycareId()`; si `null`, devuelve `null`.
   - Query: `supabase.from('children').select('*, rooms!inner(id, name, daycare_id)').eq('rooms.daycare_id', daycareId).eq('id', id).maybeSingle()`.
   - Devuelve `data as ChildWithRoom | null` o `null` si `error`.
4. **Actualizar `app/actions/children/index.ts`**: agregar `export { getChildById } from './get-child-by-id';`.
5. **Crear `app/lib/kid-mapper.ts`** con `computeAge`, `splitFullName`, `childToKid` (arrow functions, tipos explícitos en retornos).
6. **Modificar `app/actions/children/create-child.ts`**:
   - Importar `revalidatePath` de `next/navigation`.
   - Quitar `redirect` del import y del happy path.
   - En éxito: `revalidatePath('/kids'); return { error: null };`.
   - Eliminar lectura de `photo_consent` y la columna del INSERT (rely on DB default).
   - Agregar comentario al top explicando el cambio vs SPEC 08 (redirect → revalidatePath + return null; omission de photo_consent transitoria).
7. **Modificar `app/lib/kids.ts`**:
   - Borrar los arrays `kids`, `rooms` (mocks) y la función `getKidById`.
   - Mantener `Kid`, `Room`, `Parent`, `ParentStatus` y `getAvatarTextColor`.
   - Agregar comentario en el top: "Mock data removed in SPEC 09; now view-model types only".
8. **Modificar `app/kids/page.tsx`** (server component):
   - Importar `listRooms` de `@/app/actions/rooms`, `listChildren` de `@/app/actions/children`, `childToKid` de `@/app/lib/kid-mapper`.
   - `const [rooms, childrenRaw] = await Promise.all([listRooms(), listChildren()]);` (rooms y children paralelos).
   - `const kids = childrenRaw.map((c) => childToKid(c, childrenRaw));`.
   - Mapear `rooms` al tipo `Room[]` del view model (RoomRow tiene `id`, `name`, `daycare_id`, `created_at`, `updated_at`; el view `Room` solo quiere `id` y `name`).
   - Pasar `currentUser`, `rooms`, `kids` a `<KidsBody />`.
9. **Modificar `app/kids/KidsBody.tsx`**:
   - Cambiar firma: `({ currentUser, rooms, kids }: { currentUser?: SidebarUser | null; rooms: Room[]; kids: Kid[] })`.
   - Borrar `import { rooms, kids } from '@/app/lib/kids';` y `useState<Kid[]>(kids)`.
   - `const [isModalOpen, setIsModalOpen] = useState(false);` (sin `kidsList`).
   - `filteredKids` se calcula sobre `kids` prop. `kidsByRoom` agrupa con `rooms` prop.
   - Empty state: `if (kids.length === 0) { /* bloque centrado con copy + ilustración opcional */ }`.
   - `<AddKidModal open={isModalOpen} onClose={() => setIsModalOpen(false)} rooms={rooms} triggerRef={triggerButtonRef} />` (sin `existingKids` ni `onAddKid`).
10. **Modificar `app/components/kids/AddKidModal.tsx`**:
    - Borrar imports: `Kid`, `Room` types que ya no necesita; `pickNextColor`, `slugify`.
    - Borrar funciones internas: `buildKid`, `differenceInYears`, `formatLocalDate`, y la lógica de generación de `Kid`.
    - Cambiar `AddKidModalProps`: `({ open, onClose, rooms, triggerRef })` (sin `existingKids` ni `onAddKid`).
    - El `<AddKidForm>` recibe `rooms`, `open`, `onCancel={onClose}`. La prop `onSubmit` desaparece — el form se submitea solo via `formAction`.
11. **Modificar `app/components/kids/AddKidForm.tsx`**:
    - Imports nuevos: `useActionState` de `'react'`, `useFormStatus` de `'react-dom'`, `createChild` de `@/app/actions/children`.
    - `const [state, formAction] = useActionState(createChild, { error: null });`.
    - Envuelve el contenido en `<form action={formAction}>` (el header con Cancelar/Guardar queda adentro).
    - Inputs: agregar `name="full_name"`, `"birth_date"` (valor `birthDateInput`, el server parsea `dd/mm/aaaa` directo), `"room_id"` (select con `name`), `"medical_notes"`, `"allergy_tags"`. Conservar `id` y `onChange` actuales para UX cliente.
    - Validación cliente: conservar la lógica inline existente (nombre, fecha, sala). Si falla, hacer `event.preventDefault()` en el submit handler del form — o seguir bloqueando el submit via la guard actual `return` antes de `onSubmit`. Como ahora el form submitea vía `formAction`, la validación debe correr **antes** del submit real. Solución: usar `<button type="button" onClick={handleValidateAndSubmit}>` que, si pasa validación, hace `formRef.current.requestSubmit()`. O, más simple: validación en el `onSubmit` del form (`<form onSubmit={validateBeforeServer}>`) que llama `event.preventDefault()` si falla y submitea solo si pasa.
    - Botón Guardar: `type="submit"` + componente interno `<SubmitButton>` que usa `useFormStatus`.
    - Server error inline: debajo del header, `<p className="text-[12.5px] text-[#D9583C]">{state.error}</p>` si existe.
    - Modal close on success: el componente padre (`AddKidModal`) monta un `useEffect` que detecta `state` "fue submitted y ahora es null error" → llama `onClose`. Se trackea con `useRef(false)` setteado a `true` al disparar el submit (via flag local) y leído en el effect.
12. **Modificar `app/kids/[id]/page.tsx`**:
    - Reemplazar `getKidById` por `await getChildById(id)`.
    - Si `null` → `notFound()`.
    - Si existe, `const kid = childToKid(child, [child]);` (lista de un elemento; el color se calcula con `pickNextColor` que solo necesita el set).
    - Mantener `redirect('/auth')` si no hay user.
13. **Verificación técnica:**
    - `npx tsc --noEmit` exit 0.
    - `pnpm lint` exit 0.
    - `pnpm build` exit 0 (control de regresión).
14. **Verificación funcional con Playwright** (`pnpm dev` en `localhost:3000`):
    - Login como `pedro@gmail.com` (vía SPEC 07), ir a `/kids`.
    - Lista vacía muestra empty state con copy correcto.
    - Click "Agregar niño" → modal abre, combobox "Sala" tiene 3 opciones: Soles, Lunitas, Estrellitas (en ese orden, desde DB).
    - Llenar "Martina Test", `15/05/2020`, "Soles", dejar alergias y notas vacías → click Guardar → modal cierra → niño aparece agrupado bajo "SALA SOLES 1 niño".
    - Click en la tarjeta → navega a `/kids/<uuid>` → perfil carga con avatar, nombre, edad 5 (en 2026), sala Soles, padres "—".
    - Editar URL a `/kids/00000000-0000-0000-0000-000000000000` → 404 "Niño inexistente".
    - Repetir alta con `15/05/2030` → modal muestra error inline "La fecha no puede ser en el futuro." y NO cierra.
    - Repetir alta con sala vacía → error "Este campo es obligatorio." debajo del select.
    - Screenshots en `.playwright-mcp/spec-09-*.png`.

## Criterios de aceptación

- [ ] Existe `app/actions/children/get-child-by-id.ts` con `getChildById` arrow function + `'use server'`.
- [ ] Existe `app/lib/kid-mapper.ts` con `computeAge`, `splitFullName`, `childToKid` arrow functions.
- [ ] `app/actions/children/index.ts` exporta `getChildById`.
- [ ] `app/lib/kids.ts` ya no contiene los arrays `kids`, `rooms` ni la función `getKidById`.
- [ ] `app/kids/page.tsx` (server) llama `listRooms()` y `listChildren()` y pasa los resultados como props a `<KidsBody>`.
- [ ] `app/kids/KidsBody.tsx` no importa de `@/app/lib/kids` ningún dato (solo tipos) y recibe `rooms` y `kids` por props.
- [ ] Cuando `kids.length === 0`, `/kids` muestra un empty state con copy amigable.
- [ ] El combobox "Sala" del modal se popula desde `listRooms()` (verificable: 3 opciones Soles/Lunitas/Estrellitas en orden alfabético).
- [ ] `app/components/kids/AddKidForm.tsx` usa `useActionState(createChild, { error: null })` y `<form action={formAction}>`.
- [ ] El botón "Guardar" usa `useFormStatus().pending` → disabled + texto "Guardando…" durante el submit.
- [ ] `state.error` se muestra inline en rojo dentro del modal.
- [ ] Tras un submit exitoso, el modal cierra (sin `redirect` desde el server; via client effect).
- [ ] Tras un submit exitoso, el niño aparece en `/kids` agrupado bajo su sala (refresca la lista via `revalidatePath`).
- [ ] `app/kids/[id]/page.tsx` usa `getChildById` y renderiza `KidProfileBody` con datos reales.
- [ ] `/kids/<uuid-inexistente>` muestra la página 404 "Niño inexistente".
- [ ] `app/actions/children/create-child.ts` ya no llama `redirect('/kids')` (sustituido por `revalidatePath` + return null) y ya no lee `photo_consent` del formData.
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.
- [ ] Screenshots `.playwright-mcp/spec-09-kids-empty.png`, `spec-09-add-modal.png`, `spec-09-after-add.png`, `spec-09-profile.png`, `spec-09-404.png` capturados.

## Decisiones

- **Sí: lista de niños leída desde DB (no más mocks).** Coherente con "eliminando la dependencia de datos estáticos" y con SPEC 09.
- **Sí: lista arranca vacía (sin seed de los 16 mocks).** Decisión del usuario: los niños se cargan por el modal.
- **Sí: `getChildById` como server action nueva.** Reutiliza el patrón de `listChildren` (mismo JOIN y filtro). Alternativa descartada: query inline en el `page.tsx` — duplica lógica, menos testeable.
- **Sí: `app/lib/kid-mapper.ts` separado.** Mantiene `app/lib/kids.ts` como solo tipos/view models. Testeable como funciones puras.
- **Sí: validación cliente conservada.** UX inmediata (no esperar al server). El server re-valida (defense-in-depth).
- **Sí: `createChild` modificado para devolver `{ error: null }` en vez de `redirect`.** Con `redirect`, el state `isModalOpen` (client) sobrevive a la navegación y el modal queda visible con datos stale. Devolver null permite que el client controle el cierre y `revalidatePath` actualiza la lista. Es un cambio mínimo a SPEC 08 (justificado y documentado al top del archivo).
- **Sí: `photo_consent` se omite del INSERT (DB default `true` aplica).** Decisión del usuario: la UI de consentimiento se trabaja en spec futuro. Insertar `false` explícito sería semánticamente incorrecto (consentimiento revocado). Omitir el campo deja el default.
- **Sí: empty state con copy amigable.** Decisión de UX: cuando la lista arranca vacía, no mostrar solo "No se encontraron niños" (que sugiere búsqueda vacía).
- **No: persistir color de avatar en DB.** El mock tenía `color` como parte del dominio; el doc de schema de DB no la incluye. Se calcula determinísticamente por `pickNextColor` sobre la lista. Trade-off: un niño puede cambiar de color si se reordena la lista; aceptable para MVP.
- **No: tests automatizados.** No hay framework configurado.
- **No: revalidatePath del perfil (`/kids/[id]`) después de edit.** La edición no está en scope de SPEC 09.
- **No: realtime subscription sobre `children`.** Out of scope; los updates entre tabs no se reflejan en vivo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Si DB-04 no está aplicado, `createChild` falla con `permission denied` | SPEC 09 declara dependencia explícita; el plan de implementación valida el paso 2. |
| `redirect('/kids')` eliminado de `createChild` puede romper otros callers | Hoy `createChild` solo lo llama `AddKidForm`. No hay otros consumidores. Verificable con grep en el paso 13. |
| Color del avatar cambia entre renders por orden de lista | Aceptable; se documenta en §Decisiones. Si molesta, se agrega `color text` a `ChildRow` en un spec futuro. |
| Mapper `childToKid` rompe si `rooms` (relación) es `null` | El JOIN es `rooms!inner` que garantiza `rooms` no-null. El mapper tolera `null` con `child.rooms?.name ?? ''` por defensa. |
| Modal queda abierto tras error de servidor | El state `state.error` se muestra y el modal permanece (no se cierra). El effect de cierre solo dispara con `error === null` tras un submit attempted. |
| `revalidatePath('/kids')` no invalida la caché de `/kids/[id]` | Aceptable para SPEC 09; el perfil no se edita en este spec. Si en el futuro se navega al perfil del niño recién creado, hace fetch fresco porque es una ruta distinta. |
| Validación cliente bloquea submit pero no muestra error visual si el server devuelve error distinto | La validación cliente y la server son complementarias; si discrepan (e.g. sala ya borrada en DB entre carga y submit), el server error se muestra. |
| `medical_notes` del form llega vacío y el server guarda `null` (correcto) vs string vacío | `create-child.ts` ya hace `medicalNotes \|\| null`. OK. |
| `addKidModal` sin `existingKids` pierde la asignación de color previa al alta | El color se asigna server-side vía `pickNextColor` (no por usuario), aceptable. |

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