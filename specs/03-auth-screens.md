# SPEC 03 — Pantallas de autenticación `/auth` y `/auth/active`

> **Estado:** Implementado
> **Depende de:** SPEC 01 — Feed como home `/`
> **Fecha:** 2026-08-19
> **Objetivo:** Implementar las pantallas de login y activación de cuenta de OpenDayCare en `/auth` y `/auth/active` con un layout compartido de dos columnas (panel naranja fijo a la izquierda + contenido a la derecha), sin autenticación real ni base de datos.

## Alcance

**Incluye:**

- Crear `app/auth/layout.tsx` con panel naranja fijo a la izquierda (logo + claim + "🌿 Guardería Sala Soles") y área de contenido a la derecha con fondo crema, `min-h-screen` y centrado vertical.
- Crear `app/auth/page.tsx` (login) con título "Iniciar sesión", subtítulo "Ingresá para ver el día de hoy.", input email (vacío o prellenado desde query param, con placeholder de ejemplo), input password, link "¿Olvidaste tu contraseña?" (`href="#"`), botón "Iniciar sesión" (`href="/"`) y link "Activá tu cuenta" (`href="/auth/active"`). **Sin selector de rol.**
- Crear `app/auth/active/page.tsx` con icono de marca, título "Bienvenida a OpenDayCare", subtítulo, tarjeta de invitación estática (Mateo · Sala Soles), input código de invitación (`defaultValue="7K4P9"`), input email (`defaultValue="lucia.fernandez@gmail.com"`), input password, checkbox de autorización (visual, siempre marcado), botón "Activar mi cuenta" (`href={{ pathname: '/auth', query: { email: 'lucia.fernandez@gmail.com' } }}`) y link "Iniciar sesión" (`href="/auth"`).
- El campo email del login lee el query param `?email=...` vía `searchParams` de Next.js 16 (tipado `Promise<{ email?: string }>` y `await`) y lo usa como `defaultValue`; si no hay query param, queda vacío. El input siempre muestra un placeholder con un email de ejemplo.
- Agregar `CheckIcon` a `app/components/icons.tsx` para el checkbox de autorización.
- Responsive: en mobile (`< md`) el panel naranja se oculta y el contenido ocupa todo el ancho.

**Fuera de alcance:**

- Autenticación real (tokens, sesiones, OAuth, validación de credenciales).
- Base de datos o persistencia de cualquier tipo.
- Validación real de código de invitación, email o contraseña.
- El checkbox de autorización es solo visual; no persiste ni se valida.
- Selector de rol "Personal" / "Familia" (descartado por el usuario).
- Recuperación, cambio o cierre de sesión.
- Sidebar del feed en estas rutas (reemplazado por el panel naranja del layout de auth).

## Modelo de datos

Esta feature no introduce nuevas estructuras de datos. No hay estado, ni persistencia, ni catálogo mockeado. El único dato que cruza páginas es el email pasado como query param `?email=...` desde `/auth/active` hacia `/auth`, consumido vía `searchParams` de Next.js 16.

## Plan de implementación

1. Agregar `CheckIcon` a `app/components/icons.tsx` siguiendo la convención de los iconos existentes (componente arrow function con `className?: string`).
2. Crear `app/auth/layout.tsx` como `function` normal tipada con `LayoutProps<'/auth'>`, con `grid grid-cols-1 md:grid-cols-[1.05fr_1fr] min-h-screen bg-background`:
   - Columna izquierda: `hidden md:flex relative overflow-hidden flex-col justify-between p-14 text-white` con fondo `bg-gradient-to-br from-[#F6A98E] via-[#F2937A] to-[#EC7E62]`, dos círculos decorativos absolutos, bloque superior con logo (`LogoIcon` + texto "OpenDayCare" en Fredoka), bloque central con `h1` claim y subtítulo, y bloque inferior con "🌿 Guardería Sala Soles".
   - Columna derecha: `flex flex-1 items-center justify-center p-10`, donde se renderizan los `children` (las páginas de login o active).
3. Crear `app/auth/page.tsx` como `async function` normal con props `searchParams: Promise<{ email?: string }>`, hace `await` y renderiza (en un `max-w-[392px] w-full`):
   - `h2` "Iniciar sesión" en Fredoka.
   - Subtítulo "Ingresá para ver el día de hoy."
   - Label "EMAIL" + `<input type="email" name="email" defaultValue={email ?? ""} placeholder="ej. nombre@opendaycare.com" />`.
   - Label "CONTRASEÑA" + `<input type="password" name="password" />`.
   - `<Link href="#">¿Olvidaste tu contraseña?</Link>`.
   - `<Link href="/" className="...">Iniciar sesión</Link>` con el gradiente naranja del mock.
   - `<p>¿Te invitó la guardería? <Link href="/auth/active">Activá tu cuenta</Link></p>`.
4. Crear `app/auth/active/page.tsx` como `function` normal, con el contenido centrado en un `max-w-[440px] w-full`:
   - Cuadrado `bg-gradient-to-br from-[#F8C3A8] to-[#F2937A]` con `LogoIcon` blanco.
   - `h1` "Bienvenida a OpenDayCare" en Fredoka.
   - Subtítulo "Te invitaron a seguir el día de tu hijo. Creá tu contraseña para activar la cuenta."
   - Tarjeta de invitación con avatar "M" en `bg-avatar-blue` y textos.
   - Label "CÓDIGO DE INVITACIÓN" + input con `defaultValue="7K4P9"`, `tracking-widest`, `font-display`, `text-lg`, `font-bold`.
   - Label "EMAIL" + input con `defaultValue="lucia.fernandez@gmail.com"`.
   - Label "CREAR CONTRASEÑA" + input `type="password"` con `defaultValue="contraseña"`.
   - `<label>` con checkbox visual: cuadrado verde `bg-[#5FB97E]` con `CheckIcon` blanco, texto "Autorizo a la guardería a tomar y compartir fotos de mi hijo dentro de la app." en `bg-[#FBF1D6]`, `rounded-2xl`, `text-[#8A7234]`.
   - `<Link href={{ pathname: '/auth', query: { email: 'lucia.fernandez@gmail.com' } }} className="...">Activar mi cuenta</Link>` con el gradiente (URL object form para compatibilidad con typed routes).
   - `<p>¿Ya tenés cuenta? <Link href="/auth">Iniciar sesión</Link></p>`.
5. Verificar tipado (`npx tsc --noEmit`), lint (`pnpm lint`) y build (`pnpm build`).

## Criterios de aceptación

- [x] `pnpm dev` levanta sin errores.
- [x] `http://localhost:3000/auth` muestra la pantalla de login con el panel naranja a la izquierda.
- [x] `http://localhost:3000/auth/active` muestra la pantalla de activar cuenta con el panel naranja a la izquierda.
- [x] El panel naranja contiene el logo, el claim y "🌿 Guardería Sala Soles" en ambas rutas.
- [x] `/auth` **no** muestra los botones "Personal" / "Familia" del mock.
- [x] `/auth` tiene título "Iniciar sesión", inputs email (vacío por defecto, con placeholder de ejemplo) y password, link "¿Olvidaste tu contraseña?" (`#`), botón "Iniciar sesión" (`/`) y link "Activá tu cuenta" (`/auth/active`).
- [x] Navegar a `/auth?email=lucia.fernandez@gmail.com` muestra el input email prellenado con ese valor.
- [x] `/auth/active` tiene el icono de marca, título "Bienvenida a OpenDayCare", subtítulo, tarjeta de invitación (Mateo · Sala Soles), inputs código, email y contraseña prellenados, checkbox de autorización marcado, botón "Activar mi cuenta" y link "Iniciar sesión".
- [x] Al hacer click en "Activar mi cuenta" se navega a `/auth?email=lucia.fernandez@gmail.com` y el input email aparece prellenado.
- [x] El sidebar del feed (SPEC 01) no aparece en `/auth` ni en `/auth/active`.
- [x] En mobile (viewport < 768px) el panel naranja se oculta y el contenido ocupa todo el ancho sin perder la usabilidad del formulario.
- [x] `npx tsc --noEmit` no reporta errores.
- [x] `pnpm lint` no reporta errores.
- [x] `pnpm build` finaliza exitosamente.

## Decisiones tomadas y descartadas

- **Sí:** Layout dedicado `app/auth/layout.tsx` con panel naranja fijo a la izquierda. Reutiliza branding entre login y active y reduce duplicación.
- **No:** Layout mínimo donde cada página arma su propia estructura. Duplicaría el panel naranja.
- **Sí:** Panel naranja oculto en mobile (`hidden md:flex`). La marca ya está presente en el sidebar del feed; no se necesita redundancia en mobile.
- **No:** Panel naranja apilado encima del formulario en mobile. Consume espacio sin aportar información.
- **Sí:** Selector de rol omitido (sin botones "Personal" / "Familia"). Decidido por el usuario.
- **No:** Mantener el selector de rol del mock. El usuario lo descartó explícitamente.
- **Sí:** Email del login prellenado vía query param `?email=...` desde active. Refleja el flujo "cuenta recién creada, tipeá tu contraseña para entrar".
- **No:** Estado compartido (context, store). No hay estado real que mantener.
- **No:** Persistir la contraseña creada tras activar. Sin DB no tiene sentido.
- **Sí:** "Activar mi cuenta" navega a `/auth?email=...`. Devuelve al login para tipear la contraseña.
- **No:** Navegar directo a `/`. Perdería el paso de tipear la contraseña.
- **Sí:** "Iniciar sesión" navega a `/`. Coherente con la metáfora de "ya entraste al sistema".
- **No:** Botón sin acción. Confundiría al usuario.
- **Sí:** Checkbox de autorización visual, siempre marcado. Sin backend no se puede persistir.
- **No:** Checkbox interactivo con estado controlado. No aportaría valor sin persistencia.
- **Sí:** "¿Olvidaste tu contraseña?" como link a `#`. Visualmente clickeable, no hace nada.
- **No:** Texto estático. Pierde affordance visual.
- **Sí:** Email hardcodeado (`lucia.fernandez@gmail.com`) en `app/auth/active/page.tsx` para construir el link "Activar mi cuenta". El usuario no edita el email en este flujo.
- **No:** Client component con `useState` para sincronizar el link con el input. Más complejo sin valor agregado (el mock tiene el email fijo).
- **Sí:** Iconos en `app/components/icons.tsx`. Consistencia con SPEC 01 y 02. Solo se agrega `CheckIcon`; los iconos del sol/logo y demás ya existen.
- **No:** Inline SVGs en cada página. Dificulta reuso.
- **Sí:** Inputs con `defaultValue` (no controlados). Server-rendered, el usuario puede editarlos sin necesidad de estado ni handlers.
- **No:** Inputs controlados con `useState`. Sin submit handler, no aporta nada.
- **Sí:** `next/link` para navegación interna. Aprovecha client-side routing.
- **No:** `<a href>` nativo para `/` y `/auth/active`. Recarga la página completa.
- **Sí:** Link "Activar mi cuenta" con URL object form (`href={{ pathname, query }}`). Más legible y mejor compatibilidad con typed routes.
- **No:** Template literal `href={\`/auth?email=...\`}`. Funciona pero menos explícito.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `searchParams` en Next.js 15+ es `Promise` (no sync) | Tipar como `Promise<{ email?: string }>` y usar `await` en el server component. |
| Link con query string en Next.js 16 con typed routes | Usar URL object form para evitar casts y mantener la inferencia de tipos. |
| El panel naranja fijo en mobile puede ocupar mucho espacio | Ocultar el panel en `< md` y dejar que el contenido ocupe todo el ancho. |
| Doble fuente de marca (logo en sidebar del feed y panel naranja en /auth) | Aceptable: el sidebar no aparece en `/auth`, así que el panel naranja es la única presencia de marca en esas rutas. |
| `searchParams` opta la página a renderizado dinámico | Esperado y aceptable: la página depende del query param. |

## Qué **no** está en este spec

- Autenticación real ni gestión de sesiones.
- Base de datos ni persistencia.
- Validación de credenciales, código de invitación o email.
- Recuperación, cambio o cierre de sesión.
- Selector de rol "Personal" / "Familia" (descartado por el usuario).
- Persistencia de la autorización de fotos.
- Sincronización del email en `/auth/active` con el link "Activar mi cuenta" (es estático por ahora).

Cada uno de estos, si llega, irá en su propio spec.

## Resultados de verificación

**Fecha:** 2026-08-19

**Resumen:** 14/14 criterios pasaron.

| # | Criterio | Estado | Notas |
|---|----------|--------|-------|
| 1 | `pnpm dev` levanta sin errores | ✅ | Servidor responde 200 en `http://localhost:3000/auth`. |
| 2 | `/auth` muestra login con panel naranja | ✅ | Layout de dos columnas visible en desktop. |
| 3 | `/auth/active` muestra activación con panel naranja | ✅ | Panel compartido presente (decisión del spec). |
| 4 | Panel naranja contiene logo, claim y "🌿 Guardería Sala Soles" | ✅ | En ambas rutas. |
| 5 | `/auth` no muestra selector de rol | ✅ | No hay botones "Personal" / "Familia". |
| 6 | `/auth` tiene título, inputs, links y botón | ✅ | Email vacío por defecto con placeholder de ejemplo. |
| 7 | `/auth?email=...` prellena el email | ✅ | `lucia.fernandez@gmail.com` aparece en el input. |
| 8 | `/auth/active` tiene todos los elementos requeridos | ✅ | Icono, tarjeta Mateo · Sala Soles, inputs prellenados, checkbox marcado, botón y link. |
| 9 | Click en "Activar mi cuenta" navega a `/auth?email=...` | ✅ | Email prellenado tras la navegación. |
| 10 | Sidebar del feed no aparece en `/auth` ni `/auth/active` | ✅ | Solo se ve el panel naranja de auth. |
| 11 | Mobile oculta el panel naranja | ✅ | Viewport 375×667: formulario usa todo el ancho. |
| 12 | `npx tsc --noEmit` | ✅ | Sin errores. |
| 13 | `pnpm lint` | ✅ | Sin errores. |
| 14 | `pnpm build` | ✅ | Finaliza exitosamente (`next build`). |

**Notas adicionales:**
- No existen screenshots PNG de auth en `reference/screenshots/`; la comparación visual se hizo contra los mocks HTML `reference/pantallas/login.dc.html` y `reference/pantallas/activar-cuenta.dc.html`.
- La implementación sigue las decisiones del spec y omite intencionalmente el selector de rol del mock de login.
- El mock `activar-cuenta.dc.html` muestra la pantalla de activación centrada sin panel naranja, mientras que la implementación usa el layout compartido con panel a la izquierda según lo especificado en este documento.
