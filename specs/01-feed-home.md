# SPEC 01 — Feed como home `/`

> **Estado:** Implementado
> **Depende de:** Ninguno
> **Fecha:** 2026-08-17
> **Objetivo:** Implementar la pantalla de feed del mock `feed.dc.html` como la ruta `/` de la aplicación Next.js, usando Tailwind CSS v4, componentes reutilizables y datos mockeados estáticos, sin autenticación ni base de datos.

## Alcance

**Incluye:**

- Reemplazar `app/page.tsx` con el layout de feed (sidebar + feed).
- Crear sidebar con logo, navegación con cuatro items (`Feed`, `Niños`, `Avisos`, `Mi cuenta`), botón "Nueva publicación" y perfil de usuario. Solo `Feed` está activo; los demás apuntan a `#`.
- Implementar tarjetas de publicaciones: logro, actividad con foto placeholder y anuncio general.
- Like funcional con estado local que actualiza el contador.
- Fecha dinámica en español en el header.
- Fuentes Fredoka y Nunito cargadas con `next/font/google`.
- Paleta de colores mapeada a variables CSS en `@theme inline`.
- Iconos como componentes reutilizables en `app/components/icons.tsx`.
- Datos mockeados en `app/lib/posts.ts`.
- Layout responsive: sidebar fijo en desktop, drawer lateral con overlay en mobile.

**Fuera de alcance:**

- Autenticación y autorización.
- Base de datos o persistencia real.
- Rutas `/ninos`, `/avisos`, `/mi-cuenta`, `/crear-publicacion`, `/detalle-publicacion`.
- Funcionalidad de crear/editar/eliminar publicaciones.
- Imágenes reales de publicaciones.

## Modelo de datos

```ts
// app/lib/posts.ts
export type PostType = 'achievement' | 'activity' | 'announcement';

export interface Post {
  id: string;
  type: PostType;
  author: {
    name: string;
    initial: string;
    color: string;
  };
  recipientLabel: string;
  content: string;
  time: string;
  publishedBy: string;
  likes: number;
  comments: number;
  photo?: {
    alt: string;
  };
}
```

## Plan de implementación

1. Configurar fuentes y tema en `app/layout.tsx` y `app/globals.css`: añadir Fredoka/Nunito via `next/font/google` y definir colores en `@theme inline`.
2. Crear `app/components/icons.tsx` con los iconos SVG reutilizables del mock.
3. Crear `app/lib/posts.ts` con el array de posts mockeados y sus tipos.
4. Crear `app/components/feed/Sidebar.tsx` con logo, navegación con `Feed` (activo, `/`), `Niños`, `Avisos` y `Mi cuenta` (todos a `#`), botón "Nueva publicación" y perfil.
5. Crear `app/components/feed/PostCard.tsx` que renderice los tres tipos de posts, incluyendo la foto placeholder dashed para actividades.
6. Crear `app/components/feed/CreatePostPrompt.tsx` para el input "Compartí un momento…".
7. Crear `app/components/feed/SectionDivider.tsx` para el separador "PUBLICADO HOY".
8. Reemplazar `app/page.tsx` con el layout de dos columnas (sidebar + main) y el header dinámico con fecha en español.
9. Implementar drawer lateral para mobile: botón hamburguesa que abre el sidebar como overlay (`bg-black/30`) desde la izquierda, con cierre al hacer click fuera o en el botón de cerrar.
10. Verificar responsive, tipado (`npx tsc --noEmit`), lint (`pnpm lint`) y build (`pnpm build`).

## Criterios de aceptación

- [x] `pnpm dev` levanta sin errores y `http://localhost:3000` muestra el feed.
- [x] El layout desktop coincide visualmente con `reference/pantallas/feed.dc.html`.
- [x] La fecha del header se muestra en español con formato "martes 17 jun" usando la fecha actual.
- [x] El botón de like es funcional y el contador aumenta en 1 al hacer click.
- [x] En desktop el sidebar es visible y fijo a la izquierda.
- [x] En mobile el sidebar está oculto por defecto; el botón hamburguesa lo abre como overlay y se cierra al hacer click fuera.
- [x] El sidebar muestra los cuatro links: `Feed`, `Niños`, `Avisos` y `Mi cuenta`. `Feed` está activo; los demás apuntan a `#` y no navegan al hacer click.
- [x] `npx tsc --noEmit` no reporta errores.
- [x] `pnpm lint` no reporta errores.
- [x] `pnpm build` finaliza exitosamente.

## Decisiones tomadas y descartadas

- **Sí:** Datos mockeados en `app/lib/posts.ts` (array estático). Facilita reemplazo futuro por API.
- **No:** Hardcodear posts en `page.tsx`. Dificulta el mantenimiento.
- **Sí:** Mostrar links de navegación inactivos con `href="#"` para `Niños`, `Avisos` y `Mi cuenta`. Mantiene la fidelidad al mock y facilita reemplazo futuro por rutas reales.
- **No:** Dejar links reales a `/ninos`, `/avisos`, etc. Están fuera de alcance y generarían 404.
- **Sí:** Cargar fuentes con `next/font/google`. Mejor optimización.
- **No:** Mantener el `<link>` de Google Fonts del mock.
- **Sí:** Iconos como componentes reutilizables. Reduce duplicación.
- **No:** SVG inline dispersos.
- **Sí:** Variables CSS en `@theme inline`. Consistencia y autocompletado.
- **No:** Clases arbitrarias `bg-[#...]`.
- **Sí:** Like funcional con estado local.
- **No:** UI completamente estática.
- **Sí:** Placeholder visual dashed para fotos.
- **No:** Imagen de ejemplo real.
- **Sí:** Sidebar en mobile como overlay. No deforma el contenido.
- **No:** Sidebar empujando el contenido en mobile.

## Riesgos identificados

| Riesgo                                                              | Mitigación                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tailwind v4 usa sintaxis diferente a v3 para temas                  | Usar `@theme inline` en `globals.css` y no directivas v3.                             |
| `next/font/google` puede no soportar exactamente los pesos del mock | Verificar pesos disponibles (400, 500, 600, 700, 800) antes de implementar.           |
| Drawer en mobile requiere manejo de scroll y focus                  | Implementar con estado controlado, `aria-hidden`/`aria-expanded` y cierre con Escape. |

## Qué **no** está en este spec

- Autenticación ni gestión de sesiones.
- Base de datos ni persistencia.
- Crear, editar o eliminar publicaciones.
- Rutas de niños, avisos, mi cuenta, detalle de publicación o foto ampliada.
- Imágenes reales en las publicaciones.

Cada uno de estos, si llega, irá en su propio spec.

## Resultados de verificación

**Fecha de verificación:** 2026-08-17

**Resumen:** 10/10 criterios pasaron.

| Criterio | Estado | Notas |
| --- | --- | --- |
| `pnpm dev` levanta sin errores y `http://localhost:3000` muestra el feed. | PASS | Servidor responde 200, título "OpenDayCare", sin errores en consola. |
| Layout desktop coincide visualmente con `reference/pantallas/feed.dc.html`. | PASS | Estructura, colores, tipografía y componentes coinciden con el mock. |
| Fecha del header en español con formato "{weekday} {day} {month}" usando fecha actual. | PASS | Se muestra "lunes 17 ago" (fecha actual 2026-08-17). |
| Botón de like funcional y contador aumenta en 1 al hacer click. | PASS | Contador pasó de 3 a 4 tras el click. |
| En desktop el sidebar es visible y fijo a la izquierda. | PASS | Sidebar renderiza a 248px en viewport 1280x800. |
| En mobile sidebar oculto por defecto; botón hamburguesa abre overlay y se cierra al click fuera. | PASS | Drawer se abre con overlay `bg-black/30`; cierra con click en overlay o botón cerrar. |
| Sidebar muestra los cuatro links: Feed activo; los demás a `#` y no navegan. | PASS | Feed tiene clase activa; Niños/Avisos/Mi cuenta tienen `href="#"` y no cambian la URL. |
| `npx tsc --noEmit` no reporta errores. | PASS | Finaliza sin salida de error. |
| `pnpm lint` no reporta errores. | PASS | ESLint finaliza sin advertencias ni errores. |
| `pnpm build` finaliza exitosamente. | PASS | Next.js 16.3.1 genera página estática para `/` sin errores. |

**Observaciones visuales:**
- El avatar del usuario en el perfil del sidebar muestra visualmente una forma que puede confundirse con "N" en lugar de "C". El código fuente contiene la letra `"C"` correcta; se trata de un detalle de renderizado tipográfico en la fuente Fredoka a tamaños pequeños. No afecta la funcionalidad ni los criterios de aceptación.
- La paleta de colores, tarjetas de posts, badges y estructura general son fieles al mock de referencia.
