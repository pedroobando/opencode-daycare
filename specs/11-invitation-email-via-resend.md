# SPEC 11 — Email de invitación vía Resend + pre-fill del código en `/auth/active`

> **Estado:** Aprobado
> **Depende de:** DB-06 (columnas `sent_at` + `last_send_error`), SPEC 10 (`createInvitation`, `activateInvitation`, `acceptInvitationByCode`, `LinkParentModal`)
> **Fecha:** 2026-08-26
> **Objetivo:** Enviar el email de invitación al padre vía Resend.com cuando `createInvitation` inserta una fila en `public.invitations`, con plantilla React Email que incluye el código y un link a `/auth/active?code=XXX`; hacer rollback del INSERT si el envío falla; pre-rellenar el input del código en `/auth/active` cuando el padre llega por el link del email.

## Por qué este spec existe

SPEC 10 ya persiste invitaciones en DB y deja a `createInvitation` con un único efecto: `{ error: null }` cuando el INSERT sale bien. El mock inicial asumía que el email se enviaba (SPEC 05 hablaba de "le enviaremos un correo con un código"), pero nunca se integró un servicio de email. Este spec cierra ese gap: sin envío real, las invitaciones quedan en DB y el staff tiene que comunicar el código por otro canal. Con Resend, el email sale automáticamente con un CTA hacia `/auth/active?code=XXX`, y la pantalla de activación pre-rellena el código.

Decisiones cerradas con el usuario:

- **Rollback del INSERT si Resend falla**: evita invitaciones "fantasma" en DB.
- **React Email como librería de plantillas**: tipado, previsualizable en dev, estándar con Resend.
- **Pre-fill del código en `/auth/active` desde query string**: cierra el loop del email.
- **Columnas `sent_at` + `last_send_error` en `invitations`**: auditoría (DB-06).

## Alcance

**Incluye:**

- Instalar `resend` y `@react-email/components` (deps runtime, pinned).
- `lib/email/resend.ts` (server-only): factory `getResendClient()` que devuelve un cliente `Resend` real si `RESEND_API_KEY` está configurada, o un cliente mock que renderiza el HTML a `/tmp/opencode/last-invitation-email.html` y devuelve `{ data: { id: 'mock-{timestamp}' }, error: null }`. Permite dev sin API key real.
- `lib/email/types.ts`: `InvitationEmailProps { parentName, childName, daycareName, code, activationUrl, expiresAt }`.
- `lib/email/templates/InvitationEmail.tsx` (componente React Email): cabecera con nombre de la guardería, saludo con `parentName`, párrafo explicando que fue invitado a seguir a `childName`, bloque destacado con el código (tipografía mono, 3xl), botón CTA "Activar mi cuenta" con `href={activationUrl}`, línea "Este código vence el {expiresAt}". Estilo alineado al resto de la app (Fredoka / Nunito, paleta `#F8C3A8`/`#F2937A`).
- Modificar `app/actions/invitations/create-invitation.ts`:
  - Extender la query inicial del child para incluir `daycares!inner(name)`.
  - Construir `activationUrl = \`${NEXT_PUBLIC_APP_URL}/auth/active?code=${code}\``.
  - Renderizar `InvitationEmail` con `@react-email/render` → HTML string.
  - Llamar `getResendClient().emails.send({ from: \`${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>\`, to: email, subject: "Te invitaron a OpenDayCare", react: <InvitationEmail ... /> })`.
  - Si `error` → `DELETE FROM invitations WHERE id = $insertedId`, `revalidatePath('/kids/[id]', 'page')`, devolver `{ error: 'No pudimos enviar la invitación. Probá de nuevo.' }`.
  - Si `data` → `UPDATE invitations SET sent_at = now() WHERE id = $insertedId`. Si el UPDATE falla, `console.warn` y seguir.
  - Devolver `{ error: null }`.
- Modificar `app/auth/active/AuthActiveBody.tsx`:
  - `import { useSearchParams } from 'next/navigation';`
  - `const searchParams = useSearchParams();`
  - Inicializar `useState<string>(searchParams?.get('code')?.toUpperCase() ?? '')`.
  - El input del código usa ese valor inicial; el `onChange` actual sigue aplicando `.toUpperCase()`.
- Posible Suspense boundary en `app/auth/active/page.tsx` si Next 16 lo exige para `useSearchParams` en client components (probable).
- Actualizar `.env.template`:
  - `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx`
  - `RESEND_FROM_EMAIL=noreply@opendaycare.com`
  - `RESEND_FROM_NAME=OpenDayCare`
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Mensajes de error en español con voseo, consistentes con SPEC 08/10.
- Verificación funcional end-to-end con `RESEND_API_KEY=mock`.

**Fuera de alcance:**

- Reenvío de invitaciones canceladas o fallidas (futuro spec; ahora posible gracias a `sent_at` / `last_send_error`).
- UI para listar invitaciones existentes en `/kids/[id]` (futuro spec).
- Templates en otros idiomas (español only).
- Personalización del sender por daycare (todos usan el mismo `RESEND_FROM_EMAIL`).
- Retry automático con backoff ante 429/5xx de Resend.
- Unsubscribe headers.
- Webhooks de Resend para tracking de delivery, bounce, spam complaints.
- Hash del activation URL para no exponer el código en logs.
- Tests automatizados (no hay framework configurado).
- Preview visual de la plantilla con `react-email/dev/preview` (opcional; no exigido).

## Modelo de datos

Este spec no introduce tablas. Extiende `public.invitations` con `sent_at` + `last_send_error` en DB-06.

Tipos TS a introducir:

```ts
// lib/email/types.ts
export interface InvitationEmailProps {
  parentName: string;
  childName: string;
  daycareName: string;
  code: string;
  activationUrl: string;
  expiresAt: string; // 'YYYY-MM-DD' localizada en español
}
```

```ts
// lib/email/resend.ts (server-only, factory)
import 'server-only';
import type { ReactElement } from 'react';

export type ResendSendResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { message: string } };

export interface ResendClient {
  emails: {
    send: (args: {
      from: string;
      to: string;
      subject: string;
      react: ReactElement;
    }) => Promise<ResendSendResult>;
  };
}

export const getResendClient = (): ResendClient => {
  /* ... */
};
```

Env vars:

| Var                   | Scope       | Default si falta        | Notas                                                                                                    |
| --------------------- | ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`      | server-only | (mock client)           | Si falta o es `'mock'`, el cliente escribe a `/tmp/opencode/last-invitation-email.html`.                 |
| `RESEND_FROM_EMAIL`   | server-only | `onboarding@resend.dev` | Sandbox de Resend; solo entrega al dueño de la cuenta. Para prod, dominio verificado.                    |
| `RESEND_FROM_NAME`    | server-only | `OpenDayCare`           | Nombre visible del remitente.                                                                            |
| `NEXT_PUBLIC_APP_URL` | público     | error en runtime        | Base URL para construir `activationUrl`. Default dev: `http://localhost:3000`. Validar en server action. |

## Plan de implementación

1. Cargar skills `context7-mcp` (API actual de `resend` SDK y `@react-email/components`) y `supabase` (regenerar types).
2. **Aplicar DB-06 primero**. Pasos de DB-06 §Plan: ALTER TABLE, verificar `\d`, regenerar `database.types.ts`, `get_advisors`, commitear migración.
3. Instalar deps: `pnpm add resend @react-email/components`. Pin exact versions. No tocar `react`/`react-dom` (ya están).
4. Crear `lib/email/resend.ts` (server-only):
   - Si `process.env.RESEND_API_KEY` es `'mock'` o falta → mock client.
   - Mock client: renderiza el React element con `@react-email/render`, escribe a `/tmp/opencode/last-invitation-email.html`, devuelve `{ data: { id: 'mock-{timestamp}' }, error: null }`.
   - Real client: `import { Resend } from 'resend'; new Resend(apiKey)`. Confirmar API actual con Context7 antes.
5. Crear `lib/email/types.ts` con `InvitationEmailProps`.
6. Crear `lib/email/templates/InvitationEmail.tsx` con React Email components (`<Html>`, `<Head>`, `<Body>`, `<Container>`, `<Heading>`, `<Text>`, `<Section>`, `<Button>`).
7. Modificar `app/actions/invitations/create-invitation.ts`:
   - Query inicial: `select('id, first_name, last_name, rooms!inner(daycare_id, daycares!inner(name))')`.
   - `activationUrl` desde `NEXT_PUBLIC_APP_URL`. Si falta, error claro.
   - `expiresAt` formateado en español: `Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })`.
   - Render + send.
   - Si `error` → rollback + error genérico.
   - Si `data` → `update sent_at = now()`. UPDATE falla → `console.warn` y seguir.
8. Modificar `app/auth/active/AuthActiveBody.tsx`:
   - `useSearchParams()`.
   - `useState<string>(searchParams?.get('code')?.toUpperCase() ?? '')`.
   - El input sigue con `onChange` que aplica `.toUpperCase()`.
   - Confirmar Suspense boundary en `app/auth/active/page.tsx` si Next 16 lo exige (probable).
9. Actualizar `.env.template` con las 4 vars (placeholders + comentario "requerido en prod").
10. Verificación técnica: `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.
11. Verificación funcional con `RESEND_API_KEY=mock`:
    - Loguearse como `pedro@gmail.com` (staff) en `pnpm dev`.
    - Abrir `/kids/<kid-id>` → modal Vincular Padre → llenar `Diego Fernández` / `diego.test@gmail.com` / `Papá` → submit.
    - Inspeccionar `/tmp/opencode/last-invitation-email.html`: contiene código + `${NEXT_PUBLIC_APP_URL}/auth/active?code=XXX` + nombres + fecha de expiración.
    - `select * from public.invitations where email = 'diego.test@gmail.com';`: `status='pending'`, `sent_at IS NOT NULL`, `last_send_error IS NULL`.
    - Click en el link del HTML → `/auth/active?code=XXX` → input pre-rellenado en uppercase.
    - Completar nombre+email+contraseña+checkbox → submit → `activateInvitation` → `redirect('/')`.
    - `select * from public.users where email = 'diego.test@gmail.com';`: `status='active'`, `role='parent'`, `daycare_id` correcto.
    - `select * from public.parent_children where parent_id = ...`: 1 fila.
    - `select * from public.invitations where email = 'diego.test@gmail.com';`: `status='accepted'`, `accepted_at IS NOT NULL`.
12. Negativo con `RESEND_API_KEY=invalid_key`: el modal muestra "No pudimos enviar la invitación. Probá de nuevo.". `select * from public.invitations where email = 'diego.test@gmail.com';`: 0 filas (rollback OK).
13. Cleanup: borrar `diego.test@gmail.com` de `auth.users` (cascade borra `public.users` y `parent_children`); borrar invitaciones de prueba.

## Criterios de aceptación

- [ ] DB-06 aplicado y commiteado.
- [ ] `resend` y `@react-email/components` instalados en `package.json` con versiones pinned.
- [ ] Existe `lib/email/resend.ts` (server-only) con `getResendClient()` que decide entre cliente real y mock según `RESEND_API_KEY`.
- [ ] Existe `lib/email/types.ts` con `InvitationEmailProps`.
- [ ] Existe `lib/email/templates/InvitationEmail.tsx` con plantilla React Email.
- [ ] `app/actions/invitations/create-invitation.ts` envía email tras INSERT; rollback si falla; setea `sent_at` si OK.
- [ ] `app/auth/active/AuthActiveBody.tsx` lee `?code=` de `useSearchParams` y pre-rellena el input del código.
- [ ] `.env.template` actualizado con las 4 vars nuevas.
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build` exit 0.
- [ ] Verificación funcional con `RESEND_API_KEY=mock`: HTML escrito a `/tmp/opencode/last-invitation-email.html` contiene código + link + nombres correctos.
- [ ] Verificación funcional: el link lleva a `/auth/active?code=XXX` con el input pre-rellenado, y el signup activa la cuenta.
- [ ] Verificación funcional con `RESEND_API_KEY=invalid_key`: el INSERT se hace rollback, no queda fila en `invitations`, el modal muestra error.
- [ ] Mensajes en español con voseo, consistentes con SPEC 08/10.

## Decisiones tomadas y descartadas

- **Sí: rollback del INSERT si Resend falla** (decisión del usuario).
- **Sí: React Email como librería de plantillas** (decisión del usuario).
- **Cambio al scope del spec: se usa `react-email@6.x` (v6 unificado) en lugar de `@react-email/components`.** React Email v6 unificó `components` + `render` en un único paquete `react-email`. La doc oficial de migración (`react-email/getting-started/updating-react-email`) instruye desinstalar `@react-email/components` y usar `import { Html, Body, render, ... } from 'react-email'`. API de `render` igual a v5. Decidido durante implementación para mantener el paquete actual soportado.
- **Sí: pre-fill del código en `/auth/active` desde query string** (decisión del usuario).
- **Sí: columnas `sent_at` + `last_send_error` para auditoría** (decisión del usuario; DB-06).
- **Sí (fix durante implementación): se agregan dos policies RLS faltantes.** La verificación end-to-end descubrió que `acceptInvitationByCode` (SPEC 10) ejecutaba `UPDATE` sobre `invitations` y `INSERT` sobre `parent_children` con el JWT del padre recién firmado, pero las policies de DB-05 solo permitían esas operaciones a `staff`/`admin`. El flow fallaba silenciosamente: `signUp` creaba el `auth.users` + `public.users`, pero la invitación quedaba `pending` y el vínculo padre↔niño nunca se creaba. Migration nueva: `supabase/migrations/20260827000000_add_invitation_accept_rls_policies.sql` con dos policies permisivas adicionales (`invitations_update_for_accept`, `parent_children_insert_for_accept`) que se suman (OR) a las vigentes.
- **Sí: cliente mock que escribe a `/tmp/opencode/last-invitation-email.html` cuando `RESEND_API_KEY=mock` o falta.** Permite dev local sin API key real; el flujo se verifica end-to-end sin depender de un proveedor externo.
- **Sí: `NEXT_PUBLIC_APP_URL` como env pública para construir el activation URL.** Debe estar disponible en el server (que arma el email) y se usa también en el cliente vía el pre-fill del query.
- **Sí: `RESEND_FROM_EMAIL` default `onboarding@resend.dev` (sandbox).** El usuario debe reemplazarlo por un dominio verificado antes de prod.
- **No: retry con backoff ante 429/5xx de Resend.** El staff reintenta manualmente desde el modal; aceptable para MVP.
- **No: webhooks de Resend para tracking de delivery/bounce.** El dashboard de Resend es la fuente primaria; integrar webhooks es futuro.
- **No: templates por daycare.** Todos usan el mismo sender. Multi-tenant visual se evalúa más adelante.
- **No: hash del activation URL para que el código no aparezca en logs.** El código es de un solo uso y expira en 7 días; aceptable para MVP.
- **No: text version del email separado.** React Email genera `text` automáticamente desde el `react`.
- **No: unsubscribe header.** Email transaccional, no marketing. Requerido por CAN-SPAM solo si se envían newsletters.
- **No: tests automatizados.** No hay framework configurado.
- **No: `revalidatePath('/kids/[id]', 'page')` adicional en el path de rollback.** Ya está dentro del rollback porque el INSERT se deshizo; el staff no ve la invitación listada.

## Riesgos identificados

| Riesgo                                                                    | Mitigación                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` no configurada en producción y cae al cliente mock       | Mock escribe a `/tmp/opencode/...` que probablemente no existe en el servidor de prod → falla silenciosa. Mitigación: en `create-invitation.ts`, si `RESEND_API_KEY` falta o es `'mock'`, `console.warn` claro. Documentar en `.env.template`. |
| Email del padre rebota (dirección inválida)                               | Resend acepta el envío pero el SMTP destino falla → registrado como bounce en el dashboard de Resend. Sin mitigación app-side hasta integrar webhooks. Aceptable para MVP.                                                                     |
| Rate limit de Resend (429)                                                | Sin retry automático. El staff reintenta manualmente desde el modal. Aceptable.                                                                                                                                                                |
| `NEXT_PUBLIC_APP_URL` no configurada en prod                              | El link apuntaría a `http://localhost:3000/...` y el padre nunca llega. Mitigación: validar en el server action que `NEXT_PUBLIC_APP_URL` esté set; tirar error claro si falta.                                                                |
| Rollback falla (red caída entre INSERT y DELETE)                          | Quedaría la invitación en DB sin email enviado. `sent_at` queda NULL. El staff puede detectarlo (futuro spec: UI de invitaciones pendientes). Aceptable.                                                                                       |
| Email se envía dos veces si el server action se reintenta (doble-click)   | El frontend usa `useFormStatus pending` que deshabilita el botón durante el submit. No es garantía absoluta. Aceptable: el código único por invitación previene problemas downstream.                                                          |
| Plantilla React Email rompe visualmente entre proveedores                 | React Email está hecho para ser compatible cross-client (Gmail, Outlook, Apple Mail). Aceptable.                                                                                                                                               |
| `useSearchParams` en `/auth/active` requiere Suspense boundary en Next 16 | Mitigación: envolver `AuthActiveBody` en `<Suspense>` en `app/auth/active/page.tsx` (probable requerimiento de Next 16 para client components que leen search params).                                                                         |

## Qué **no** entra en este spec

- Reenvío de invitaciones canceladas o fallidas (futuro spec).
- UI para listar invitaciones existentes en `/kids/[id]`.
- Templates en otros idiomas.
- Personalización del sender por daycare.
- Retry automático con backoff.
- Unsubscribe headers.
- Webhooks de Resend.
- Hash del activation URL.
- Tests automatizados.
- Preview visual de la plantilla con `react-email/dev/preview` (documentado como opcional; no exigido).

## Resultados de verificación

**Implementación (Steps 1–10):** ✅ Completa.

- [x] DB-06 aplicado y commiteado (merge #27 previo).
- [x] `resend@6.22.1` + `react-email@6.9.3` instalados pinned en `package.json`.
- [x] `lib/email/resend.ts` (server-only) con `getResendClient()` (mock + real).
- [x] `lib/email/types.ts` con `InvitationEmailProps`.
- [x] `lib/email/templates/InvitationEmail.tsx` (plantilla React Email).
- [x] `app/actions/invitations/create-invitation.ts` envía email + rollback si falla + `sent_at` si OK.
- [x] `app/auth/active/AuthActiveBody.tsx` pre-rellena desde `?code=` (lowercase → uppercase).
- [x] `app/auth/active/page.tsx` envuelve `<AuthActiveBody />` en `<Suspense fallback={null}>`.
- [x] `.env.template` con `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `NEXT_PUBLIC_APP_URL`.
- [x] `npx tsc --noEmit` exit 0.
- [x] `pnpm lint` exit 0.
- [x] `pnpm build` exit 0; `/auth/active` marcado como Dynamic (Suspense boundary correcto).
- [x] `get_advisors` (security) sin ERRORs nuevos tras DB-06 y la migration nueva de RLS.

**Verificación funcional con `RESEND_API_KEY=mock` (Step 11):** ✅ Parcial.

- [x] Login como `pedro@gmail.com` (staff, sala `Sala Soles`).
- [x] Abrir `/kids/<Maria-id>` → Vincular Padre → llenar `Diego Fernández` / `diego.test@gmail.com` / `Papá` → submit.
- [x] Inspección de `/tmp/opencode/last-invitation-email.html`: contiene el código (p.ej. `8U5PSH`), `${NEXT_PUBLIC_APP_URL}/auth/active?code=XXX`, nombres (Diego Fernández, Maria, Sala Soles), fecha "vence el 2 de septiembre de 2026" (Intl.DateTimeFormat español).
- [x] `select * from public.invitations`: `status='pending'`, `sent_at IS NOT NULL`, `last_send_error IS NULL`.
- [x] Click en el link del HTML → `/auth/active?code=8u5psh` → input pre-rellenado en uppercase `8U5PSH`.
- [ ] **Bloqueado:** signup del padre vía `supabase.auth.signUp` devuelve error `over_email_send_rate_limit` (rate limit por hora del proyecto Supabase dev; imposible de saltar desde la UI). El `auth.users` y `public.users` no se crean, por lo que `acceptInvitationByCode` no se ejecuta vía sesión real.
- [x] **Verificación indirecta del fix RLS:** confirmada vía SQL manual con `set local request.jwt.claims = '{"sub":"<user-id>","email":"diego.test@gmail.com","role":"authenticated"}'`. El `UPDATE invitations SET status='accepted' WHERE code='…'` retorna 1 fila (RLS OK). El `INSERT INTO parent_children …` también retorna 1 fila (RLS OK). La migration `20260827000000_add_invitation_accept_rls_policies.sql` es la fuente del fix.

**Verificación negativa con `RESEND_API_KEY=invalid_key` (Step 12):** ✅ Completa.

- [x] Modal muestra "No pudimos enviar la invitación. Probá de nuevo.".
- [x] `select count(*) from public.invitations where email='diego.test@gmail.com'`: 0 filas (rollback OK; el INSERT fue borrado por el `DELETE FROM invitations WHERE id=…` del server action).
- [x] Dev server log: Resend API devuelve `401 API key is invalid`, `createInvitation` retorna `{ error: 'No pudimos enviar la invitación. Probá de nuevo.' }`.

**Limpieza (Step 13):** ✅ Completa.

- [x] `auth.users` y `public.invitations` para `diego.test@gmail.com` borrados.
- [x] `/tmp/opencode/last-invitation-email.html` truncado.
- [x] `.env` local restaurado a `RESEND_API_KEY=mock`.

**Pendiente para próxima sesión (no bloquea merge):**

- Re-correr la parte final del Step 11 cuando el rate limit de Supabase se haya reseteado (1h desde el primer signUp), o desactivar "Confirm email" en la config del proyecto Supabase para que `signUp` no dispare el rate limit. La lógica de SPEC 11 está validada; solo falta la corrida end-to-end del signup por una restricción externa del proveedor.
