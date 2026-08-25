# SPEC 07 — Auth con email+password, server actions y protección de rutas

> **Estado:** Implementado
> **Depende de:** SPEC 01 (feed `/`), SPEC 03 (pantallas `/auth`), SPEC DB-02 (tabla `public.users` + trigger `handle_new_user`)
> **Fecha:** 2026-08-24
> **Objetivo:** Implementar autenticación real con email+password contra Supabase, centralizada en server actions en `app/actions/auth/`, y proteger todas las rutas excepto `/auth/*` mediante `proxy.ts` de Next.js 16 (renombre del antiguo `middleware.ts`, deprecado desde v16.0.0).

## Por qué este spec existe

Hoy las pantallas de `/auth` y `/auth/active` (SPEC 03) son mock: el submit de `AuthLoginForm` hace `router.push('/')` sin llamar a nada, y el Sidebar muestra valores hardcoded (`"Caro Giménez"`, `"Maestra · Soles"`, avatar `"C"`). La tabla `public.users` existe (SPEC DB-02) con su trigger `handle_new_user` y un usuario de prueba `pedro@gmail.com`, pero la app Next.js nunca la consulta para auth. Este spec cierra esa brecha: introduce los factories de Supabase SSR, los server actions de `signIn`/`signOut`, el proxy de protección de rutas (renombre Next.js 16 del antiguo `middleware.ts`), y el wiring del Sidebar para reflejar al usuario logueado.

## Alcance

**Incluye:**

- Clientes Supabase en `lib/supabase/`:
  - `client.ts` — arrow function `createSupabaseBrowserClient()` que envuelve `createBrowserClient<Database>` (usado en client components).
  - `server.ts` — arrow function `createSupabaseServerClient()` que envuelve `createServerClient<Database>` con `cookies()` de `next/headers` (usado en server components, server actions y route handlers).
  - `current-user.ts` — arrow function `getCurrentUser()` que combina `auth.getUser()` + un `select` a `public.users` con JOIN a `daycares` (`id, full_name, role, daycares(name)`) y devuelve `SidebarUser | null`. Define y exporta el tipo `SidebarUser`, `ROLE_LABEL` (`staff` → "Personal", `parent` → "Familia", `admin` → "Administración") y `AVATAR_PALETTE` (`avatar-coral`, `avatar-blue`, `avatar-indigo`).
- `database.types.ts` generado en la raíz del proyecto, commiteado. Tipo `Database` tipa ambos factories.
- Server actions en `app/actions/auth/`, una por archivo, todos con `'use server'` en la primera línea:
  - `sign-in.ts` — arrow function `signIn(prevState: SignInState, formData: FormData)` para usar con `useActionState`. Valida formato, llama `supabase.auth.signInWithPassword`, mapea errores de Supabase a mensajes en español con voseo (`'Email o contraseña incorrectos.'` para `Invalid login credentials`, etc.) y ejecuta `redirect('/')` en el happy path.
  - `sign-out.ts` — arrow function `signOut()` que llama `supabase.auth.signOut()` con el cliente server y ejecuta `redirect('/auth')`.
  - `index.ts` — re-exporta `signIn` y `signOut` como barrel.
- `proxy.ts` en la raíz del proyecto (renombre de `middleware.ts` desde Next.js 16.0.0) con el patrón Supabase middleware-first adaptado al export `proxy`: `createServerClient` con `cookies.getAll()` desde `request.cookies` y `cookies.setAll()` sobre `response.cookies`, llama `await supabase.auth.getClaims()` para refrescar la sesión antes de cualquier decisión de redirect, y aplica las reglas de routing (rutas públicas vs protegidas, redirect si hay sesión en rutas públicas, redirect a `/auth` si no hay sesión en rutas protegidas). Matcher excluye `_next/static`, `_next/image`, `favicon.ico`, `*.png`, `*.svg`, `*.ico`.
- Refactor de `app/components/auth/AuthLoginForm.tsx`: pasa de `useState` controlados a `useActionState(signInAction, { error: null })`. Los inputs se vuelven uncontrolled con `name="email"` y `name="password"`; el server action lee del `formData`. Sub-componente `<SubmitButton>` usa `useFormStatus()` para deshabilitar el botón y mostrar `"Ingresando..."` mientras la action corre.
- Refactor de `app/components/feed/Sidebar.tsx`: agrega prop opcional `currentUser?: SidebarUser | null`. Reemplaza los valores hardcoded (`"C"`, `"Caro Giménez"`, `"Maestra · Soles"`, `bg-avatar-coral`) por los del usuario real cuando la prop está presente; si es `null`/`undefined`, mantiene los valores actuales como fallback defensivo. El `<a href="#" onClick={preventDefault}>` del logout pasa a `<form action={signOutAction} className="contents">` envolviendo un `<button type="submit" aria-label="Cerrar sesión">` con las mismas clases que el `<a>` original.
- `FeedBody` y `MobileDrawer` aceptan y reenvían la prop `currentUser` al `Sidebar`.
- Header `"Buenas, {firstName}"` de `FeedBody` reemplaza el literal `"Caro"` por `currentUser?.fullName.split(/\s+/)[0] ?? 'amigo'` (con `trim()` previo).
- Páginas server (`app/page.tsx`, `app/kids/page.tsx`, `app/kids/[id]/page.tsx`, `app/kids/[id]/not-found.tsx`) hacen `await getCurrentUser()` y pasan la prop al `<FeedBody>`/`<Sidebar>` correspondiente.
- Defense in depth: `app/page.tsx`, `app/kids/page.tsx`, `app/kids/[id]/page.tsx` y los `page.tsx`/server components de `/auth` y `/auth/active` ejecutan `await supabase.auth.getUser()` al inicio y aplican `redirect()` según el resultado. Las páginas protegidas redirigen a `/auth`; las de auth redirigen a `/`.
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ya están en `.env` y `.env.template`. No se usa `SUPABASE_SERVICE_ROLE_KEY` en código commiteado.

**Fuera de alcance (siguientes specs):**

- Flujo de activación de cuenta (`/auth/active`) — la pantalla sigue siendo mock, sin DB detrás. Requiere tabla `invitations` (SPEC DB-03, no escrita). "Activar mi cuenta" sigue navegando a `/auth?email=...` como hasta ahora.
- Sign-up libre (crear cuenta sin invitación).
- Recuperación / cambio de contraseña ("¿Olvidaste tu contraseña?" sigue apuntando a `#`).
- Confirmación de email.
- Página `/mi-cuenta` y `/avisos` (siguen apuntando a `#` en el sidebar).
- Server actions de otros dominios (`app/actions/kid/`, `app/actions/father/`) — se crea solo la carpeta `app/actions/auth/` y se documenta la convención; el resto no se implementa acá.
- Multi-tenant scoping en policies de DB (sigue con SELECT abierto a `authenticated` como en SPEC DB-01/02; el aislamiento por guardería llega con specs de dominio).
- Realtime / Storage / Edge Functions / pg_cron / pgvector.
- Tests automatizados (no hay framework configurado).
- Soporte de `?next=/ruta` en el query string para redirect post-login (siempre va a `/`).
- Refresh token rotation en el cliente (se maneja implícitamente con el patrón middleware-first).
- Avatar color persistido en DB (se deriva por hash del nombre en este spec; si llega a DB va en otro).
- BroadcastChannel para sincronizar logout entre tabs.
- Pantalla intermedia "Sesión cerrada" o toast de confirmación.

## Modelo de datos

Esta feature no introduce tablas nuevas ni cambios a la DB. Reutiliza `auth.users` (gestionado por Supabase) y la fila espejo en `public.users` que crea el trigger `handle_new_user` (SPEC DB-02).

Tipos TypeScript a introducir:

```ts
// app/actions/auth/sign-in.ts
export type SignInState = {
  error: string | null;
};
```

```ts
// lib/supabase/current-user.ts
export type SidebarUser = {
  fullName: string;
  initial: string;
  roleLabel: string;
  daycareName: string;
  avatarColorClass: string;
};

export type UserRole = 'staff' | 'parent' | 'admin';

export const ROLE_LABEL: Record<UserRole, string> = {
  staff: 'Personal',
  parent: 'Familia',
  admin: 'Administración',
};

export const AVATAR_PALETTE = [
  'bg-avatar-coral',
  'bg-avatar-blue',
  'bg-avatar-indigo',
] as const;
```

```ts
// database.types.ts (generado, no se escribe a mano)
// Contiene el tipo `Database` con las tablas `daycares` y `public.users`
// (esta última con sus ENUMs `user_role` y `user_status`).
```

## Plan de implementación

1. Cargar la skill `supabase` antes de tocar el cliente (`AGENTS.md` lo exige).
2. Generar `database.types.ts` desde el proyecto Supabase `fshwfkppcetvqnrccllq`. Preferir el MCP `generate_typescript_types` sobre el CLI para evitar requerir v2.79.0+. Commitear en la raíz con un comentario al top indicando cuándo se regeneró.
3. Crear `lib/supabase/client.ts` con `createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)`. Exportar como arrow function `createSupabaseBrowserClient`. Validación runtime: si falta env, throw con mensaje claro.
4. Crear `lib/supabase/server.ts` con arrow function `async () => { const cookieStore = await cookies(); return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => cookieStore.getAll(), setAll: (cookies) => { try { cookies.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Component: ignorar */ } } } }); }`. Patrón canónico `@supabase/ssr` 0.12.x para App Router.
5. Crear `lib/supabase/current-user.ts` con:
   - `export const getCurrentUser = async (): Promise<SidebarUser | null>` que internamente: (a) `const supabase = await createSupabaseServerClient();` (b) `const { data: { user } } = await supabase.auth.getUser();` — si es `null`, devuelve `null`; (c) `const { data } = await supabase.from('users').select('full_name, role, daycares(name)').eq('id', user.id).single();` — si no hay fila o el JOIN falla, devuelve `null`; (d) calcula `initial` (`full_name.trim().charAt(0).toUpperCase() || '?'`); (e) calcula `avatarColorClass` con un hash determinista del `fullName` sobre `AVATAR_PALETTE` (suma de charCodes `% AVATAR_PALETTE.length`); (f) devuelve el objeto `SidebarUser`. Fallback de `daycareName` a `"Sala desconocida"` si el JOIN devuelve `null` por FK rota.
6. Crear `app/actions/auth/sign-in.ts` con `'use server'`:
   - Recibe `prevState: SignInState` y `formData: FormData` (firma de `useActionState`).
   - Valida email no vacío + `EMAIL_REGEX`; contraseña no vacía. Si falla, devuelve `{ error: 'Ingresá un email y una contraseña.' }`.
   - Crea cliente server vía `createSupabaseServerClient()`.
   - `await supabase.auth.signInWithPassword({ email, password })`. Si `error`, mapea el `error.code` a mensaje en español con voseo (`Invalid login credentials` → `'Email o contraseña incorrectos.'`; `over_email_send_rate_limit` → `'Demasiados intentos. Probá más tarde.'`; genérico → `'No pudimos iniciar sesión. Probá de nuevo.'`). Devuelve `{ error: mensaje }`.
   - Si OK, `redirect('/')` (importado de `next/navigation`).
7. Crear `app/actions/auth/sign-out.ts` con `'use server'`: `await supabase.auth.signOut()` con cliente server, luego `redirect('/auth')`.
8. Crear `app/actions/auth/index.ts` que re-exporta `signIn` y `signOut`.
9. Refactorizar `app/components/auth/AuthLoginForm.tsx`: quitar `useState` de email/password/error. Queda como client component que usa `useActionState(signInAction, { error: null })`. Los inputs pasan a uncontrolled con `name="email"` y `name="password"` (el server action lee del `formData`). Agregar un sub-componente `<SubmitButton>` que use `useFormStatus()` para mostrar `"Ingresando..."` y `disabled` mientras `pending`. Mantener la prop `defaultEmail` (sigue funcionando via `defaultValue`).
10. Crear `proxy.ts` en la raíz del proyecto (NO `middleware.ts`, deprecado desde Next.js 16.0.0). Función exportada: `export function proxy(request: NextRequest)` (o default export). Patrón Supabase middleware-first:
    - `createServerClient` con `getAll` desde `request.cookies` y `setAll` que escribe en `response.cookies`.
    - Llamar `await supabase.auth.getClaims()` para refrescar la sesión antes de cualquier decisión de redirect.
    - Si `pathname.startsWith('/auth')` (públicas) y `claims?.sub` existe → `NextResponse.redirect(new URL('/', request.url))`.
    - Si `pathname` no es pública y no hay `claims?.sub` → `NextResponse.redirect(new URL('/auth', request.url))`.
    - Si la ruta es pública y no hay sesión → dejar pasar.
    - Matcher: `['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)']`.
11. Editar `app/auth/page.tsx`: como server component, hacer `const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) redirect('/');` antes del return.
12. Editar `app/auth/active/page.tsx` con el mismo check.
13. Editar `app/page.tsx`: agregar el check de `getUser()` + `redirect('/auth')` al inicio. Defense in depth.
14. Editar `app/kids/page.tsx` con el mismo check.
15. Editar `app/kids/[id]/page.tsx` con el mismo check.
16. Editar `app/components/feed/Sidebar.tsx`:
    - Agregar al interface `SidebarProps` la prop opcional `currentUser?: SidebarUser | null`.
    - Reemplazar el bloque hardcoded (avatar con `"C"` en `bg-avatar-coral`, nombre `"Caro Giménez"`, sub `"Maestra · Soles"`) por `{currentUser?.initial ?? 'C'}`, `{currentUser?.fullName ?? 'Caro Giménez'}`, `{currentUser ? `${currentUser.roleLabel} · ${currentUser.daycareName}` : 'Maestra · Soles'}`. La clase del avatar pasa a `currentUser?.avatarColorClass ?? 'bg-avatar-coral'`.
    - El logout pasa a `<form action={signOutAction} className="contents">` envolviendo un `<button type="submit" aria-label="Cerrar sesión">` con las mismas clases que el `<a>` actual.
17. Editar `app/components/feed/FeedBody.tsx`: agregar `currentUser` a sus props (opcional), reenviar a `<Sidebar currentUser={currentUser} ... />` y a `<MobileDrawer currentUser={currentUser} ... />`. Reemplazar el literal `"Caro"` del `h1` por `currentUser?.fullName.trim().split(/\s+/)[0] ?? 'amigo'`.
18. Editar `app/components/feed/MobileDrawer.tsx`: agregar la prop opcional `currentUser` y reenviarla a `<Sidebar currentUser={currentUser} ... />`.
19. Editar `app/kids/page.tsx`, `app/kids/[id]/page.tsx` y `app/kids/[id]/not-found.tsx`: agregar `const currentUser = await getCurrentUser();` (después del check de `getUser()`) y pasar la prop al `<FeedBody>`/`<Sidebar>` correspondiente.
20. Verificar: `pnpm lint`, `npx tsc --noEmit`, `pnpm build` (control de regresión). `pnpm dev` y probar manualmente con `pedro@gmail.com` / `abcd1234#`.

## Flujos de redirección

### Login exitoso → `/`

1. Usuario en `/auth` tipea `pedro@gmail.com` + `abcd1234#` y presiona "Iniciar sesión".
2. `AuthLoginForm` dispara la server action `signIn(formData)` (vía `useActionState`).
3. Server action valida formato, llama `supabase.auth.signInWithPassword(...)`, recibe `data.session` y `data.user`.
4. Server action ejecuta `redirect('/')` (importado de `next/navigation`). Esto lanza una excepción especial `NEXT_REDIRECT` que Next.js intercepta; el control nunca vuelve al cliente.
5. El proxy ya refrescó la sesión en esta navegación (vía `getClaims()`), por lo que las cookies de sesión están en la response.
6. El cliente recibe la response con `Set-Cookie` de sesión + status 303 (redirect).
7. El browser sigue el redirect y carga `/`. El proxy ve sesión activa → deja pasar.
8. `app/page.tsx` re-verifica con `getUser()` → sesión válida → renderiza `FeedBody` con `currentUser` ya inyectado.

**Punto único de verdad del destino:** la server action (`redirect('/')`). El cliente no conoce el destino; solo dispara el form.

### Logout (botón junto al nombre en el Sidebar) → `/auth`

1. Usuario logueado en `/` ve su nombre "Pedro Tester" en el sidebar; a la derecha está el botón de logout (icono `LogoutIcon`).
2. Click → el `<form action={signOutAction}>` dispara la server action `signOut()`.
3. Server action llama `supabase.auth.signOut()` con el cliente server (que tiene las cookies de sesión).
4. Supabase limpia las cookies de sesión en la response (`setAll` con `maxAge: 0`).
5. Server action ejecuta `redirect('/auth')` (lanza `NEXT_REDIRECT`).
6. El browser sigue el redirect → carga `/auth`.
7. El proxy ve que NO hay sesión (cookies expiradas/limpiadas) y la ruta `/auth` es pública → deja pasar.
8. `app/auth/page.tsx` re-verifica con `getUser()` → no hay sesión → renderiza el formulario de login.

**Punto único de verdad del destino:** la server action (`redirect('/auth')`).

### Edge cases cubiertos por el flujo

| Escenario                                                         | Comportamiento                                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login OK pero `public.users` no existe (huérfano en `auth.users`) | `redirect('/')` ya ocurrió. En `/`, `getUser()` devuelve user pero `getCurrentUser()` devuelve `null` → sidebar muestra fallback mock. No se rompe. |
| Logout con error de red                                           | `signOut()` igual limpia cookies locales (no requiere round-trip). `redirect('/auth')` se ejecuta. Usuario ve la pantalla de login.                 |
| Login → el usuario presiona "atrás" en el browser                 | El proxy ve sesión activa en `/auth` → redirect a `/`. La pantalla de login nunca se ve.                                                            |
| Logout → el usuario presiona "atrás" en el browser                | El proxy NO ve sesión en `/` → redirect a `/auth`. El feed nunca se ve.                                                                             |
| Usuario abre dos tabs, hace logout en una, navega en la otra      | La otra tab mantiene su cookie vieja hasta el próximo request; el proxy la refresca y al no haber sesión la expulsa. UX estándar, aceptable.        |
| Refresh de la página durante `signIn` en curso                    | La página `/auth` se re-carga sin state de React (el form se resetea). El usuario tiene que tipear de nuevo. Aceptable; documentado.                |
| Doble-click en "Iniciar sesión"                                   | El segundo submit es bloqueado por `useFormStatus` (`disabled` + texto "Ingresando..."). No se disparan dos requests.                               |

## Criterios de aceptación

- [x] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/current-user.ts` con los factories y helper tipados con `Database`.
- [x] Existe `database.types.ts` en la raíz, generado, commiteado, con tablas `daycares` y `users` y ENUMs `user_role`/`user_status`.
- [x] Existen `app/actions/auth/sign-in.ts`, `sign-out.ts` e `index.ts`; `sign-in.ts` y `sign-out.ts` arrancan con `'use server'`; `index.ts` es barrel sin la directiva (corregido en commit 228a648 — los barrels de `'use server'` no llevan la directiva, solo los archivos de acción).
- [x] Existe `proxy.ts` en la raíz; `pnpm build` lo registra (verificable en output: `ƒ Proxy (Middleware)`). Next.js 16 ya no imprime "Compiled proxy in XXms" — la línea `ƒ Proxy (Middleware)` en la tabla de routes es el indicador oficial.
- [x] Navegar a `http://localhost:3000/` sin sesión redirige a `/auth` (`curl -I` → 307 location `/auth`).
- [x] Navegar a `http://localhost:3000/kids` sin sesión redirige a `/auth` (`curl -I` → 307 location `/auth`).
- [x] Navegar a `http://localhost:3000/auth` sin sesión muestra el formulario de login (`curl -I` → 200, screenshot adjunto).
- [x] Login con `pedro@gmail.com` / `abcd1234#` redirige a `/` y muestra el feed.
- [x] Login con email válido pero password incorrecto muestra "Email o contraseña incorrectos." sin redirigir (verificado en Playwright).
- [x] Login con email mal formado muestra el mensaje de validación client-side (HTML5 `type="email"` bloquea el submit; verificado en Playwright).
- [x] **Login → `/`:** `window.location.pathname === '/'` y el feed visible con "Pedro Tester" en el sidebar.
- [x] **Login → la barra de URL final muestra `/`, no query string.** `window.location.search === ''` después del login.
- [x] Tras login, el sidebar muestra "Cerrar sesión" como form (`<form action={signOut}>`); al hacer click se hace POST al server action, se invalida la sesión y se redirige a `/auth`.
- [x] **Logout → `/auth`:** `window.location.pathname === '/auth'` y el formulario de login visible.
- [x] **Logout → la barra de URL final muestra `/auth`, sin query string.** `window.location.search === ''` después del logout.
- [x] Tras logout, intentar ir a `/` redirige a `/auth` (proxy). El feed no se ve ni un instante.
- [x] Navegar a `/auth` estando logueado redirige a `/` (proxy).
- [x] El matcher del proxy excluye `/_next/static`, `/_next/image`, `/favicon.ico`, `*.png`, `*.svg`, `*.ico` (`/favicon.ico` retorna 200 sin pasar por proxy; el matcher está en `proxy.ts:8-12`).
- [x] **Tras login como `pedro@gmail.com`** (`public.users.full_name = 'Pedro Tester'`, `role = 'staff'`, `daycare_id` → `Sala Soles`), el sidebar muestra **"Pedro Tester"**, el sub dice **"Personal · Sala Soles"** y el avatar es la letra **"P"** (no "C" ni "Caro Giménez"). Verificado en screenshot adjunto.
- [x] El color del avatar es determinista: dos logins consecutivos del mismo usuario muestran el mismo color (`bg-avatar-indigo` en ambos casos; hash del `fullName`).
- [x] El header del feed muestra **"Buenas, Pedro"** (no "Buenas, Caro"). Verificado en screenshot adjunto.
- [x] Si `getCurrentUser()` devuelve `null` (caso defensivo), el sidebar no rompe: muestra el fallback mock (verificable en `Sidebar.tsx:60-65` y warnings en consola cuando `currentUser === undefined`).
- [x] En `app/kids/[id]/page.tsx` y `app/kids/[id]/not-found.tsx` el Sidebar también refleja el usuario actual (verificado: `/kids/<uuid-inexistente>` muestra el sidebar con "P" y "Pedro Tester" con 404).
- [x] `useActionState` muestra el error en `<p className="text-[12.5px] text-[#D9583C]">` sin recargar la página (verificado: error "Email o contraseña incorrectos." aparece sin navegación).
- [x] `useFormStatus` deshabilita el botón "Iniciar sesión" y muestra "Ingresando..." mientras la action corre (verificable en `AuthLoginForm.tsx:11-23`).
- [x] Network panel muestra un único round-trip al endpoint del server action por submit (un `POST /auth` por submit exitoso).
- [x] El cookie de sesión de Supabase (`sb-fshwfkppcetvqnrccllq-auth-token`) está presente en `document.cookie` después del login (verificado vía Playwright `document.cookie`). Next.js 16 lo aplica via `setAll` en `proxy.ts:39-49`; el browser DevTools lo muestra en Application → Cookies.
- [x] `npx tsc --noEmit` no reporta errores.
- [x] `pnpm lint` no reporta errores.
- [x] `pnpm build` finaliza exitosamente (`✓ Compiled successfully`, `ƒ Proxy (Middleware)` en routes).

## Resumen de la verificación (2026-08-25)

**Resultado: ✅ SPEC 07 IMPLEMENTADA Y VERIFICADA.**

### Comprobaciones técnicas (todas verdes)
- `pnpm lint` → 0 errores
- `npx tsc --noEmit` → 0 errores
- `pnpm build` → éxito; tabla de routes incluye `ƒ Proxy (Middleware)`

### Flujos verificados manualmente con Playwright + curl
1. **Sin sesión:** `/` y `/kids` redirigen 307 a `/auth`; `/auth` muestra el formulario (200).
2. **Validación client-side:** email mal formado (`not-an-email`) bloquea el submit vía HTML5 `type="email"`.
3. **Password incorrecto:** muestra "Email o contraseña incorrectos." sin redirigir, sin recargar la página.
4. **Login exitoso:** un solo `POST /auth`; `pathname === '/'`, `search === ''`; cookie `sb-fshwfkppcetvqnrccllq-auth-token` presente.
5. **Sidebar post-login:** avatar `P` con clase `bg-avatar-indigo`, nombre "Pedro Tester", sub "Personal · Sala Soles" (no "Caro Giménez" / "C").
6. **Header post-login:** "Buenas, Pedro" (no "Buenas, Caro").
7. **Determinismo de color:** dos logins consecutivos producen la misma clase `bg-avatar-indigo`.
8. **Logout:** click en "Cerrar sesión" → `pathname === '/auth'`, `search === ''`, cookie eliminada.
9. **Protección post-logout:** navegar a `/` redirige a `/auth`; navegar a `/auth` logueado redirige a `/`.
10. **Kids pages:** `/kids` y `/kids/<id-inexistente>` (404) reflejan el `currentUser` en el sidebar.
11. **Matcher del proxy:** `/favicon.ico` retorna 200 sin pasar por el proxy.

### Archivos creados/modificados (commit history)
- `228a648` — quito `'use server'` de `index.ts` (barrel)
- `c948062` — integro `currentUser` en KidsBody, KidNotFoundPage, KidProfilePage
- `95d6878` — paso `currentUser` a FeedBody para saludo personalizado
- `a586891` — agrego `currentUser` a MobileDrawer
- `e671dc3` — Sidebar con datos de usuario y sign-out como form
- `7e4c246` — auth check + redirect en KidProfilePage
- `cc0685f` — KidsPage con auth check y KidsBody separado
- `1f5708a` — auth check + redirect en HomePage
- `13cf4f5` — auth check + redirect en AuthPage
- (y 11 commits anteriores para los factories, server actions, proxy y database.types.ts)

### Notas
- El dev log de Next.js tiene errores históricos (`Export signIn doesn't exist in target module` a 01:39:20) que ya fueron resueltos al comit `228a648` (quitar `'use server'` del barrel). El estado actual compila y el login funciona.
- El "Compiled proxy in XXms" del spec no existe como mensaje literal en Next.js 16 — la confirmación está en `pnpm build` → tabla de routes (`ƒ Proxy (Middleware)`).

## Decisiones tomadas y descartadas

- **Sí: `@supabase/ssr` (no `auth-helpers-nextjs`).** Paquete oficial actual de Supabase para App Router. `auth-helpers-nextjs` está deprecado; `package.json` ya lo tiene en `0.12.4` (correcto).
- **Sí: `createServerClient` con `cookies()` de `next/headers` para server components y actions, NO con `request.cookies` (eso es solo en el proxy).** Patrón canónico `@supabase/ssr`; cada contexto usa su flavor de cookies.
- **Sí: patrón middleware-first de Supabase, implementado vía `proxy.ts` de Next.js 16.** Documentado por Supabase como la única forma confiable de mantener sesión en App Router. Si no, dos tabs paralelos pelean por el refresh token y una siempre pierde. El concepto ("refresh session early, then check") es de Supabase; el archivo donde vive es `proxy.ts` (Next.js 16) — antes era `middleware.ts`.
- **Sí: `getClaims()` en el proxy, `getUser()` en server components y actions.** `getClaims()` es local (decodifica el JWT, no hace fetch) y por eso es seguro en cada request del proxy. `getUser()` hace round-trip a Auth y es la fuente de verdad para decisiones de autorización. `getSession()` se descarta porque confía en el JWT sin revalidar (riesgo de token revocado).
- **Sí: `app/actions/<domain>/<action>.ts` con `'use server'` por archivo.** Convención del repo (un folder por dominio, un archivo por acción). `app/actions/auth/` es la primera concreción; el patrón se replica para `kid/`, `father/` en specs futuros.
- **Sí: `useActionState` (React 19) en `AuthLoginForm`.** Hook estándar para conectar un form a una server action con estado de error. Voseo en mensajes de error para consistencia con el resto de la UI.
- **Sí: `useFormStatus` para loading.** Complementa `useActionState` para el estado del submit button. Sin loading, doble-clicks lanzan dos logins.
- **Sí: `database.types.ts` commiteado y generado desde el proyecto linked.** Permite tipado fuerte en los factories (`createBrowserClient<Database>`). Regenerable vía `generate_typescript_types` (MCP) o `supabase gen types typescript --linked --schema=public` (CLI).
- **Sí: defense in depth — proxy + `getUser()` en cada server component protegida.** Docs de Next.js lo exigen explícitamente para server actions y server functions: _"A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."_ El proxy puede fallar (config rota, matcher mal escrito); el server component es la última línea.
- **Sí: redirect a `/` después de login y a `/auth` después de logout.** Sin `?next=` por ahora: el único destino post-login es el feed. Cuando haya más rutas, se agrega el query param.
- **Sí: `/auth` y `/auth/active` son las únicas rutas públicas hoy.** Default-deny: cualquier ruta nueva queda protegida automáticamente.
- **Sí: destinos hardcoded como strings literales** (`'/'` y `'/auth'`) en las server actions. No hay `?next=` en este spec. Si en el futuro hay que soportar deep-linking post-login, se agrega el query param con validación de path permitido.
- **Sí: `redirect()` desde `next/navigation` en server actions, no `router.push()` en el cliente.** Razones: (a) funciona sin JavaScript del lado cliente; (b) el destino se evalúa en el server (no se puede manipular desde el browser); (c) Next.js optimiza el redirect para SSR (un único round-trip).
- **Sí: prop-passing desde server component a client component, sin React Context.** Patrón estándar de Next.js App Router. El Sidebar es el único consumidor; agregar Context sería over-engineering.
- **Sí: `getCurrentUser()` devuelve `null` cuando no hay sesión o no hay fila en `public.users`.** Las páginas están protegidas por `getUser()` antes, así que en flujo normal nunca llega `null` — el `null` es solo defensa en profundidad. El fallback del Sidebar evita crash.
- **Sí: SELECT con JOIN a `daycares` en una sola query** (`select('full_name, role, daycares(name)')`). Evita round-trip extra.
- **Sí: "Personal" como etiqueta para `staff`.** Gender-neutral; reemplaza "Maestra" del mock. `parent` → "Familia", `admin` → "Administración".
- **Sí: color de avatar derivado del nombre vía hash sobre la paleta de 3 colores existentes.** Sin cambios a la DB. Mismo usuario → mismo color siempre. Cuando se agregue `avatar_color` a `public.users` (otro spec), se reemplaza este cálculo.
- **Sí: `FeedBody` y `MobileDrawer` aceptan `currentUser` como prop opcional**, no obligatoria. Mantiene compatibilidad con usos donde aún no se inyecta.
- **Sí: header `"Buenas, {firstName}"` usa el primer token del `fullName`** con fallback `"amigo"`. `trim()` + `split(/\s+/)[0]` para tolerar espacios y nombres compuestos.
- **No: service_role en el cliente.** `service_role` bypasea RLS y solo se usa en scripts de admin. La app usa `publishable_key` (env var sin prefijo `SECRET`, segura para el browser).
- **No: `getSession()` para decisiones de auth.** Confía en el JWT sin revalidar contra Auth. Patrón inseguro.
- **No: validación de email en server action más allá de "no vacío + regex".** La regex actual es laxa (`[^\s@]+@[^\s@]+\.[^\s@]+`); sirve para feedback UI. La validación de verdad la hace Supabase Auth al recibir el login.
- **No: optimistic UI ni skeleton en la carga de `/`.** La página ya tiene el `FeedBody` que se hidrata rápido. Sumar skeletons ahora es scope creep.
- **No: rate limiting client-side.** Supabase Auth ya rate-limitea por IP; el mensaje de error sale del mapeo del server action.
- **No: cerrar otras tabs al hacer logout.** Comportamiento default del browser con cookies SameSite=Lax; suficiente.
- **No: realtime subscription a `auth.stateChange` en el cliente.** El proxy refresca la sesión en cada navegación. Para logout desde otra tab, se documenta como follow-up.
- **No: tests automatizados.** El proyecto no tiene framework configurado. La verificación es manual + `pnpm build` + `pnpm lint` + `npx tsc --noEmit`.
- **No: avatar_url ni perfil en este spec.** Queda para `/mi-cuenta`.
- **No: agregar índice en `users.email`.** El email vive en `auth.users.email` (UNIQUE ahí). `auth.uid()` es la PK, no el email.
- **No: Context global de "current user".** Un solo consumidor, prop drilling es aceptable.
- **No: pasar el objeto entero de `auth.getUser()` al cliente.** El cliente solo necesita datos de display; el id de auth no debería filtrarse al bundle del browser.
- **No: guardar color de avatar en la DB.** Cambia el schema; va en su propio spec si llega.
- **No: full SSR `FeedBody`** (server component). Tiene estado client (`useState`, `useRef`, `useMemo`) y mantiene su `'use client'`.
- **No: pantalla intermedia "Sesión cerrada" o toast de confirmación.** UX más limpia con destino directo.
- **No: query string `?signedOut=1` en la URL de `/auth` post-logout.** Sin estado para mostrar; sumaría ruido en la barra de URL.
- **No: redirect diferido con `useTransition` o `setTimeout`.** Server action + `redirect()` es atómico.
- **No: BroadcastChannel para sincronizar logout entre tabs.** UX estándar aceptable; suma complejidad.

## Riesgos identificados

| Riesgo                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Concurrencia con refresh tokens (dos tabs con sesión expirada)                                                                                                              | Patrón middleware-first refresca en cada navegación. La segunda tab puede recibir `session: null` momentáneamente hasta que la primera propague la cookie. Documentado en README de `@supabase/ssr`; aceptable.                |
| `getUser()` en server component hace round-trip a Auth en cada request                                                                                                      | Aceptable: las páginas protegidas se renderizan del lado server una vez por navegación. Si se vuelve un cuello de botella, cacheamos con `unstable_cache` por `(user_id, updated_at)`.                                         |
| `database.types.ts` se desactualiza cuando cambia la DB                                                                                                                     | Documentar en el header del archivo que se regenera con `generate_typescript_types` (MCP) o `supabase gen types typescript --linked --schema=public` (CLI). Check manual post-migración.                                       |
| `getClaims()` decodifica JWT sin validar firma                                                                                                                              | Solo se usa para decidir "hay sesión" en el proxy. La validación real (firma, expiración, revocación) ocurre en `getUser()` que sí pega contra Auth. Aceptado por Supabase como patrón recomendado.                            |
| `'use server'` mal colocado (al final del archivo en vez del top)                                                                                                           | Convención: `app/actions/auth/*.ts` empieza con `'use server';` en la línea 1, sin imports antes. Verificable con `head -1 app/actions/auth/*.ts`.                                                                             |
| Confundir `proxy.ts` con `middleware.ts` (este último deprecado)                                                                                                            | Convención clara: solo `proxy.ts` en la raíz. El codemod oficial `npx @next/codemod@canary middleware-to-proxy .` puede ayudar si se arrastra código legacy; este spec parte de cero así que no aplica, queda como referencia. |
| El matcher del proxy podría olvidarse de un asset y romper el dev server                                                                                                    | Test: `curl -I http://localhost:3000/favicon.ico` no debe disparar logs del proxy.                                                                                                                                             |
| `service_role` filtrado por error en un commit                                                                                                                              | `lib/supabase/server.ts` solo importa `publishable_key` (sin prefijo `SECRET`). `.env` está en `.gitignore`. `SUPABASE_SERVICE_ROLE_KEY` solo se usa en scripts de `/tmp/opencode/`, nunca en código commiteado.               |
| El form de `AuthLoginForm` se rompe si la server action devuelve un error y el componente se rehidrata                                                                      | `useActionState` rehidrata con el último `state`; el `prevState` por default es `{ error: null }`. El error persiste hasta el próximo submit.                                                                                  |
| El usuario de prueba `pedro@gmail.com` puede cambiar de password y romper la verificación                                                                                   | La verificación de aceptación es manual al final del flujo; si cambia, se regenera y se documenta.                                                                                                                             |
| El sidebar logout como `<form>` rompe el layout del item (era un `<a>` con clases de tamaño)                                                                                | Mantener `className` idéntica al `<a>` original y envolver en `<form className="contents">` para que no genere caja.                                                                                                           |
| `getCurrentUser()` agrega un round-trip a Postgres por cada navegación a `/`, `/kids`, `/kids/[id]`                                                                         | Mitigar con la query única (JOIN) y un `revalidate` cache por `(user_id, public_users.updated_at)` si se vuelve cuello de botella. Para MVP es 1 query por navegación; aceptable.                                              |
| `FeedBody` es client component con `'use client'` y requiere reenviar la prop — si se olvida en una llamada futura, el Sidebar ve `undefined` y cae al mock silenciosamente | TypeScript con `currentUser?: SidebarUser \| null` lo permite por diseño (fallback intencional). Agregar un `console.warn` en dev cuando la prop es `undefined` para detectar regresiones.                                     |
| El header `"Buenas, {firstName}"` se rompe si el `full_name` es `" Pedro Tester "` (espacios)                                                                               | `.trim().split(/\s+/)[0]` para tomar el primer token robusto.                                                                                                                                                                  |
| Si `full_name` viene con caracteres multibyte o emojis en el primer caracter, `charAt(0)` se comporta correctamente pero el render puede tener width inesperado             | Usar `font-display` que ya tiene Fredoka; tamaño `text-base`; aceptable visualmente.                                                                                                                                           |
| `daycares(name)` puede ser `null` si la FK está rota (caso patológico)                                                                                                      | Si el JOIN devuelve `null`, mostrar `"Sala desconocida"` como fallback en lugar de crashear.                                                                                                                                   |
| El proxy no refresca la sesión entre la response del `signIn` y la navegación a `/`, y el `getUser()` en `app/page.tsx` ve `null` → redirect a `/auth` (bucle)              | Verificar que `getClaims()` se llama en el proxy **antes** de cualquier check, y que `setAll` escribe en `response.cookies`. Test: tras login, DevTools debe mostrar `Set-Cookie` con los tokens.                              |
| El usuario abre `/auth` en una pestaña y `/` en otra, hace logout en la primera; la segunda sigue mostrando el feed hasta que refresca                                      | UX aceptable. Solución futura: `BroadcastChannel` — fuera de alcance.                                                                                                                                                          |
| Si el server action `signIn` falla después de `signInWithPassword` pero antes del `redirect` (p.ej. excepción), el usuario queda logueado pero sin redirect                 | Try/catch que mapea a error retornado por `useActionState`. El `redirect()` solo se ejecuta en el happy path.                                                                                                                  |
| El `redirect('/auth')` post-logout entra en bucle si el proxy considera `/auth` como protegida por error                                                                    | Documentar y verificar: `/auth` y `/auth/active` deben estar en la lista de públicas. Cubierto por el paso 10 del plan (listas explícitas).                                                                                    |

## Qué **no** está en este spec

- Activación de cuenta vía invitación (`/auth/active`) — mock, sin DB. SPEC dedicado cuando exista la tabla `invitations`.
- Sign-up libre.
- Recuperación / cambio / confirmación de email.
- Acciones para `kid/`, `father/` u otros dominios (se crea solo la carpeta `app/actions/auth/`).
- Multi-tenant scoping en policies de DB.
- Realtime / Storage / Edge Functions / pg_cron / pgvector.
- Migraciones SQL (este spec no toca la DB).
- Tests automatizados.
- Página `/mi-cuenta` y `/avisos`.
- Soporte de `?next=/ruta` en redirect post-login.
- Refresh manual de sesión en el cliente.
- Logout desde otras tabs (cross-tab broadcast).
- Avatar color persistido en DB.
- Pantalla intermedia "Sesión cerrada" o toast post-logout.

Cada uno de esos, si llega, irá en su propio spec.

## Contexto técnico consultado

- Context7 `/supabase/ssr` (2026): confirma el patrón middleware-first con `getClaims()` para refresh, `createServerClient` con callbacks `getAll`/`setAll`, y el uso de `getUser()` (no `getSession()`) para decisiones de autorización.
- Context7 `/vercel/next.js` (Next.js 16 canary docs): confirma el patrón de protección de rutas con proxy + re-verificación en server actions, y el uso de `useActionState` + `useFormStatus` para forms conectados a server actions.
- `nextjs.org/docs/app/api-reference/file-conventions/proxy` (Next.js 16.3.2, 2026-08-04): confirma que `middleware.ts` está **deprecado desde v16.0.0** y renombrado a `proxy.ts`. El export cambia de `middleware` a `proxy` (o default export). El matcher y las APIs (`NextRequest`, `NextResponse`, `NextFetchEvent`, `NextProxy`) se mantienen. Proxy defaults a Node.js runtime (no Edge) — favorable para `@supabase/ssr` que no requiere Edge. Codemod oficial: `npx @next/codemod@canary middleware-to-proxy .`.
- `AGENTS.md` del repo: prescribe `@supabase/ssr` (no `auth-helpers-nextjs`), publishable keys para el cliente, server actions con lógica de negocio. El bloque `BEGIN:nextjs-agent-rules` recuerda que esta versión de Next.js tiene breaking changes — el rename `middleware` → `proxy` es uno de ellos.
- `SPEC DB-02` (implementado): provee la tabla `public.users`, el trigger `handle_new_user` y el usuario de prueba `pedro@gmail.com` que se usa para verificar login.
