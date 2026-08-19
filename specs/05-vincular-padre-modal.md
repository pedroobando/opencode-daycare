# SPEC 05 — Modal "Vincular padre" en `/kids/[id]`

> **Estado:** Implementado
> **Depende de:** SPEC 02 — Listado y perfil de niños `/kids` y `/kids/[id]`, SPEC 03 — Pantallas de autenticación `/auth` y `/auth/active`
> **Fecha:** 2026-08-19
> **Objetivo:** Convertir el link "Vincular otro padre" del perfil de niño en un control que abre un modal basado en `reference/pantallas/vincular-padre.dc.html`, valida nombre, email y parentesco como obligatorios, genera un código de invitación alfanumérico de 5 cifras y agrega al padre nuevo al listado local del perfil con estado `pending`, apoyándose en un folder nuevo `app/utils/` con helpers reutilizables.

## Alcance

**Incluye:**

- Reemplazar el `<a href="#" onClick={prevent}>` de "Vincular otro padre" en `app/components/kids/ParentsList.tsx` por un `<button type="button">` que abre el modal (mismo patrón que SPEC 04).
- Nuevo folder `app/utils/` para funciones internas reutilizables (separado de `app/lib/`, que queda reservado a modelos y datos de dominio).
- `app/utils/random-code.ts`:
  - `ALPHANUMERIC_CHARS: readonly string[]` — alfabeto `A–Z + 0–9`.
  - `generateAlphanumericCode(length: number): string` — arrow function pura que devuelve una cadena de la longitud indicada eligiendo caracteres al azar de `ALPHANUMERIC_CHARS` con `Math.random`. Si `length <= 0`, devuelve `''`. No es criptográficamente segura; suficiente para códigos visibles.
- `app/utils/email.ts`:
  - `EMAIL_REGEX: RegExp` — `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
  - `isValidEmail(value: string): boolean` — arrow function pura que devuelve `EMAIL_REGEX.test(value)`.
- `app/utils/slugify.ts`:
  - `slugify(text: string): string` — arrow function pura con el mismo comportamiento que la versión inline de `app/components/kids/AddKidModal.tsx`: normaliza NFD, quita tildes, pasa a minúscula, reemplaza no-alfanuméricos por `-`, recorta guiones al borde.
- `app/utils/avatar-colors.ts`:
  - `AVATAR_COLOR_PALETTE: readonly string[]` — los seis colores actuales (`#A9D9E8`, `#A9C7E8`, `#F4B8CC`, `#B9DEC4`, `#F4DC8E`, `#C9B6E8`).
  - `pickNextColor<T>(items: T[], getColor: (item: T) => string): string` — devuelve el color menos usado entre los ítems.
- Refactor mínimo de `app/components/kids/AddKidModal.tsx`: reemplazar las definiciones locales de `AVATAR_COLOR_PALETTE`, `pickNextColor` y `slugify` por imports desde `app/utils/`. `differenceInYears` y `formatLocalDate` quedan locales (no son reutilizables por ahora). No cambia el comportamiento observable de SPEC 04.
- `app/components/kids/VincularPadreModal.tsx` (arrow function, `'use client'`):
  - Props: `open: boolean`, `onClose: () => void`, `kidId: string`, `kidName: string`, `existingParents: Parent[]`, `onAddParent: (parent: Parent) => void`, `triggerRef: React.RefObject<HTMLButtonElement | null>`.
  - `kidName` es el nombre completo del niño en formato "Nombre Apellido" (por ejemplo "Mateo Fernández"). `kidId` se recibe aunque el modal actual no lo use, para mantener la API forward-compatible (un futuro flujo de activación de cuenta lo consumirá).
  - Mismo patrón de modal que `app/components/kids/AddKidModal.tsx`:
    - Renderiza `null` si `!open` o si no está montado en el cliente (hook `useMounted` igual al de SPEC 04).
    - Monta el contenido con `createPortal(..., document.body)` cuando `mounted === true`.
    - Overlay fijo (`fixed inset-0 z-50`) con `bg-black/40`, padding generoso y `overflow-y-auto`.
    - Cierra con `Escape`, click en el backdrop y botón "X" de la cabecera.
    - Bloquea el scroll del body mientras está abierto y lo restaura al cerrarse.
    - Guarda `document.activeElement` al abrir, enfoca el primer input ("Nombre del padre/madre") al abrir, restaura el foco al cerrar (fallback a `triggerRef.current`).
  - Cabecera: título "Vincular padre" en Fredoka (`font-display`), subtítulo "a {kidName}" debajo en `text-[13px] text-muted-lighter`, botón "X" a la derecha (esquina 34×34, fondo `bg-[#F0E6D8]`, ícono `CloseIcon`).
  - Bloque informativo superior: caja con fondo `bg-[#E3ECFB]` redondeada, ícono `AlertTriangleIcon` a la izquierda, texto "Le enviaremos un correo con un código para que active su cuenta. Solo verá el feed de {kidName}." en `text-[13.5px] text-[#3F5694]`.
  - Cuerpo del formulario (`VincularPadreForm.tsx`):
    - Campo **NOMBRE DEL PADRE/MADRE** — input texto, placeholder "Ej. Diego Fernández", obligatorio.
    - Campo **EMAIL** — input `type="email"`, placeholder "correo@ejemplo.com", obligatorio, validación de formato con `isValidEmail`.
    - Grupo **PARENTESCO** — tres botones tipo pill en `flex gap-9`, sin selección inicial. Solo uno activo a la vez; obligatorio. Estado activo: `border-[1.5px] border-[#9FB8EC] bg-[#CCD8F4] text-[#4E72C8]`. Estado inactivo: `border-[1.5px] border-card-border bg-[#FFFDF9] text-muted-light`.
    - Caja del **CÓDIGO DE INVITACIÓN**: fondo `bg-[#FBF1D6]`, borde `border-[1.5px] border-dashed border-[#E6D08A]`, padding `18px`, texto centrado. Muestra el código en `font-display text-[34px] font-semibold tracking-[7px] text-[#8A7234]`. Subtítulo "Vence en 7 días" debajo en `text-[13px] text-[#A88526]`. No editable.
  - Botón "Enviar invitación" al pie: full-width, `bg-gradient-to-b from-[#F4977E] to-[#EE8164]`, texto blanco en `text-[15.5px] font-extrabold`, ícono `SendIcon` a la izquierda del texto.
  - Accesibilidad: `role="dialog"` `aria-modal="true"` `aria-labelledby="vincular-padre-title"`, título con `id="vincular-padre-title"`.
- `app/components/kids/VincularPadreForm.tsx` (arrow function, `'use client'`):
  - Props: `open: boolean`, `invitationCode: string`, `onCancel: () => void`, `onSubmit: (payload: VincularPadreFormPayload) => void`.
  - Estado local para `name`, `email`, `role` y `errors`.
  - Validación solo al intentar enviar:
    - Nombre vacío o solo espacios → "Este campo es obligatorio.".
    - Email vacío o que no pase `isValidEmail` → "Ingresá un email válido.".
    - Parentesco sin selección → "Este campo es obligatorio.".
  - Los mensajes de error se renderizan en `aria-live="polite"` y cada input/grupo inválido recibe `aria-invalid="true"`.
- Generación del código: `useEffect` en `VincularPadreModal` que llama `generateAlphanumericCode(5)` cuando `open` pasa de `false` a `true` y guarda el resultado en estado local. El código no se regenera mientras el modal sigue abierto; sí se regenera en cada nueva apertura.
- `app/components/kids/KidProfileBody.tsx` (arrow function, `'use client'`):
  - Props: `kid: Kid`.
  - `const [parents, setParents] = useState<Parent[]>(kid.linkedParents)`.
  - `const [isModalOpen, setIsModalOpen] = useState(false)`.
  - `const triggerRef = useRef<HTMLButtonElement | null>(null)`.
  - Renderiza el mismo árbol que hoy arma `app/kids/[id]/page.tsx` dentro del `<main>`: link "Volver a Niños", `KidProfileHeader`, `AllergyAlert` (condicional), caja de datos personales, `InactiveLink` "Resumen del día" y `ParentsList`. Consume el state local de `parents` para `ParentsList`.
  - Pasa a `ParentsList` `onRequestLinkParent={() => setIsModalOpen(true)}` y `triggerRef`.
  - Renderiza `<VincularPadreModal kidId={kid.id} kidName={`${kid.firstName} ${kid.lastName}`.trim()} existingParents={parents} onAddParent={(parent) => setParents((prev) => [...prev, parent])} ... />`.
- Modificar `app/components/kids/ParentsList.tsx`:
  - Agregar `onRequestLinkParent: () => void` y `triggerRef: React.RefObject<HTMLButtonElement | null>` a las props (required).
  - Reemplazar el `<a href="#" onClick={prevent}>` final por un `<button type="button" ref={triggerRef} onClick={onRequestLinkParent} className="flex items-center gap-3 pt-2">` que conserva las clases visuales.
- Modificar `app/kids/[id]/page.tsx`:
  - Queda como server component casi vacío: lookup del kid, `notFound()` si no existe, layout con `Sidebar`/`MobileDrawer`, link "Volver a Niños" y `MobileDrawer`.
  - El cuerpo del perfil lo renderiza `<KidProfileBody kid={kid} />`.
- `app/components/icons.tsx`: agregar `SendIcon` (arrow function con `className?: string`, viewBox 24x24, paths `d="m22 2-7 20-4-9-9-4z"` y `d="M22 2 11 13"`, stroke `currentColor`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`).
- **Cambio de alcance respecto a SPEC 03**: usar `isValidEmail` en las dos pantallas de auth para validar el email al enviar:
  - `app/components/auth/AuthLoginForm.tsx` (arrow function, `'use client'`) — nuevo componente que reemplaza el `<div className="space-y-4">` de `app/auth/page.tsx`. Props: `defaultEmail: string`. Estado local para `email`, `password`, `error`. Valida con `isValidEmail` al enviar ("Iniciar sesión"); si es inválido, muestra "Ingresá un email válido." inline y no navega. Si es válido, navega a `/`. El resto del layout de la página (título, subtítulo, link "¿Olvidaste tu contraseña?", link "Activá tu cuenta") sigue en `app/auth/page.tsx`.
  - `app/auth/page.tsx` — server component simplificado: `searchParams`, layout externo (`<div className="w-full max-w-[392px]">`), título, subtítulo, link "¿Olvidaste tu contraseña?", `<AuthLoginForm defaultEmail={email ?? ''} />`, link "Iniciar sesión" pasa a estar dentro de `AuthLoginForm`, y bloque final "¿Te invitó la guardería? Activá tu cuenta" sigue en la página.
  - `app/auth/active/page.tsx` — agregar estado local para `emailError`. El input email ahora es controlado (`useState`). El link "Activar mi cuenta" se convierte en `<button type="button">` con `onClick` que valida con `isValidEmail`; si es inválido, muestra "Ingresá un email válido." inline y no navega. Si es válido, navega a `/auth?email={email.trim()}`.

**Fuera de alcance:**

- Persistencia entre recargas (no hay DB ni backend).
- Envío real del correo (solo se muestra el código generado en pantalla).
- Activación real de la cuenta del padre a partir del código.
- Expiración real del código a los 7 días.
- Cambio en `app/lib/kids.ts` (la lista de padres nuevos vive solo en el state del wrapper cliente).
- Edición o eliminación de padres vinculados.
- Validación de duplicado por email o nombre del padre.
- Animaciones de entrada/salida del modal más allá del modal base.
- Cierre con confirmación "¿desea descartar los cambios?".
- Internacionalización (UI en español, como el resto del proyecto).
- Tests automatizados (mismo criterio que SPEC 02/03/04).
- Reordenamiento de los padres en la lista (siempre se agrega al final).
- Validar la contraseña en `/auth` y `/auth/active` (solo se valida email, por pedido explícito del usuario).
- Validar el código de invitación en `/auth/active` (sigue mockeado como `defaultValue="7K4P9"`).

## Modelo de datos

No se introducen nuevas interfaces. Se reutilizan `Parent` y `Kid` ya definidos en `app/lib/kids.ts`. La forma del `Parent` creado es:

```ts
const newParent: Parent = {
  id: slugify(name) + (alreadyUsed ? `-${timestamp}` : ''),
  name,
  role, // 'Mamá' | 'Papá' | 'Tutor/a'
  status: 'pending',
  initial: name.charAt(0).toUpperCase(),
  color: pickNextColor(existingParents, (p) => p.color),
};
```

- `id` se genera con `slugify` (importado de `app/utils/slugify.ts`). Si ya existe en la lista actual de padres del niño, se le agrega sufijo `-${Date.now()}`.
- `name` es el nombre completo trimmeado.
- `role` es exactamente uno de los tres valores del grupo de parentesco.
- `status` siempre es `'pending'`.
- `initial` es la primera letra del nombre en mayúscula.
- `color` se elige con `pickNextColor` (importado de `app/utils/avatar-colors.ts`) sobre la paleta compartida, contando usos en `existingParents` (los padres ya vinculados a este niño).

## Plan de implementación

1. Crear `app/utils/random-code.ts` con `generateAlphanumericCode` y `ALPHANUMERIC_CHARS`.
2. Crear `app/utils/email.ts` con `isValidEmail` y `EMAIL_REGEX`.
3. Crear `app/utils/slugify.ts` con `slugify`.
4. Crear `app/utils/avatar-colors.ts` con `AVATAR_COLOR_PALETTE` y `pickNextColor`.
5. Refactorizar `app/components/kids/AddKidModal.tsx`: borrar las definiciones locales de `AVATAR_COLOR_PALETTE`, `pickNextColor` y `slugify`; importar de `app/utils/`. `differenceInYears` y `formatLocalDate` quedan locales. Verificar con SPEC 04 que el comportamiento sigue idéntico.
6. Agregar `SendIcon` a `app/components/icons.tsx` siguiendo la convención del archivo (arrow function, `IconProps`).
7. Crear `app/components/kids/VincularPadreForm.tsx` (arrow function, `'use client'`):
   - Estado local para `name`, `email`, `role` y `errors`.
   - Valida al enviar (`isValidEmail` para el email). Si todo OK llama `onSubmit({ name: name.trim(), email: email.trim(), role })`.
   - Renderiza los tres campos (mismos estilos que `AddKidForm`: `rounded-[14px]`, `border border-card-border`, `bg-card`, padding `13px 16px`, fuente `text-[15px]`, `placeholder:text-placeholder-text`; labels en `text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light`), el grupo de parentesco, la caja del código y el botón "Enviar invitación".
8. Crear `app/components/kids/VincularPadreModal.tsx` (arrow function, `'use client'`):
   - Sigue la estructura de `AddKidModal.tsx`: portal, escape, backdrop, body scroll lock, focus management, accesibilidad.
   - `useEffect` que, al pasar `open` de `false` a `true`, genera `generateAlphanumericCode(5)` y lo guarda en estado local.
   - Renderiza cabecera (título + subtítulo + X), bloque informativo y `VincularPadreForm`.
   - `handleSubmit` arma el `Parent` (slugify + sufijo si choca + initial + color vía `pickNextColor(existingParents, ...)`), llama `onAddParent`, cierra el modal.
9. Crear `app/components/kids/KidProfileBody.tsx` (arrow function, `'use client'`):
   - `useRef<HTMLButtonElement | null>(null)` para `triggerRef`.
   - `useState<Parent[]>(kid.linkedParents)` para la lista de padres.
   - `useState<boolean>(false)` para el modal.
   - Renderiza la misma estructura que la página hoy arma dentro del `<main>` (link volver, columna izquierda con `KidProfileHeader`, `AllergyAlert` condicional, datos personales; columna derecha con `InactiveLink` "Resumen del día" y `ParentsList`).
   - Pasa a `ParentsList` el callback para abrir el modal y el `triggerRef`.
   - Renderiza `<VincularPadreModal kidId={kid.id} kidName={`${kid.firstName} ${kid.lastName}`.trim()} existingParents={parents} onAddParent={(parent) => setParents((prev) => [...prev, parent])} ... />`.
10. Modificar `app/components/kids/ParentsList.tsx`:
    - Agregar `onRequestLinkParent: () => void` y `triggerRef: React.RefObject<HTMLButtonElement | null>` a las props.
    - Reemplazar el `<a>` final por un `<button type="button" ref={triggerRef} onClick={onRequestLinkParent} className="flex items-center gap-3 pt-2">` con las clases visuales originales.
11. Modificar `app/kids/[id]/page.tsx`:
    - Quitar las importaciones y los JSX de `KidProfileHeader`, `AllergyAlert`, `ParentsList`, `InactiveLink`.
    - Importar `KidProfileBody` y renderizarlo en el mismo lugar del `<main>`.
12. Crear `app/components/auth/AuthLoginForm.tsx` (arrow function, `'use client'`):
    - Props: `defaultEmail: string`.
    - Estado local para `email`, `password`, `error`.
    - Renderiza los inputs email y password, y el botón "Iniciar sesión" (full-width con gradiente).
    - `onSubmit` valida `isValidEmail(email)`. Si inválido, setea error y no navega. Si válido, navega a `/`.
13. Modificar `app/auth/page.tsx`:
    - Mantener el async server component, `searchParams` y todo el layout externo (contenedor, título, subtítulo, link "¿Olvidaste tu contraseña?", bloque "¿Te invitó la guardería?").
    - Reemplazar el `<div className="space-y-4">` con los inputs email y password por `<AuthLoginForm defaultEmail={email ?? ''} />`.
14. Modificar `app/auth/active/page.tsx`:
    - Agregar `useState` para `email` (controlado, inicial `lucia.fernandez@gmail.com`) y `emailError`.
    - Cambiar el input email a controlado.
    - Convertir el `<Link>` "Activar mi cuenta" en `<button type="button">` con `onClick` que valida `isValidEmail(email)`. Si inválido, setea `emailError` y no navega. Si válido, hace `router.push({\`/auth?email=${encodeURIComponent(email.trim())}\`})`.
15. Verificar tipado (`npx tsc --noEmit`), lint (`pnpm lint`) y build (`pnpm build`).

## Criterios de aceptación

- [x] `app/utils/email.ts` exporta `isValidEmail` y `EMAIL_REGEX`. Casos verificados manualmente: `ana@gmail.com`, `x@y.io`, `pedro.lopez@open-daycare.com.ar` → `true`; `foo`, `foo@`, `@bar.com`, `foo bar@x.com`, `foo@@bar.com` → `false`.
- [x] `app/utils/random-code.ts` exporta `generateAlphanumericCode` y `ALPHANUMERIC_CHARS`. `generateAlphanumericCode(5)` siempre devuelve una cadena de 5 caracteres en `A–Z + 0–9`; `generateAlphanumericCode(0)` y `generateAlphanumericCode(-3)` devuelven `''`.
- [x] `app/utils/slugify.ts` exporta `slugify` con el mismo comportamiento que la versión inline de `AddKidModal` (verificado con casos: "Diego Fernández" → `diego-fernandez`, "María José" → `maria-jose`, " Lucía " → `lucia`).
- [x] `app/utils/avatar-colors.ts` exporta `AVATAR_COLOR_PALETTE` y `pickNextColor`. `pickNextColor([], () => '')` devuelve el color menos usado de la lista (que con input vacío es el primero de la paleta).
- [x] En `/kids/[id]` para un niño con al menos un padre, el control "Vincular otro padre" es un `<button>` y al hacer click abre el modal con cabecera "Vincular padre", subtítulo "a {nombreCompleto}" y botón X a la derecha.
- [x] El modal se monta en `document.body` vía `createPortal`; tiene `role="dialog"`, `aria-modal="true"` y `aria-labelledby="vincular-padre-title"`.
- [x] El modal bloquea el scroll del body mientras está abierto y lo restaura al cerrarse; cierra con `Escape`, click en el backdrop y botón X; al cerrar, el foco vuelve al botón "Vincular otro padre".
- [x] Al abrir, el foco se posa sobre el input "Nombre del padre/madre".
- [x] El campo "Nombre del padre/madre" muestra placeholder "Ej. Diego Fernández" y es obligatorio.
- [x] El campo "Email" muestra placeholder "correo@ejemplo.com", es obligatorio y rechaza con error "Ingresá un email válido." los valores inválidos según `isValidEmail`.
- [x] El grupo "Parentesco" tiene tres botones pill (Mamá, Papá, Tutor/a), arranca sin selección, solo uno puede estar activo a la vez, es obligatorio y al enviar sin selección muestra "Este campo es obligatorio.".
- [x] La caja "CÓDIGO DE INVITACIÓN" muestra un código alfanumérico de exactamente 5 caracteres en `A–Z + 0–9`, generado por `generateAlphanumericCode(5)`. El código no se regenera mientras el modal está abierto; sí se regenera al cerrar y volver a abrir.
- [x] Bajo el código aparece el texto "Vence en 7 días".
- [x] Al enviar con nombre vacío, email inválido o sin parentesco, aparecen mensajes inline de error rojos en los campos correspondientes y el modal permanece abierto.
- [x] Al enviar con los tres campos válidos, el modal se cierra y el padre nuevo aparece al final del listado de `ParentsList` con badge `PENDIENTE`, avatar con la inicial del nombre y un color de la paleta compartida elegido por menor uso sobre `existingParents`.
- [x] El padre nuevo tiene `status: 'pending'` y `role` exactamente igual al parentesco elegido ("Mamá", "Papá" o "Tutor/a").
- [x] Si el `slugify(nombre)` ya existe en la lista actual de padres del niño, el `id` del nuevo padre lleva sufijo `-${timestamp}` (mismo patrón que SPEC 04).
- [x] El padre nuevo se agrega solo al state local del wrapper cliente; no se modifica `app/lib/kids.ts` y al recargar la página desaparece.
- [x] Después del refactor del paso 5 del plan, agregar un niño en `/kids` con el modal sigue produciendo un `Kid` con color de la paleta compartida e `id` con sufijo en caso de colisión (SPEC 04 sin regresiones).
- [x] `/auth` al hacer click en "Iniciar sesión" con email inválido, aparece "Ingresá un email válido." inline y no se navega a `/`. Con email válido, navega a `/`. El campo email se prellena desde `?email=...` como antes.
- [x] `/auth/active` al hacer click en "Activar mi cuenta" con email inválido, aparece "Ingresá un email válido." inline y no se navega. Con email válido, navega a `/auth?email={email}` como antes.
- [x] `/auth/active` con el email prefijado (`lucia.fernandez@gmail.com`) sigue activando la cuenta y llegando a `/auth` con el query param.
- [x] `npx tsc --noEmit`, `pnpm lint` y `pnpm build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Sí:** `app/utils/` como folder de helpers reutilizables. Separado de `app/lib/`, que queda reservado a modelos y datos de dominio.
- **No:** Meter los helpers dentro de `app/lib/`. Mezclaría dominio con utilidades.
- **No:** `app/helpers/` o `app/tools/`. `utils` es la convención más común en React/Next.
- **Sí:** `app/utils/email.ts` con `isValidEmail` y `EMAIL_REGEX`. Reusable para cualquier input de email (este modal + auth pages + futuros).
- **No:** Validar email con librería externa (zod, yup). Una regex basta.
- **No:** Validar email con la validación nativa de `type="email"` del browser. Es laxa, no permite mensajes consistentes y no reutilizable.
- **Sí:** Función genérica `generateAlphanumericCode(length: number)` en `app/utils/random-code.ts`, llamada con `5` desde el modal. Reusable para futuros códigos (reset de contraseña, OTP, etc.).
- **No:** Función hardcodeada `generateInvitationCode()` de longitud fija 5. Menos reusable.
- **Sí:** `Math.random` para la generación. Los códigos son visibles en pantalla, no son tokens de seguridad.
- **No:** `crypto.getRandomValues` o librería criptográfica. Sobreingeniería para este caso.
- **Sí:** Generar el código una sola vez al abrir el modal y conservarlo durante toda la sesión del modal. Pertenece a esta invitación.
- **No:** Regenerar en cada keystroke del usuario. Confundiría al usuario viendo un código que cambia.
- **No:** Regenerar si el usuario hace click sobre el código. No está en el mock y agrega fricción.
- **Sí:** Extraer `AVATAR_COLOR_PALETTE`, `pickNextColor` y `slugify` a `app/utils/` y refactorizar `AddKidModal.tsx` para importarlos. Es el momento natural para DRY (segundo consumidor).
- **No:** Duplicar la paleta y los helpers en `VincularPadreModal.tsx`. Dos copias empezarían a divergir.
- **No:** Dejar `AddKidModal.tsx` como está y duplicar helpers. Mismo problema.
- **Sí:** Wrapper cliente `KidProfileBody` que mantiene el state de `linkedParents`. La página `/kids/[id]/page.tsx` queda como server component casi vacío.
- **No:** Convertir la página entera a cliente. Roto el lookup server-side y el `notFound()` limpio.
- **No:** Que `ParentsList` mismo tenga el state + modal. Acopla el listado al modal y dificulta reusar `ParentsList` sin el modal.
- **Sí:** `kidId` y `kidName` como props del modal aunque `kidId` no se use todavía. API forward-compatible; un futuro flujo de activación de cuenta lo consumirá.
- **No:** Pasar el `Kid` entero al modal. Acopla el modal a la estructura completa del niño.
- **Sí:** `kidName` en formato "Nombre Apellido" (`${kid.firstName} ${kid.lastName}`.trim()`). Coincide con el mock ("a Mateo Fernández").
- **No:** Concatenar manualmente en el call site. Más simple en el modal.
- **Sí:** Parentesco arranca sin selección (obligatorio). Coherente con "todos los campos son de carácter obligatorios".
- **No:** Default "Mamá". El mock lo muestra activo visualmente, pero el usuario pidió obligatoriedad explícita.
- **Sí:** Validación inline al enviar. Mismo patrón que `AddKidForm`.
- **No:** Botón "Enviar invitación" deshabilitado hasta completar. Pierde la guía del mensaje de error.
- **Sí:** `pickNextColor(existingParents, ...)` (solo los padres del niño actual). Es la opción natural dado que la lista ya viene como prop.
- **No:** Alimentar `pickNextColor` con todos los padres de todos los niños. Requeriría reestructurar `app/lib/kids.ts` para tener un catálogo global de `Parent`.
- **Sí:** El código se muestra en pantalla pero no se "envía" realmente. Es un mock; no hay backend.
- **No:** Llamar a un endpoint, mostrar toast de "Email enviado", etc. Fuera de alcance.
- **Sí:** Componentes como arrow functions, `'use client'`, `'use server'` solo donde hace falta. Sigue la convención del proyecto.
- **No:** Declarar wrappers como `function`. Rompe la convención.
- **Sí:** `triggerRef` para restaurar foco al cerrar el modal. Mismo patrón que SPEC 04.
- **No:** Confiar en `document.activeElement` sin fallback. Puede haber sido removido del DOM.
- **Sí:** `app/utils/random-code.ts` exporta `ALPHANUMERIC_CHARS` y `generateAlphanumericCode`. Exporta ambos para que la función sea testeable/observable.
- **No:** Dos archivos separados. No aporta nada y agrega fricción de navegación.
- **Sí:** Cambio de alcance respecto a SPEC 03: agregar validación de email con `isValidEmail` en `/auth` y `/auth/active`.
- **No:** Dejar las pantallas de auth con validación únicamente del browser. Inconsistente con el resto del proyecto y no reutiliza el helper.
- **Sí:** En `/auth`, extraer el formulario en `app/components/auth/AuthLoginForm.tsx` para poder validar en cliente sin perder el `searchParams` server-side.
- **No:** Convertir `app/auth/page.tsx` entero a client component. Perdería el `await searchParams` simple.
- **No:** Wrapper de "ClientForm" genérico para auth pages. Solo hay dos y sus validaciones son distintas; no vale la pena abstraer.
- **Sí:** En `/auth/active`, el botón "Activar mi cuenta" pasa de `<Link>` a `<button>` con `onClick` para poder validar antes de la navegación.
- **No:** Dejar el `<Link>` y agregar `onClick` que llama `event.preventDefault()` si inválido. Más complejo y propenso a bugs.

## Riesgos identificados

| Riesgo                                                               | Mitigación                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Refactor de `AddKidModal.tsx` rompe SPEC 04                          | Re-correr criterios 10–13 de SPEC 04 (especialmente color por menor uso y `id` con sufijo en colisión) tras el refactor del paso 5.                                                  |
| `Math.random` produce códigos no únicos si se generan muchos         | El sufijo `-${timestamp}` del id cubre la unicidad del id; la unicidad del código visible es irrelevante para el mock.                                                               |
| Email regex demasiado laxa o demasiado estricta                      | La regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` cubre los casos típicos y rechaza los obvios. No intenta cubrir RFC 5322.                                                                      |
| Pérdida del estado al recargar                                       | El nuevo padre vive solo en el state local del wrapper cliente; se documenta implícitamente en la UI. Queda como follow-up cuando exista backend.                                    |
| Modal con z-index/portal conflictos en `/kids/[id]`                  | Mismo patrón que `AddKidModal` (portal a `document.body`, `z-50`). Ya validado en SPEC 04.                                                                                           |
| El padre nuevo tiene un color que coincide con el del niño           | La paleta es compartida por diseño (niños y padres usan los mismos tonos); se acepta la coincidencia como parte del lenguaje visual.                                                 |
| Foco no se restaura al cerrar porque el botón desapareció            | `triggerRef` se mantiene estable en el DOM aunque el modal se monte/desmonte; `KidProfileBody` lo crea una sola vez con `useRef`.                                                    |
| Cambio de alcance en SPEC 03 (validación de email) rompe un criterio | Verificar que `/auth?email=...` sigue funcionando (criterio 9 de SPEC 03), que el checkbox de autorización sigue activo (criterio 8) y que el query param se mantiene.               |
| `AuthLoginForm` rompe el flujo del link submit del server            | El link "Iniciar sesión" pasa a estar dentro de `AuthLoginForm` (botón), no en la página. La página sigue siendo server component y el query param `defaultEmail` se pasa como prop. |

## Qué **no** está en este spec

- Persistencia entre recargas (no hay DB ni backend).
- Envío real del correo ni activación de cuenta.
- Expiración real del código a los 7 días.
- Edición ni eliminación de padres vinculados.
- Validación de duplicados por email o nombre del padre.
- Cambio en `app/lib/kids.ts` (la lista nueva vive solo en state del wrapper).
- Animaciones complejas de entrada/salida del modal.
- Internacionalización.
- Tests automatizados.
- Reordenamiento de los padres en la lista (siempre se agrega al final).
- Validación de la contraseña en `/auth` y `/auth/active` (solo se valida email).
- Validación del código de invitación en `/auth/active` (sigue mockeado).

## Resultados de verificación

**Fecha de verificación:** 2026-08-19

**Resumen:** 24/24 checks pasaron.

### Verificación técnica

- `npx tsc --noEmit`: ✅ sin errores.
- `pnpm lint`: ✅ sin errores.
- `pnpm build`: ✅ exit code 0, generó rutas estáticas y dinámicas correctamente.
- Servidor de desarrollo `pnpm dev` responde en `http://localhost:3000`.

### Verificación de utilidades

- `app/utils/email.ts`: regex y `isValidEmail` validan correctamente los casos del spec.
- `app/utils/random-code.ts`: `generateAlphanumericCode(5)` produce cadenas de 5 caracteres alfanuméricos; longitudes `<= 0` devuelven `''`.
- `app/utils/slugify.ts`: produce `diego-fernandez`, `maria-jose`, `lucia` para los casos indicados.
- `app/utils/avatar-colors.ts`: `pickNextColor([], () => '')` devuelve `#A9D9E8` (primer color de la paleta).

### Verificación visual y funcional con Playwright

- Ruta `/kids/mateo-fernandez`: el control "Vincular otro padre" es un `<button>` y abre el modal con título "Vincular padre", subtítulo "a Mateo Fernández" y botón X.
- El modal se monta en `document.body` vía portal, con `role="dialog"`, `aria-modal="true"`, `aria-labelledby="vincular-padre-title"`.
- Bloquea scroll (`body.style.overflow = 'hidden'`), cierra con `Escape`, click en backdrop y botón X; al cerrar, el foco retorna al botón "Vincular otro padre".
- Al abrir, el foco está en el input `#parent-name` con placeholder "Ej. Diego Fernández".
- Campo email con placeholder "correo@ejemplo.com" y validación inline.
- Parentesco: tres pills, sin selección inicial, solo uno activo, error "Este campo es obligatorio." al enviar sin seleccionar.
- Código de invitación: 5 caracteres alfanuméricos, visible con estilo Fredoka, no se regenera mientras está abierto, sí al reabrir; texto "Vence en 7 días" presente.
- Envío con datos válidos (`Juan Pérez`, `juan.perez@example.com`, `Papá`) cierra el modal y agrega al final de la lista con badge `PENDIENTE`, inicial `J` y color `#A9D9E8` (menor uso sobre `existingParents`).
- Recarga de página: el padre agregado desaparece (state local, sin persistencia en `app/lib/kids.ts`).
- Refactor de `AddKidModal`: agregar `Ana García` produce id `ana-garcia` y color de la paleta; agregar otra `Ana García` produce id con sufijo `-${timestamp}`.

### Verificación de auth

- `/auth`: email inválido muestra "Ingresá un email válido." y no navega; email válido navega a `/`; query param `?email=...` precarga el campo.
- `/auth/active`: email inválido muestra error y no navega; email `lucia.fernandez@gmail.com` navega a `/auth?email=lucia.fernandez%40gmail.com` y el campo se precarga.

### Notas

- No existe screenshot PNG de referencia para esta pantalla; la comparación visual se hizo contra `reference/pantallas/vincular-padre.dc.html`. La implementación coincide en estructura, tipografía, colores y disposición de elementos. La única diferencia intencional es que el spec define el grupo "Parentesco" sin selección inicial (el mock lo muestra con "Mamá" activo), lo cual es correcto según las decisiones del spec.
- Context7 confirma que `searchParams` como `Promise` y `await` es el patrón correcto en Next.js 16; `app/auth/page.tsx` lo implementa así.
- El patrón `useSyncExternalStore` para `useMounted` es una alternativa válida a `useState(null) + useEffect` para evitar problemas de hidratación en portales cliente.
