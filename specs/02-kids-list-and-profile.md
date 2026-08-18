# SPEC 02 — Listado y perfil de niños `/kids` y `/kids/[id]`

> **Estado:** Aprobado
> **Depende de:** SPEC 01 — Feed como home `/`
> **Fecha:** 2026-08-17
> **Objetivo:** Implementar la pantalla de gestión de niños en `/kids` y el perfil individual en `/kids/[id]`, con dos salones mockeados, buscador funcional, navegación desde el sidebar y página 404 personalizada, sin autenticación ni base de datos.

## Alcance

**Incluye:**

- Reutilizar y actualizar el sidebar del SPEC 01: el link `Niños` apunta a `/kids` y se marca activo en `/kids` y `/kids/[id]`.
- Crear ruta `/kids`: header "Niños" con subtítulo "GESTIÓN", botón "Agregar niño" (inactivo, `href="#"`), buscador funcional, divisores por sala y grid de tarjetas de niño.
- Dataset mockeado de 16 niños distribuidos en 2 salones: Sala Soles (8 niños, incluyendo los del mock original) y Sala Lunas (8 niños adicionales).
- Tarjeta de niño reutilizable con avatar circular, nombre completo, edad, cantidad de padres vinculados, badge de alergia o estado, y flecha de navegación.
- Navegación desde cada tarjeta a `/kids/[id]` usando el `id` del niño.
- Crear ruta `/kids/[id]`: header con avatar grande, nombre, edad y sala; botón "Editar" (inactivo, `href="#"`); alerta de alergias y notas; datos personales (fecha de nacimiento, sala, ingreso); botón "Resumen del día" (inactivo, `href="#"`); listado de padres vinculados con estado; link "Vincular otro padre" (inactivo, `href="#"`).
- Página 404 personalizada para `/kids/[id]` con id inexistente, con diseño consistente, mensaje "Niño inexistente" y link para volver a `/kids`.
- Responsive consistente con SPEC 01: sidebar fijo en desktop, drawer lateral en mobile.

**Fuera de alcance:**

- Autenticación y autorización.
- Base de datos o persistencia real.
- Crear, editar o eliminar niños.
- Vinculación real de padres.
- Pantalla de resumen del día.
- Selector/filtro de sala (se propone para un spec posterior).
- Imágenes reales de avatares.
- Otras rutas del sidebar (`Avisos`, `Mi cuenta`, `Crear publicación`).

## Modelo de datos

```ts
// app/lib/kids.ts
export type ParentStatus = 'active' | 'pending';

export interface Parent {
  id: string;
  name: string;
  role: string;
  status: ParentStatus;
  initial: string;
  color: string;
}

export interface Room {
  id: string;
  name: string;
}

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
  linkedParents: Parent[];
}
```

## Plan de implementación

1. Actualizar `app/components/feed/Sidebar.tsx`: cambiar el link `Niños` de `#` a `/kids` y marcarlo como activo cuando la ruta actual sea `/kids` o `/kids/[id]`.
2. Crear `app/lib/kids.ts` con los tipos, los arrays de salones (`Sala Soles`, `Sala Lunas`) y 16 niños mockeados con padres vinculados y alergias variadas.
3. Crear componentes reutilizables en `app/components/kids/` declarados como arrow functions:
   - `KidCard.tsx`: tarjeta de niño con avatar, datos, badge y flecha.
   - `SearchInput.tsx`: input de búsqueda con icono de lupa.
   - `RoomDivider.tsx`: separador con nombre de sala y contador de niños.
   - `KidProfileHeader.tsx`: header del perfil con avatar grande, datos y botón Editar.
   - `AllergyAlert.tsx`: caja de alerta de alergias y notas.
   - `ParentsList.tsx`: listado de padres vinculados con badge de estado y link para vincular otro.
   - `KidNotFound.tsx`: mensaje y link para la página 404.
4. Crear `app/kids/page.tsx` como función normal de página, con layout de lista, buscador funcional, divisores por sala y grid de tarjetas.
5. Crear `app/kids/[id]/page.tsx` como función normal de página, que reciba el parámetro `id`, busque el niño en los datos mockeados y renderice el perfil completo; si no existe, invocar `notFound()` de Next.js.
6. Crear `app/kids/[id]/not-found.tsx` como función normal de página, usando `KidNotFound.tsx` con mensaje "Niño inexistente" y link a `/kids`.
7. Verificar responsive, tipado (`npx tsc --noEmit`), lint (`pnpm lint`) y build (`pnpm build`).

## Criterios de aceptación

- [ ] `pnpm dev` levanta sin errores y `http://localhost:3000/kids` muestra el listado de niños.
- [ ] El sidebar muestra `Niños` activo en `/kids` y `/kids/[id]`, y su link apunta a `/kids`.
- [ ] `/kids` muestra los 16 niños agrupados por sala: "SALA SOLES 8 niños" y "SALA LUNAS 8 niños".
- [ ] El buscador filtra en tiempo real por nombre y apellido, ignorando tildes y mayúsculas.
- [ ] Al hacer click en una tarjeta se navega a `/kids/[id]` y se muestra el perfil correcto.
- [ ] El perfil muestra nombre, edad, sala, alergias/notas, datos personales, padres vinculados con estado y botones/links inactivos con `href="#"`.
- [ ] Una URL como `/kids/999` muestra la página 404 con diseño consistente, mensaje "Niño inexistente" y link a `/kids`.
- [ ] En desktop el sidebar es visible y fijo; en mobile se comporta como drawer igual que en SPEC 01.
- [ ] `npx tsc --noEmit` no reporta errores.
- [ ] `pnpm lint` no reporta errores.
- [ ] `pnpm build` finaliza exitosamente.

## Decisiones tomadas y descartadas

- **Sí:** 16 niños en 2 salones (Sala Soles + Sala Lunas). Permite probar el buscador con volumen real y agrupar por sala.
- **No:** 8 niños únicamente. El buscador y la agrupación no tendrían valor demostrable.
- **Sí:** Mostrar todos los niños agrupados por sala en `/kids`. Usa el patrón visual del mock y aprovecha los dos salones.
- **No:** Mostrar solo Sala Soles. Dejaría los datos de Sala Lunas sin uso.
- **Sí:** Buscador funcional en cliente con normalización de tildes. No hay backend.
- **No:** Buscador visual. No cumpliría con la intención del usuario.
- **Sí:** Botones/links a futuras funciones apuntan a `#`. Mantienen fidelidad visual sin crear rutas rotas.
- **No:** Crear rutas temporales como `/kids/new` o `/kids/[id]/summary`. Están fuera de alcance.
- **Sí:** Página 404 personalizada para id inexistente. Mejor UX y consistencia visual.
- **No:** Redirigir silenciosamente a `/kids`. Menos claro para el usuario.
- **Sí:** Reutilizar el sidebar del SPEC 01. Consistencia y menos duplicación.
- **No:** Crear un nuevo sidebar. Duplicaría código.
- **Sí:** Componentes y funciones auxiliares fuera de `page.tsx`/`layout.tsx`/`not-found.tsx` como arrow functions. Mantiene consistencia con el estilo funcional del proyecto.
- **No:** Declarar componentes reutilizables con la palabra clave `function`. Rompería la convención de arrow functions para helpers y sub-componentes.
- **Sí:** Selector/filtro de sala como spec futuro. Se desacopla la funcionalidad y se mantiene este spec enfocado.
- **No:** Agregar el selector de sala ahora. Aumentaría el alcance y la complejidad.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Duplicación de componentes con SPEC 01 | Reutilizar `Sidebar` e `icons.tsx`; extraer componentes comunes si el proyecto sigue creciendo. |
| Buscador con caracteres especiales o acentos | Normalizar strings al filtrar (quitar tildes, pasar a minúsculas). |
| Página 404 de Next.js requiere renderizado en `app/kids/[id]/not-found.tsx` | Asegurar que el componente esté en la ruta correcta y use el mismo layout visual. |

## Qué **no** está en este spec

- Autenticación ni gestión de sesiones.
- Base de datos ni persistencia real.
- Crear, editar o eliminar niños.
- Vinculación real de padres.
- Resumen del día.
- Selector/filtro de sala (propuesto para spec posterior).
- Imágenes reales de avatares.
- Otras rutas del sidebar.
