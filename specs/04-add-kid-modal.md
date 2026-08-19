# SPEC 04 — Modal "Agregar niño" en `/kids`

> **Estado:** Aprobado
> **Depende de:** SPEC 02 — Listado y perfil de niños `/kids` y `/kids/[id]`
> **Fecha:** 2026-08-19
> **Objetivo:** Convertir el botón "Agregar niño" de `/kids` en un control modal que reproduce la pantalla `reference/pantallas/agregar-nino.dc.html`, valida nombre completo, fecha de nacimiento y sala como obligatorios (con máscara `dd/mm/aaaa` y `<select>` poblado desde `app/lib/kids.ts`), y al guardar inserta al niño nuevo en el listado local de `/kids`.

## Alcance

**Incluye:**

- Reemplazar el `<a href="#" onClick={prevent}>` de "Agregar niño" en `app/kids/page.tsx` por un `<button type="button">` que abre el modal.
- Nuevo componente `app/components/kids/AddKidModal.tsx` (arrow function, `'use client'`) que renderiza el modal:
  - Overlay fijo (`fixed inset-0 z-50`) con `bg-black/40`.
  - Montado con **`createPortal(..., document.body)`** solo después de confirmar que el componente está montado en el cliente, para evitar problemas de SSR y de stacking context dentro del `<main className="... overflow-y-auto">`.
  - Bloquea el scroll del body mientras está abierto y lo restaura al cerrarse.
  - Cierra al hacer click en el backdrop, con la tecla `Escape` y con el botón "Cancelar".
  - Guarda el elemento activo (`document.activeElement`) al abrir y lo restaura al cerrar; si ya no existe, fallback al `<button>` "Agregar niño" pasado por `triggerRef`.
  - Enfoca el primer input ("Nombre completo") al abrir.
- Nuevo componente `app/components/kids/AddKidForm.tsx` (arrow function, `'use client'`) dentro del modal, que reproduce fielmente el contenido de `reference/pantallas/agregar-nino.dc.html`:
  - Cabecera: link "Cancelar" (izquierda, color `muted-light`), título centrado "Agregar niño" en Fredoka (`font-display`), botón "Guardar" (derecha, color `primary`).
  - Campos en orden: NOMBRE COMPLETO, FECHA DE NACIMIENTO + SALA (misma fila en `flex gap-14`), ALERGIAS (ETIQUETAS), NOTAS MÉDICAS (textarea).
  - Estilos consistentes con `app/components/kids/SearchInput.tsx`: inputs con `rounded-[14px]`, `border border-card-border`, `bg-card`, padding `13px 16px`, fuente `text-[15px]`, `placeholder:text-placeholder-text`. Labels en `text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light` con `mb-2`.
- Campo "Sala" como `<select>` nativo estilizado con las mismas clases que los inputs y un `ChevronDownIcon` a la derecha; opciones pobladas desde `rooms` (`Sala Soles`, `Sala Lunas`) usando el `Room` ya exportado por `app/lib/kids.ts`.
- Campo "Fecha de nacimiento" con máscara `dd/mm/aaaa` autoformateada: el usuario escribe dígitos, el componente inserta `/` automáticamente después del día y del mes, limita la entrada a 10 caracteres (`dd/mm/aaaa`) y rechaza caracteres no numéricos; al guardar se parsea a `YYYY-MM-DD` para coincidir con `Kid.birthDate`.
- Validación inline solo al intentar guardar (clic en "Guardar"):
  - `Nombre completo` obligatorio: si viene vacío o solo espacios, muestra `text-[12.5px] text-[#D9583C]` debajo del input con "Este campo es obligatorio.".
  - `Fecha de nacimiento` obligatoria y válida: si está vacía, incompleta, contiene caracteres no numéricos, o no representa una fecha real (por ejemplo `31/02/2024` o `13/20/2024`), muestra "Este campo es obligatorio.". Si la fecha es válida pero está en el futuro, muestra "La fecha no puede ser en el futuro.".
  - `Sala` obligatoria: si el `<select>` no tiene valor, muestra "Este campo es obligatorio.".
  - Los mensajes de error se renderizan dentro de un contenedor con `aria-live="polite"` y cada input inválido recibe `aria-invalid="true"`.
- El estado de los inputs y los errores se mantiene local en `AddKidForm`; al cancelar, cerrar el backdrop o presionar Escape se descartan sin pedir confirmación.
- **Reset del formulario:** `AddKidForm` resetea sus estados cada vez que la prop `open` cambia a `true`, para que una segunda apertura arranque limpia.
- Alta local: al guardar exitosamente, el modal se cierra y el niño nuevo se inserta al inicio de la lista en `/kids` (state local de la página). `AddKidModal` notifica el alta vía `onAddKid(kid: Kid)` y `app/kids/page.tsx` actualiza su `useState<Kid[]>(kids)`.
- Accesibilidad del modal: `role="dialog"` `aria-modal="true"` `aria-labelledby="add-kid-title"`, título del modal con `id="add-kid-title"`.
- `app/components/icons.tsx`: agregar `ChevronDownIcon` (arrow function con `className?: string`, viewBox 24x24, `path d="m6 9 6 6 6-6"`, stroke `currentColor`, `strokeWidth="2.2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`).

**Fuera de alcance:**

- Persistencia entre recargas (no hay base de datos ni backend).
- Edición de niños (el botón Editar del perfil sigue inactivo).
- Eliminación de niños.
- Subida de foto del niño.
- Validación real de edad mínima ni tope máximo.
- Validación de duplicados por nombre.
- Cambio de `app/lib/kids.ts` (la fuente de `Room` y `rooms` se reutiliza tal cual).
- Internacionalización del modal (UI en español, igual que el resto del proyecto).
- Animaciones de entrada/salida del modal más allá de una transición `opacity` simple.
- Cierre con confirmación "¿desea descartar los cambios?".
- Captura o navegación por teclado dentro de un combobox custom (se usa `<select>` nativo).

## Modelo de datos

No se introducen nuevas interfaces. Se reutiliza la `Kid` ya definida en `app/lib/kids.ts` y se construye un `Kid` válido a partir del formulario. La forma del objeto creado es:

```ts
const newKid: Kid = {
  id: slugify(`${firstName}-${lastName}`),
  firstName,
  lastName,
  age: differenceInYears(today, birthDate),
  birthDate: formatISO(birthDate),
  roomId: selectedRoom.id,
  roomName: selectedRoom.name,
  enrollmentDate: formatISO(today),
  initial: firstName.charAt(0).toUpperCase(),
  color: pickNextColor(),
  allergies: allergiesInput.trim() === '' ? undefined : allergiesInput.trim(),
  linkedParents: [],
};
```

Detalles del modelo:

- `slugify` minúscula, sin tildes, sin caracteres no alfanuméricos, separado por `-`. Si ya existe un id igual en la lista actual, se le agrega sufijo `-${timestamp}`.
- `age` se calcula con la diferencia entera en años entre hoy y la fecha de nacimiento parseada.
- `birthDate` se guarda como `YYYY-MM-DD` para coincidir con el resto del dataset.
- `enrollmentDate` es hoy, en `YYYY-MM-DD`.
- `color` rota entre la paleta existente (`#A9D9E8`, `#A9C7E8`, `#F4B8CC`, `#B9DEC4`, `#F4DC8E`, `#C9B6E8`) eligiendo el color con menor cantidad de usos en la lista actual.
- `firstName`/`lastName` se derivan partiendo `Nombre completo` por el primer espacio: lo anterior al primer espacio es `firstName`, lo posterior (puede incluir espacios para apellidos compuestos) es `lastName`. Si el usuario solo escribe una palabra, `lastName` queda vacío.

## Plan de implementación

1. Agregar `ChevronDownIcon` a `app/components/icons.tsx` siguiendo la convención del archivo (arrow function, `IconProps`).
2. Crear `app/components/kids/AddKidForm.tsx` como arrow function con `'use client'`, que recibe `rooms`, `open`, `onCancel`, `onSubmit` y mantiene estado local para los cuatro campos y los errores inline. Exporta dos helpers puros: `formatDateInput(raw: string): string` (aplica la máscara `dd/mm/aaaa` mientras el usuario tipea) y `parseDateInput(value: string): Date | null` (parsea el valor final y devuelve `Date` o `null` si no es válida o está en el futuro).
3. Crear `app/components/kids/AddKidModal.tsx` como arrow function con `'use client'`:
   - Props: `open: boolean`, `onClose: () => void`, `rooms: Room[]`, `onAddKid: (kid: Kid) => void`, `triggerRef: RefObject<HTMLButtonElement>`.
   - Renderiza `null` si `!open`. Si `open`, monta un portal a `document.body` solo cuando `mounted === true`.
   - El overlay es `<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-6 py-10" onClick={onBackdropClick}>`.
   - El card tiene `bg-card rounded-3xl border border-card-border shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)] w-full max-w-[520px] overflow-hidden` y detiene la propagación del click.
   - `useEffect` que registra listener `keydown` para `Escape` solo cuando `open === true`.
   - `useEffect` que bloquea `document.body.style.overflow` mientras `open === true` y lo restaura al cerrar.
   - `useEffect` que guarda `document.activeElement` al abrir, enfoca el primer input y restaura el foco al cerrar (fallback a `triggerRef.current`).
   - Renderiza `AddKidForm` pasándole `open`, `onCancel={onClose}`, `onSubmit={(payload) => { onAddKid(buildKid(payload)); onClose(); }}`.
4. Modificar `app/kids/page.tsx`:
   - Reemplazar `const [query, setQuery] = useState('')` por `const [query, setQuery] = useState('')` y agregar `const [kidsList, setKidsList] = useState<Kid[]>(kids)`.
   - Sustituir el `<a>` de "Agregar niño" por un `<button type="button" ref={triggerRef} onClick={() => setIsModalOpen(true)}>` que conserva las clases actuales.
   - Reemplazar las menciones a `kids` por `kidsList` en `filteredKids` y `kidsByRoom`.
   - Renderizar `<AddKidModal open={isModalOpen} onClose={() => setIsModalOpen(false)} rooms={rooms} onAddKid={(kid) => setKidsList((prev) => [kid, ...prev])} triggerRef={triggerButtonRef} />`.
5. Verificar tipado (`npx tsc --noEmit`), lint (`pnpm lint`) y build (`pnpm build`).

## Criterios de aceptación

- [ ] En `/kids`, el control "Agregar niño" es un `<button>` y al hacer click abre el modal con la cabecera "Cancelar / Agregar niño / Guardar" y los cuatro grupos de campos del mock.
- [ ] El modal se monta en `document.body` vía portal.
- [ ] El modal bloquea el scroll del body mientras está abierto y restaura el scroll al cerrarse.
- [ ] Al abrir, el foco se posa sobre el input "Nombre completo"; al cerrar (por cualquier vía), el foco vuelve al botón "Agregar niño".
- [ ] La tecla `Escape`, el click en el backdrop y el botón "Cancelar" cierran el modal descartando los cambios sin pedir confirmación.
- [ ] Al volver a abrir el modal después de cerrarlo, todos los campos aparecen vacíos y sin errores.
- [ ] El campo "Fecha de nacimiento" inserta automáticamente `/` después del día y del mes, limita la entrada a 10 caracteres y rechaza caracteres no numéricos.
- [ ] El campo "Sala" es un `<select>` con dos opciones (`Sala Soles`, `Sala Lunas`) tomadas de `app/lib/kids.ts` y se muestra con el chevron del nuevo `ChevronDownIcon`.
- [ ] Al hacer click en "Guardar" con `Nombre completo`, `Fecha de nacimiento` o `Sala` vacíos o inválidos, aparecen mensajes inline rojos debajo del campo correspondiente y el modal permanece abierto.
- [ ] Una fecha como `31/02/2024` o `13/20/2024` se considera inválida y muestra el mensaje inline; una fecha futura también.
- [ ] Al guardar con los tres campos obligatorios válidos, el modal se cierra y el niño nuevo aparece al principio de la lista correspondiente a su sala en `/kids`, con avatar (inicial y color), nombre, edad calculada y sin badge de alergia ni padres vinculados.
- [ ] Si el niño nuevo tiene alergias, el badge "ALERGIA" aparece en su tarjeta siguiendo el patrón visual de las tarjetas existentes.
- [ ] `npx tsc --noEmit`, `pnpm lint` y `pnpm build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Sí:** Modal con backdrop oscurecido (`bg-black/40`) y card centrado. Es lo que el usuario pidió como "modal" y replica el contenido del mock.
- **No:** Replicar el mock tal cual (sin backdrop, sobre fondo crema) y llamarlo "modal". No cumple la definición de modal del usuario.
- **Sí:** Portal a `document.body` para montar el modal. Recomendado por Context7 para evitar problemas de SSR y stacking context dentro de un `<main>` con `overflow-y-auto`.
- **No:** Renderizar el modal inline al final del `<main>`. Riesgo de clipping o z-index inesperado por el contexto de apilamiento del padre scrollable.
- **Sí:** `<select>` nativo estilizado para el campo "Sala". Accesible por teclado y lector de pantalla sin código adicional, simple de alimentar con `rooms`.
- **No:** Combobox totalmente custom. Más código y más superficie para bugs de accesibilidad, sin ganancia visual significativa.
- **Sí:** Validación inline al intentar guardar. El usuario ve qué campo falta sin necesidad de recorrer el formulario.
- **No:** Botón "Guardar" deshabilitado hasta completar. No permite mostrar el motivo del error y se siente menos responsivo.
- **No:** Toast de errores. Pierde granularidad y se aleja del patrón del mock.
- **Sí:** Cerrar con Escape, backdrop y Cancelar. Cubre los tres caminos estándar sin fricción.
- **No:** Confirmación al descartar cambios. No hay datos persistidos y agrega fricción innecesaria.
- **Sí:** Resetear el formulario al abrir el modal. Garantiza una experiencia limpia en cada alta.
- **No:** Conservar los valores del formulario entre aperturas. Sería confuso tras un guardado exitoso.
- **Sí:** State local de la lista en `app/kids/page.tsx` (`useState<Kid[]>(kids)`). Permite reflejar el alta inmediatamente sin tocar `app/lib/kids.ts` ni agregar persistencia.
- **No:** Persistir el alta en `app/lib/kids.ts`. Cambiar el módulo mockeado haría que los niños nuevos aparezcan para todos los lectores del archivo y se perdería la noción de "estado de la sesión".
- **No:** Persistir en `localStorage`. Está fuera del alcance y agregaría complejidad que no se aprovecha todavía.
- **Sí:** Helpers puros `formatDateInput` y `parseDateInput` exportados desde `AddKidForm.tsx` (no desde `app/lib/`). Son específicos del formulario y no se prevé reuso.
- **No:** Librería externa de máscara (react-input-mask, react-number-format, etc.). La máscara de fecha es trivial y agrega dependencias innecesarias.
- **Sí:** Cálculo de `age` desde `birthDate` al guardar, igual que en el resto del dataset. Mantiene consistencia con la lógica existente.
- **No:** Permitir `age` manual en el formulario. Sería un campo redundante que puede quedar inconsistente con `birthDate`.
- **Sí:** Asignar color rotando entre la paleta existente para los niños nuevos. Visualmente consistente con el resto.
- **No:** Pedir color al usuario. No aporta valor y complica el formulario.
- **Sí:** Avatar con la inicial del nombre y color rotado; sin upload de foto. Consistente con el resto del proyecto.
- **No:** Permitir upload de foto en este spec. Está fuera de alcance.
- **Sí:** Componentes nuevos (`AddKidModal`, `AddKidForm`, `ChevronDownIcon`) como arrow functions. Sigue la convención del proyecto.
- **No:** Declararlos como `function`. Rompe la convención de helpers y sub-componentes.

## Riesgos identificados

| Riesgo                                                      | Mitigación                                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pérdida del estado al recargar                              | Documentar explícitamente en la UI que el alta no se persiste; queda como follow-up cuando exista backend.                                                                                                                         |
| IDs duplicados entre altas consecutivas                     | Sufijo `-${timestamp}` solo si el `id` derivado ya existe en la lista actual.                                                                                                                                                      |
| Bloqueo de scroll si el modal crashea sin pasar por cleanup | Usar `useEffect` con cleanup explícito (`return () => { document.body.style.overflow = '' }`) para garantizar el restore.                                                                                                          |
| Foco no se restaura al cerrar                               | Guardar `document.activeElement` al abrir; al cerrar intentar `previousActiveElement.focus()`, con fallback a `triggerRef.current?.focus()`.                                                                                       |
| `parseDateInput` con zonas horarias                         | Construir el `Date` con `new Date(year, month - 1, day)` (hora local) y formatear con `Date.toISOString().slice(0, 10)` solo si la fecha resultante no es futura; si la diferencia es de 1 día por UTC, aceptar igual como válida. |
| Cambiar `kids` por `kidsList` rompe memos existentes        | Confirmar en el paso 4 que tanto `filteredKids` como `kidsByRoom` consumen `kidsList` y que la lista se reinicia correctamente entre renders.                                                                                      |

## Qué **no** está en este spec

- Persistencia entre recargas (no hay DB ni backend).
- Edición ni eliminación de niños (queda como follow-up cuando exista backend).
- Subida de foto del niño.
- Validación de duplicados por nombre.
- Validación de edad mínima o máxima.
- Cierre con confirmación "¿desea descartar los cambios?".
- Animaciones complejas de entrada/salida del modal.
- Internacionalización.
- Cambio en `app/lib/kids.ts` (se reutiliza tal cual).

## Resultados de verificación

_(Se completa al implementar.)_
