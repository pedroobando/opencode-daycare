# SPEC 06 — Modal "Nueva publicación" en `/`

> **Estado:** Implementado
> **Depende de:** SPEC 01 — Feed como home `/`
> **Fecha:** 2026-08-19
> **Objetivo:** Convertir el botón "Nueva publicación" del sidebar en un modal compacto que reproduce `reference/pantallas/crear-publicacion.dc.html` con los 16 niños ordenados alfabéticamente, el botón "Toda la sala" como toggle de selección, los 7 tipos de post del mock y un contador visual de fotos, y al publicar inserta el post al inicio del feed local sin persistencia.

## Alcance

**Incluye:**

- Reemplazar el `<a href="#" onClick={prevent}>` del botón "Nueva publicación" en `app/components/feed/Sidebar.tsx` por un `<button type="button">` que abre el modal (mismo patrón que SPEC 04/05).
- Nuevo componente `app/components/feed/CreatePostModal.tsx` (arrow function, `'use client'`):
  - Mismo patrón de modal que `AddKidModal` y `LinkParentModal`: portal a `document.body` con `useMounted` (`useSyncExternalStore`), overlay `fixed inset-0 z-50 bg-black/40`, padding generoso, `overflow-y-auto`.
  - Cierra con `Escape`, click en backdrop y botón "Cancelar".
  - Bloquea `document.body.style.overflow` mientras está abierto y lo restaura al cerrarse.
  - Guarda `document.activeElement` al abrir, enfoca el primer input al abrir, restaura el foco al cerrar (fallback al `triggerRef` pasado por el padre).
  - **Tamaño compacto para tablets:** `max-w-[560px]` (vs los 580px del mock y los 520px del `AddKidModal`), padding interno `px-5 py-5` (vs `px-6 py-6`), gaps entre secciones `mb-4` (vs `mb-[18px]`/`mb-[22px]` del mock), gap entre pills `gap-2`.
  - Accesibilidad: `role="dialog"` `aria-modal="true"` `aria-labelledby="create-post-title"`, título del modal con `id="create-post-title"`.
  - Cabecera: link "Cancelar" (izquierda, color `muted-light`), título "Nueva publicación" centrado en Fredoka (`font-display`), botón "Publicar" (derecha, color `primary`, peso `font-extrabold`).
- Nuevo componente `app/components/feed/CreatePostForm.tsx` (arrow function, `'use client'`) que renderiza el cuerpo del modal:
  - **Sección PARA** — etiqueta "PARA" en `text-[12px] font-extrabold uppercase tracking-[0.7px] text-muted-light`. Lista de pills con los **16 niños ordenados alfabéticamente por `firstName.localeCompare(..., 'es')`** (sin importar sala) más una pill "Toda la sala" al final. Cada niño se renderiza como botón tipo pill con su avatar (color de fondo `kid.color`, inicial en `font-display`) y su nombre (`kid.firstName`). "Toda la sala" es un toggle con su propio estado (`isAllRoom: boolean`):
    - `isAllRoom` estado propio del botón (siguiendo pedido explícito del usuario).
    - Click en "Toda la sala" con `isAllRoom = false`: activa `isAllRoom` y llena `selectedKidIds` con los 16 ids de niños.
    - Click en "Toda la sala" con `isAllRoom = true`: desactiva `isAllRoom` y vacía `selectedKidIds`.
    - Click en un niño con `isAllRoom = true`: desactiva `isAllRoom` y aplica toggle al niño en `selectedKidIds` (los demás niños quedan en su estado previo de `selectedKidIds`).
    - Click en un niño con `isAllRoom = false`: solo aplica toggle al niño en `selectedKidIds`.
    - **Visual derivado:** una pill de niño se ve activa si `isAllRoom || selectedKidIds.has(id)`. La pill "Toda la sala" se ve activa si `isAllRoom || (selectedKidIds.size === kids.length && kids.length > 0)` (también cuando el usuario marca los 16 niños manualmente, sin pasar por el botón).
    - Estilo de pill inactiva: `rounded-full border-[1.5px] border-card-border bg-card text-muted-light`.
    - Estilo de pill activa para niño: `border-[1.5px] border-foreground bg-foreground text-white`.
    - Estilo de pill activa para "Toda la sala": `border-[1.5px] border-card-border bg-card text-foreground` (mismo que el mock, sin invertir fondo).
  - **Sección TIPO** — etiqueta "TIPO" en el mismo estilo. Siete botones pill (uno por tipo): Comida, Siesta, Actividad, Logro, Ánimo, Foto, Anuncio. Single-select. Estilo activo: igual al del mock (`border-none` con el color de fondo del tipo y color de texto del tipo). Estilo inactivo: versión atenuada con `opacity-60` sobre el mismo fondo (mantiene el lenguaje visual del mock sin botones fantasma en gris).
  - **Sección DESCRIPCIÓN** — etiqueta "DESCRIPCIÓN" en el mismo estilo. `<textarea>` con `min-h-[120px]`, `resize-y`, padding `14px 16px`, `rounded-[14px] border border-card-border bg-card`, placeholder "Contá cómo le fue hoy…".
  - **Sección FOTOS** — etiqueta "FOTOS" en el mismo estilo. Bloque visual-only:
    - Una tile inicial de 96x96 con `bg-placeholder-bg border border-card-border` que contiene el `ImagePlaceholderIcon` y texto `text-placeholder-text` (placeholder de foto existente, igual que el mock).
    - Una tile "Agregar" de 96x96 con `border-[1.5px] border-dashed border-placeholder-border bg-placeholder-bg` que contiene un `PlusIcon` (reutiliza el existente en `app/components/icons.tsx`) y el texto "Agregar".
    - Click en la tile "Agregar" incrementa un contador interno `photoCount`. Cada nueva tile es una réplica de la tile "Agregar" (mismo dashed, mismo ícono, mismo texto). Sin removal en este spec.
    - El `photoCount` se adjunta al post publicado como `photos: photoCount`.
  - Validación inline solo al intentar publicar (click en "Publicar"):
    - `Para`: si `selectedKidIds.size === 0 && !isAllRoom`, mostrar "Seleccioná al menos un destinatario." debajo del bloque PARA.
    - `Tipo`: si `selectedType` es `undefined`/`null`, mostrar "Seleccioná un tipo." debajo del bloque TIPO.
    - `Descripción`: si `description.trim() === ''`, mostrar "Este campo es obligatorio." debajo del textarea.
    - Los mensajes se renderizan en `aria-live="polite"` y los grupos inválidos reciben `aria-invalid="true"`.
  - Reset del formulario: `CreatePostForm` renderiza `null` si `!open`, lo que garantiza que al re-abrir el modal todos los campos y errores estén limpios (mismo comportamiento que `AddKidForm`).
- Nuevo componente `app/components/feed/FeedBody.tsx` (arrow function, `'use client'`):
  - Wrapper cliente que mantiene `const [postsList, setPostsList] = useState<Post[]>(posts)` y `const [isModalOpen, setIsModalOpen] = useState(false)`.
  - Renderiza el layout completo que hoy tiene `app/page.tsx`: sidebar (visible solo en `lg+`), main con `<MobileDrawer>`, header, `<CreatePostPrompt>`, `<SectionDivider label="PUBLICADO HOY">` y el listado de posts (`postsList.map(post => <PostCard key={post.id} post={post} />)`).
  - Pasa a `<Sidebar>` y `<MobileDrawer>` un callback `onNewPost={() => setIsModalOpen(true)}` y un `triggerRef: React.RefObject<HTMLButtonElement | null>`.
  - Renderiza `<CreatePostModal open={isModalOpen} onClose={...} allKids={kids} onAddPost={(post) => setPostsList((prev) => [post, ...prev])} triggerRef={triggerRef} />`.
  - El header dinámico con la fecha (`{weekday} {day} {month}`) se calcula con `new Date()` en el cliente (mismo helper `formatDate` actual, llevado al wrapper).
- Modificar `app/components/feed/Sidebar.tsx`:
  - Agregar a `SidebarProps` las props opcionales `onNewPost?: () => void` y `triggerRef?: React.RefObject<HTMLButtonElement | null>`.
  - El `<a>` actual de "Nueva publicación" pasa a ser `<button type="button" ref={triggerRef} onClick={onNewPost}>` (mantiene las clases visuales exactas; el botón es lo mismo que el `<a>` pero como `<button>`).
- Modificar `app/components/feed/MobileDrawer.tsx`:
  - Agregar a `MobileDrawerProps` (nuevo tipo) las props opcionales `onNewPost?: () => void` y `triggerRef?: React.RefObject<HTMLButtonElement | null>`.
  - Pasarlas al `<Sidebar>` interno.
  - Si `onNewPost` está definido, antes de propagar el callback también cierra el drawer (`setIsOpen(false)`); esto evita que el sidebar quede visible detrás del modal en mobile.
- Modificar `app/components/feed/PostCard.tsx`:
  - Extender el `config` del `Badge` con los 4 tipos nuevos (`meal`, `nap`, `mood`, `photo`). Cada tipo mapea a `label` (en mayúsculas, en español) y a las CSS classes `bg-{type}-bg`/`text-{type}-text`.
  - Reemplazar el color hardcoded `color: '#1F7A93'` del `Avatar` por `getAvatarTextColor(post.author.color)` (importado de `app/lib/kids.ts`) para que el texto del avatar tenga contraste correcto con cualquier color de fondo.
- Modificar `app/lib/posts.ts`:
  - Extender `PostType` de `'achievement' | 'activity' | 'announcement'` a `'achievement' | 'activity' | 'announcement' | 'meal' | 'nap' | 'mood' | 'photo'`.
  - Agregar `photos?: number` opcional a `Post` (cantidad de fotos; sin objeto porque no hay backend).
- Modificar `app/globals.css`:
  - Agregar 4 pares de CSS vars en `:root` y mapearlos en `@theme inline`:
    - `--color-meal-bg: #9A7B1E; --color-meal-text: #ffffff`
    - `--color-nap-bg: #E7DCF6; --color-nap-text: #7B5FC0`
    - `--color-mood-bg: #F9D2DE; --color-mood-text: #C56486`
    - `--color-photo-bg: #FBD8CC; --color-photo-text: #D9684A`
  - **Side effect intencional:** actualizar los vars `activity` para coincidir con el mock:
    - `--color-activity-bg: #2E89A6; --color-activity-text: #ffffff` (antes `#c7e7f1` / `#2e89a6`).
    - Esto cambia el badge visual del único post existente de tipo `activity` (post-2) de cyan claro a azul fuerte. Decisión justificada en la sección de decisiones.

**Fuera de alcance:**

- Persistencia entre recargas (no hay DB ni backend).
- Upload real de fotos (FileReader, `<input type="file">`, drag-and-drop). El contador es visual-only.
- Autenticación ni sesión de usuario.
- Edición o eliminación de posts ya publicados (el link "Editar" del `PostCard` sigue inactivo como en SPEC 01).
- Cierre con confirmación "¿desea descartar los cambios?".
- Internacionalización (UI en español, como el resto del proyecto).
- Animaciones de entrada/salida del modal más allá de la apertura directa.
- Límite máximo de fotos adjuntas (se puede incrementar indefinidamente).
- Drag-and-drop ni reordenamiento de tiles de fotos.
- Quitar fotos una vez agregadas (sin botón de remover; cerrar y reabrir el modal las descarta).
- Cambio en `app/lib/kids.ts` para modelar "current user" — la info de Caro se mantiene local al form.

## Modelo de datos

Se extiende lo existente, sin nuevas interfaces:

```ts
// app/lib/posts.ts (modificado)
export type PostType =
  | 'achievement'
  | 'activity'
  | 'announcement'
  | 'meal'
  | 'nap'
  | 'mood'
  | 'photo';

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
  photo?: { alt: string };
  photos?: number; // NUEVO: cantidad de fotos (mock, sin array)
}
```

Estado interno del formulario (no se persiste en el `Post`):

```ts
const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());
const [isAllRoom, setIsAllRoom] = useState(false);
const [selectedType, setSelectedType] = useState<PostType | null>(null);
const [description, setDescription] = useState('');
const [photoCount, setPhotoCount] = useState(0);
const [errors, setErrors] = useState<FormErrors>({});
```

Forma del `Post` creado por el modal:

```ts
const now = new Date();
const time = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
}).format(now);

const allKidsSelected = selectedKidIds.size === kids.length && kids.length > 0;

const recipientLabel = (() => {
  if (isAllRoom || allKidsSelected) return 'toda la sala';
  const names = selectedKidIds
    .map((id) => kidsById[id].firstName)
    .sort((a, b) => a.localeCompare(b, 'es'));
  if (names.length === 0) return '';
  if (names.length === 1) return `familia de ${names[0]}`;
  if (names.length === 2) return `familia de ${names[0]} y ${names[1]}`;
  return `familia de ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
})();

const author = (() => {
  if (selectedType === 'announcement') {
    return { name: 'Anuncio general', initial: '', color: '#CCD8F4' };
  }
  if (isAllRoom) {
    return { name: 'Caro Giménez', initial: 'C', color: '#F2937A' };
  }
  const firstId = [...selectedKidIds][0];
  const firstKid = kidsById[firstId];
  return {
    name: firstKid.firstName,
    initial: firstKid.initial,
    color: firstKid.color,
  };
})();

const newPost: Post = {
  id: `post-${Date.now()}`,
  type: selectedType!,
  author,
  recipientLabel,
  content: description.trim(),
  time,
  publishedBy: 'publicado por vos',
  likes: 0,
  comments: 0,
  photos: photoCount > 0 ? photoCount : undefined,
};
```

Notas:

- `kidsById` se construye una vez con `Object.fromEntries(kids.map((k) => [k.id, k]))`.
- `allKidsSelected` cubre el caso en que el usuario selecciona los 16 niños uno por uno (sin presionar "Toda la sala"): el label sigue siendo "toda la sala" en vez de la lista larga de 16 nombres.
- `selectedKidIds` se ordena al construir el label para que "familia de X, Y, Z" sea estable independientemente del orden de click.
- `photoCount > 0 ? photoCount : undefined` evita persistir el campo cuando no hay fotos.
- El `id` usa `Date.now()`; suficiente para unicidad dentro de la sesión.
- `time` se calcula al publicar (no al abrir el modal); si el usuario abre, espera 5 minutos y publica, registra `HH:mm` del momento de publicar.
- La lista PARA se ordena una sola vez con `[...kids].sort((a, b) => a.firstName.localeCompare(b.firstName, 'es'))` y se pasa al form como `kids` ordenado.

## Plan de implementación

1. Modificar `app/globals.css`:
   - Agregar las 8 nuevas CSS vars (4 pares) en `:root` y en `@theme inline` siguiendo el patrón actual (`--color-{type}-bg`, `--color-{type}-text`).
   - Actualizar `--color-activity-bg` a `#2E89A6` y `--color-activity-text` a `#ffffff` (side effect sobre post-2; justificado en decisiones).
2. Modificar `app/lib/posts.ts`:
   - Extender `PostType` con `meal`, `nap`, `mood`, `photo`.
   - Agregar `photos?: number` opcional al interface `Post`.
   - Dejar `posts` con los 3 posts existentes tal cual (post-2 sigue siendo `'activity'` y se re-renderiza con el color actualizado).
3. Modificar `app/components/feed/PostCard.tsx`:
   - En el `config` del `Badge`, agregar 4 entradas: `meal: { label: 'COMIDA', bgClass: 'bg-meal-bg', textClass: 'text-meal-text' }`, `nap`, `mood`, `photo` (label y class equivalentes).
   - En el `Avatar` no-announcement, importar `getAvatarTextColor` de `@/app/lib/kids` y usar `color: getAvatarTextColor(post.author.color)`.
4. Modificar `app/components/feed/Sidebar.tsx`:
   - Agregar a `SidebarProps` las dos props nuevas (ambas opcionales, `?`).
   - Reemplazar el `<a href="#" onClick={prevent}>` del botón "Nueva publicación" por `<button type="button" ref={triggerRef} onClick={onNewPost}>` con las mismas clases visuales.
5. Modificar `app/components/feed/MobileDrawer.tsx`:
   - Definir `interface MobileDrawerProps { onNewPost?: () => void; triggerRef?: React.RefObject<HTMLButtonElement | null> }`.
   - Aceptar las props en `MobileDrawer` y pasarlas al `<Sidebar>` interno.
   - El handler de "Nueva publicación" debe ejecutar `setIsOpen(false)` antes de invocar `onNewPost?.()`.
6. Crear `app/components/feed/CreatePostForm.tsx` (arrow function, `'use client'`):
   - Props: `open: boolean`, `kids: Kid[]`, `onCancel: () => void`, `onSubmit: (payload: CreatePostFormPayload) => void`.
   - Estado local: `selectedKidIds: Set<string>`, `isAllRoom: boolean`, `selectedType: PostType | null`, `description: string`, `photoCount: number`, `errors: FormErrors`.
   - `if (!open) return null;` (mismo patrón que `AddKidForm` y `LinkParentForm`).
   - Handlers:
     - `handleAllRoomClick`: si `isAllRoom` → setIsAllRoom(false) + setSelectedKidIds(new Set()); si no → setIsAllRoom(true) + setSelectedKidIds(new Set(kids.map((k) => k.id))).
     - `handleKidClick(id)`: si `isAllRoom` → setIsAllRoom(false); luego toggle del id en `selectedKidIds`.
   - Derivados: `allKidsSelected = selectedKidIds.size === kids.length && kids.length > 0`; `showAllRoomHighlight = isAllRoom || allKidsSelected`; `isKidActive = (id) => showAllRoomHighlight || selectedKidIds.has(id)`.
   - Helper interno `kidsById: Record<string, Kid>` (puro, fuera del componente o memoizado) para resolver nombre/initial/color.
   - Renderiza las cuatro secciones (PARA, TIPO, DESCRIPCIÓN, FOTOS) con los estilos detallados arriba.
   - `handleSubmit` valida los tres grupos, setea `errors`, y si todo OK llama `onSubmit({...})` con un `CreatePostFormPayload` que contiene los valores crudos (la construcción del `Post` vive en `CreatePostModal`).
   - Exports: `CreatePostFormPayload` interface para que `CreatePostModal` la consuma.
7. Crear `app/components/feed/CreatePostModal.tsx` (arrow function, `'use client'`):
   - Props: `open: boolean`, `onClose: () => void`, `allKids: Kid[]`, `onAddPost: (post: Post) => void`, `triggerRef: React.RefObject<HTMLButtonElement | null>`.
   - Replica exactamente la estructura de `AddKidModal.tsx` (portal, escape, backdrop, body scroll lock, focus management).
   - Renderiza el overlay con `max-w-[560px]` y dentro un card con cabecera (Cancelar / "Nueva publicación" / Publicar) y `<CreatePostForm>`.
   - `handleSubmit` arma el `Post` (según la forma del modelo de datos arriba), llama `onAddPost` y `onClose`.
8. Crear `app/components/feed/FeedBody.tsx` (arrow function, `'use client'`):
   - Mismo patrón que `KidProfileBody`.
   - `useState<Post[]>(posts)` para `postsList`.
   - `useState<boolean>(false)` para `isModalOpen`.
   - `useRef<HTMLButtonElement | null>(null)` para `triggerRef`.
   - `formatDate` (traído de `app/page.tsx`) usado para el header.
   - Renderiza la estructura completa: `<div className="flex min-h-screen"><div className="hidden lg:flex"><Sidebar onNewPost={open} triggerRef={triggerRef} /></div><main>...<MobileDrawer onNewPost={open} triggerRef={triggerRef} />...{postsList.map(...)}</main></div>`.
   - Renderiza `<CreatePostModal>` con los props correspondientes.
9. Modificar `app/page.tsx`:
   - Queda como server component casi vacío: importa `FeedBody` y lo renderiza.
   - Se elimina toda la lógica que hoy está inline (Sidebar, MobileDrawer, CreatePostPrompt, SectionDivider, posts, formatDate).
10. Verificar tipado (`npx tsc --noEmit`), lint (`pnpm lint`) y build (`pnpm build`).

## Criterios de aceptación

- [x] El control "Nueva publicación" en el sidebar (desktop y mobile) es un `<button>` y al hacer click abre el modal con cabecera "Cancelar / Nueva publicación / Publicar".
- [x] El modal se monta en `document.body` vía `createPortal`; tiene `role="dialog"`, `aria-modal="true"` y `aria-labelledby="create-post-title"`.
- [x] El modal bloquea el scroll del body mientras está abierto y lo restaura al cerrarse; cierra con `Escape`, click en el backdrop y botón "Cancelar"; al cerrar, el foco vuelve al botón "Nueva publicación".
- [x] El modal mide `max-w-[560px]` (compacto) y se ve correctamente en viewports de tablet (≥640px).
- [x] La sección PARA lista los 16 niños de `app/lib/kids.ts` ordenados alfabéticamente por `firstName` (con soporte de tildes), cada uno como pill con su avatar (color de fondo `kid.color`, inicial) y nombre, más una pill final "Toda la sala".
- [x] Click en "Toda la sala" (estado inactivo): los 16 niños quedan visualmente activos y la pill "Toda la sala" queda activa. `isAllRoom` se vuelve `true` y `selectedKidIds` contiene los 16 ids.
- [x] Click en "Toda la sala" (estado activo): todos los niños quedan visualmente inactivos y la pill "Toda la sala" queda inactiva. `isAllRoom` se vuelve `false` y `selectedKidIds` queda vacío.
- [x] Click en un niño con `isAllRoom = true`: la pill "Toda la sala" se desactiva, ese niño se deselecciona (queda inactivo) y los otros 15 niños quedan seleccionados (visualmente activos). `isAllRoom` pasa a `false`.
- [x] Click en un niño con `isAllRoom = false` y `selectedKidIds` vacío: ese niño se selecciona (visualmente activo).
- [x] Click en un niño con `isAllRoom = false` y `selectedKidIds` con otros niños: solo toggle de ese niño.
- [x] Si el usuario marca los 16 niños manualmente (sin presionar "Toda la sala"), la pill "Toda la sala" se ve activa (visual derivado de `selectedKidIds.size === kids.length`).
- [x] La sección TIPO muestra exactamente 7 botones pill (Comida, Siesta, Actividad, Logro, Ánimo, Foto, Anuncio), single-select, con los colores del mock.
- [x] El textarea DESCRIPCIÓN tiene placeholder "Contá cómo le fue hoy…" y permite múltiples líneas (`resize-y`).
- [x] El bloque FOTOS arranca con 1 tile placeholder + 1 tile "Agregar" (dashed). Click en "Agregar" agrega una nueva tile "Agregar" idéntica. `photoCount` se adjunta al post al publicar.
- [x] Al hacer click en "Publicar" sin destinatario, sin tipo o sin descripción, aparecen mensajes inline rojos en los grupos correspondientes (`aria-invalid="true"`, `aria-live="polite"`) y el modal permanece abierto.
- [x] Al publicar con un destinatario (uno o más niños, "Toda la sala", o los 16 manualmente), un tipo y una descripción, el modal se cierra y el post nuevo aparece al principio del feed (sobre `post-1`, `post-2`, `post-3`).
- [x] El post nuevo se renderiza en `PostCard.tsx` con el badge correcto del tipo (incluyendo los 4 nuevos), avatar del primer niño seleccionado (o megaphone si tipo es `announcement`, o "C" coral si `isAllRoom` y tipo ≠ announcement), `recipientLabel` correcto ("familia de X", "familia de X e Y", "familia de X, Y y Z", o "toda la sala"), `time` en formato `HH:mm` local, `publishedBy: "publicado por vos"`, `likes: 0`, `comments: 0`, y `photos` solo si el contador fue >0.
- [x] Tras publicar, la lista del feed local refleja el cambio (state local del wrapper); al recargar la página, el post nuevo desaparece y la lista vuelve a los 3 originales.
- [x] El post existente `post-2` (tipo `activity`) ahora se renderiza con badge azul fuerte (#2E89A6 bg, texto blanco) — side effect intencional del cambio de CSS vars.
- [x] El texto del avatar en `PostCard` usa `getAvatarTextColor` y tiene contraste correcto contra el color de fondo (incluso con el coral de Caro).
- [x] `npx tsc --noEmit`, `pnpm lint` y `pnpm build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Sí:** Wrapper cliente `FeedBody` que mantiene `useState<Post[]>(posts)`. Mismo patrón que `KidProfileBody` (SPEC 05). Permite reflejar el alta inmediatamente sin tocar `app/lib/posts.ts` ni agregar persistencia.
  - **No:** Convertir `app/page.tsx` entero a `'use client'`. Pierde la opción de tener lógica server-side si crece.
  - **No:** Persistir el alta en `app/lib/posts.ts`. Cambiar el módulo mockeado haría que los posts nuevos aparezcan para todos los lectores del archivo.
  - **No:** Persistir en `localStorage`. Está fuera de alcance y agregaría complejidad que no se aprovecha.
- **Sí:** Botón "Toda la sala" como toggle con estado propio (`isAllRoom: boolean`), siguiendo el pedido explícito del usuario. Click marca los 16 niños y activa el botón; click de nuevo desmarca todos y desactiva el botón. Click en un niño estando `isAllRoom` activo desactiva el modo y aplica toggle solo a ese niño.
  - **No:** Derivar `isAllRoom` de `selectedKidIds.size === kids.length`. Más simple pero el usuario pidió state explícito.
  - **No:** "Toda la sala" mutuamente excluyente con niños (modelo del spec original). Cambió por pedido del usuario: ahora marca todos en lugar de ser una opción alternativa.
- **Sí:** Visual derivado: la pill "Toda la sala" se ve activa también cuando los 16 niños quedan marcados manualmente (sin pasar por el botón). Evita el caso raro de "16 nombres en `recipientLabel`" y mantiene coherencia visual con la intención del usuario.
  - **No:** Visual estrictamente atado a `isAllRoom`. Generaría inconsistencias visuales (todos marcados pero pill inactiva).
- **Sí:** `selectedKidIds: Set<string>` para selecciones individuales. Set da `has`/`add`/`delete` en O(1) sin riesgo de duplicados.
  - **No:** `string[]` con `.includes`/`.filter`. Más propenso a bugs y menos eficiente.
- **Sí:** Extender `PostType` a 7 tipos con sus CSS vars dedicadas. El mock los muestra todos; limitarlos a 3 dejaría UI inerte.
  - **No:** Mantener `PostType` de 3 y mostrar los 4 nuevos como "no implementado". UX rota.
  - **No:** Reutilizar colores existentes (achievement-bg/text para meal, etc.). Inconsistente con el mock y confuso visualmente.
- **Sí:** Actualizar `activity-bg`/`activity-text` para coincidir con el mock (#2E89A6 bg / #ffffff text). El mock es la fuente de verdad para esta feature.
  - **No:** Mantener los colors actuales (light cyan). El botón "Actividad" del modal y el badge del `PostCard` quedarían visualmente inconsistentes.
  - **Sí (consecuencia):** post-2 cambia visualmente. Aceptado como side effect intencional.
- **Sí:** Bloque FOTOS visual-only con contador. No hay backend; un array de fotos no tendría sentido.
  - **No:** `<input type="file">` con FileReader. Subiría blobs en memoria sin destino; el `Post` no podría persistirlos.
  - **No:** Omitir el bloque FOTOS. El mock lo muestra; omitirlo perdería fidelidad.
  - **No:** Botón "quitar foto" en cada tile. No está en el mock y agrega fricción; cerrar y reabrir resetea.
- **Sí:** `author` se calcula según el `selectedType` y la selección de destinatarios:
  - `announcement` → autor genérico (megaphone).
  - `!announcement && isAllRoom` → Caro Giménez ("C", coral).
  - Resto → primer niño seleccionado (resuelto de `selectedKidIds`).
    Coherente con el modelo actual de `Post.author` y permite que "Anuncio" mantenga su avatar megaphone.
  - **No:** Usar siempre el primer niño como autor. Rompe el caso `announcement` y el caso "Toda la sala + tipo no announcement".
  - **No:** Modelar "current user" como objeto en `app/lib/kids.ts`. Caro no es un Kid; sería una categoría distinta que se puede agregar más adelante si hace falta.
- **Sí:** `time` se calcula con `new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })` al publicar. Formato consistente con `formatDate` del header.
  - **No:** Hardcodear `time: '14:20'` o similar. No refleja la hora real.
- **Sí:** Validación inline al publicar (mismo patrón que `AddKidForm` y `LinkParentForm`). El usuario ve qué falta sin recorrer el formulario.
  - **No:** Botón "Publicar" deshabilitado hasta completar. Pierde la guía del mensaje de error.
- **Sí:** Componentes nuevos como arrow functions, `'use client'` solo donde hace falta. Sigue la convención del proyecto.
  - **No:** Declarar wrappers como `function`. Rompe la convención.
- **Sí:** `triggerRef` en el sidebar desktop como fallback del focus restore. El mobile sidebar cierra antes de abrir el modal, así que el botón desktop es lo único estable.
  - **No:** Confiar solo en `document.activeElement` sin fallback. El botón mobile puede haber sido removido del DOM.
- **Sí:** MobileDrawer cierra su drawer antes de propagar `onNewPost`. Evita que el sidebar quede visible detrás del modal en mobile.
  - **No:** Mantener el drawer abierto y superponer el modal. UX confusa.
- **Sí:** `useMounted` con `useSyncExternalStore` (mismo helper que `AddKidModal` y `LinkParentModal`). Evita mismatch de hidratación en el portal.
  - **No:** `useState(false) + useEffect`. Genera un render extra y warning de hidratación.
  - **No:** Extraer `useMounted` a `app/utils/` por ahora. Solo se duplica 3 veces; DRY prematuro.
- **Sí:** Pill "TIPO" inactiva con `opacity-60` sobre su color de fondo (en lugar de un gris neutro). Mantiene el lenguaje visual del mock: las pills ya tienen su color distintivo, solo se atenúan.
  - **No:** Pill inactiva en gris neutro (`bg-muted` o similar). Rompe la identidad visual de cada tipo.

## Riesgos identificados

| Riesgo                                                                            | Mitigación                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambio de color de `activity` rompe SPEC 01                                       | Documentar como side effect intencional; verificar visualmente post-2 con Playwright para confirmar que el badge sigue siendo legible (texto blanco sobre azul fuerte).                                                                                                                |
| `triggerRef` compartido entre desktop y mobile sidebar                            | En mobile, `MobileDrawer` cierra antes de propagar el callback, así que el botón mobile desaparece del DOM. El botón desktop está oculto en mobile (`hidden lg:flex`) pero presente, así que el fallback funciona. Si se quita `hidden lg:flex` en el futuro, considerar mover el ref. |
| Modal con z-index/portal conflictos en `/`                                        | Mismo patrón que `AddKidModal`/`LinkParentModal` (portal a `document.body`, `z-50`). Ya validado. Si surge conflicto con el drawer del sidebar (`z-40`), el modal gana por tener `z-50`.                                                                                               |
| Foco no se restaura al cerrar                                                     | Mismo patrón que SPEC 04/05: guardar `document.activeElement` al abrir, intentar restaurarlo al cerrar, fallback a `triggerRef.current?.focus()`.                                                                                                                                      |
| `id: post-${Date.now()}` puede chocar si dos posts se crean en el mismo ms        | Suficiente para el caso de uso (clicks separados por al menos cientos de ms). Si se necesita unicidad estricta, agregar un contador de sesión.                                                                                                                                         |
| El contador de fotos no tiene tope                                                | Un usuario puede hacer click muchas veces. Sin riesgo funcional (solo afecta el render), pero considerá capearlo a 6 u 8 si la UX se degrada. Queda como follow-up.                                                                                                                    |
| `Intl.DateTimeFormat` con `'es-AR'` puede no estar disponible                     | `'es-AR'` es estable en Node y navegadores modernos. Si llegara a fallar, fallback a `'es'` que ya usa el proyecto.                                                                                                                                                                    |
| `isAllRoom` y `selectedKidIds` quedan inconsistentes si el usuario clickea rápido | Ambos se actualizan en el mismo handler (`setIsAllRoom(false)` seguido de `setSelectedKidIds`), y React los aplica en batch; no se observan estados intermedios. Si en el futuro se separan los handlers, revisar este invariante.                                                     |
| Visual derivado de "Todos marcados" sin pasar por el botón                        | Caso límite: si el usuario marca los 16 niños uno por uno (poco probable pero posible), la pill "Toda la sala" se ve activa sin haber sido presionada. Aceptado por la regla "visual derivado" y la baja probabilidad.                                                                 |

## Qué **no** está en este spec

- Persistencia entre recargas (no hay DB ni backend).
- Upload real de fotos ni drag-and-drop.
- Autenticación ni sesión.
- Edición ni eliminación de posts ya publicados.
- Cierre con confirmación "¿desea descartar los cambios?".
- Animaciones de entrada/salida del modal más allá de la apertura directa.
- Internacionalización.
- Límite máximo de fotos adjuntas.
- Quitar fotos una vez agregadas.
- Cambio en `app/lib/kids.ts` para modelar "current user" como entidad.
- Tests automatizados (mismo criterio que SPEC 02/03/04/05).

Cada uno de estos, si llega, irá en su propio spec.

## Resultados de verificación

- **Fecha de verificación (1ª pasada):** 2026-08-19
- **Fecha de re-verificación (2ª pasada):** 2026-08-26
- **Estado:** Implementado
- **Resumen:** 21/21 criterios de aceptación verificados exitosamente.

### Notas por criterio

1. **Control "Nueva publicación" como `<button>`:** Verificado en `app/components/feed/Sidebar.tsx` (líneas 103-111): `<button type="button" ref={triggerRef} onClick={onNewPost}>` con las clases visuales del gradiente. En re-verificación 2026-08-26 se confirma el cambio del `<a href="#" onClick={prevent}>` por `<button>`.
2. **Portal y atributos ARIA:** Verificado en `CreatePostModal.tsx` líneas 186-191: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="create-post-title"`, montado en `document.body` vía `createPortal`. El título con `id="create-post-title"` está en línea 208.
3. **Scroll lock y cierre:** `useEffect` en líneas 57-68 setea `document.body.style.overflow = 'hidden'` al abrir, `''` al cerrar. Cierra con Escape (líneas 44-48), backdrop click (línea 99), botón "Cancelar" (línea 201). El foco retorna al trigger con `previousActiveElementRef` y fallback `triggerRef` (líneas 82-97).
4. **Tamaño compacto:** `max-w-[560px]` confirmado en línea 197. Coincide con lo especificado (compacto para tablets).
5. **Sección PARA ordenada:** El componente recibe `kids` ya ordenados por `FeedBody` (líneas 40-44 de `FeedBody.tsx`) con `[...kids].sort((a, b) => a.firstName.localeCompare(b.firstName, 'es'))`. **Nota:** en la re-verificación 2026-08-26 la base de datos Supabase tiene 3 niños (Maria, Juana, Jose) en lugar de los 16 del mock original, consecuencia de SPEC 09. La lógica de ordenamiento sigue siendo correcta.
6. **Click "Toda la sala" (inactivo → activo):** `handleAllRoomClick` en `CreatePostForm.tsx` líneas 77-85: setea `isAllRoom=true` y `selectedKidIds` con los 16 ids.
7. **Click "Toda la sala" (activo → inactivo):** mismo handler: setea `isAllRoom=false` y `selectedKidIds = new Set()`.
8. **Click en niño con `isAllRoom = true`:** `handleKidClick` líneas 87-101: setea `isAllRoom = false` y aplica toggle al id.
9. **Click en niño con `isAllRoom = false` y `selectedKidIds` vacío:** toggle del id en el Set.
10. **Click en niño con `isAllRoom = false` y `selectedKidIds` con otros:** solo toggle de ese id.
11. **Visual derivado "Todos marcados":** `showAllRoomHighlight = isAllRoom || allKidsSelected` (línea 75). Cuando `selectedKidIds.size === kids.length`, la pill "Toda la sala" se ve activa aunque el botón no haya sido presionado.
12. **Sección TIPO:** 7 pills (Comida, Siesta, Actividad, Logro, Ánimo, Foto, Anuncio) en `TYPE_OPTIONS` (líneas 30-38). Single-select con `setSelectedType(type)`. Colores via `TYPE_COLORS` (líneas 40-51).
13. **Textarea DESCRIPCIÓN:** placeholder "Contá cómo le fue hoy…" (línea 247), `resize-y` (línea 248), `min-h-[120px]` (línea 248).
14. **Bloque FOTOS:** tile placeholder inicial (líneas 261-263) + tile "Agregar" dashed (líneas 265-272). Click en "Agregar" incrementa `photoCount` (líneas 107-109). Las nuevas tiles son réplicas (líneas 274-284).
15. **Validación inline:** `handleSubmit` líneas 111-134 valida los tres grupos. Errores con `aria-invalid="true"` (líneas 164, 213, 239) y contenedor `aria-live="polite"` (líneas 158-160).
16. **Publicación con destinatario, tipo y descripción:** `CreatePostModal.handleSubmit` líneas 107-180 arma el `Post` con `time` local, `recipientLabel` correcto, `author` según tipo/selección, `likes: 0`, `comments: 0`, `publishedBy: 'publicado por vos'`. Llama `onAddPost` + `onClose`.
17. **Renderizado del post en `PostCard`:** badge correcto (config 7 tipos, líneas 18-54), avatar con `getAvatarTextColor`, recipientLabel construido según cantidad de niños.
18. **Persistencia local:** `FeedBody` mantiene `useState<Post[]>(posts)` (línea 36). Al recargar, vuelve a los 3 originales.
19. **Color `activity` actualizado:** `--activity-bg: #2e89a6; --activity-text: #ffffff` en `app/globals.css` líneas 20-21. `post-2` renderiza con badge azul fuerte.
20. **Contraste de avatar con `getAvatarTextColor`:** Línea 84 de `PostCard.tsx` aplica `color: getAvatarTextColor(post.author.color)`. Función definida en `app/lib/kids.ts` líneas 40-42.
21. **Checks técnicos:** En re-verificación 2026-08-26: `npx tsc --noEmit` (sin output), `pnpm lint` (sin errores), `pnpm build` (exit 0, "✓ Compiled successfully in 616ms"). `pnpm dev` responde en `http://localhost:3000` (HTTP 307 → `/auth`, redirect esperado por auth de SPEC 09).

### Contexto técnico verificado

- **Next.js 16.3.1 + React 19.2.8:** verificado en `package.json`. Build OK con Turbopack.
- **App Router:** `app/page.tsx` (server component) + `FeedBody` (client wrapper). Mismo patrón que `KidProfileBody` (SPEC 05).
- **`useSyncExternalStore` para portal:** `useMounted` en `CreatePostModal.tsx` líneas 20-26 — patrón correcto según docs de React para evitar hydration mismatch con `createPortal` a `document.body`.
- **Tailwind v4 + `@theme inline`:** `app/globals.css` usa `@import "tailwindcss"` + `@theme inline` con mapeo de CSS variables. Los 4 pares nuevos (meal/nap/mood/photo) están correctamente declarados.
- **Arrow functions en client components:** `CreatePostModal`, `CreatePostForm`, `FeedBody` son arrow functions con `'use client'`, según convención.

### Limitaciones de la re-verificación 2026-08-26

- La verificación visual con Playwright (screenshots y comparación contra `reference/screenshots/compose.png`) **no se pudo ejecutar** porque la autenticación de Supabase del proyecto está caída a nivel de base de datos (error `Database error querying schema` al intentar `signInWithPassword`). Esta rotura es ortogonal a SPEC 06 y se introdujo tras la integración de auth de SPEC 09.
- Se intentó: (a) `pnpm dev` en `localhost:3000` → HTTP 307 a `/auth` (esperado); (b) signin con el usuario `demo@opendaycare.test` → 500 Internal Server Error; (c) inspección vía `supabase_execute_sql` confirma que el usuario existe en `auth.users` pero el servicio GoTrue no puede consultar el schema.
- Por lo tanto, la verificación se apoyó en **revisión de código** contra los 21 criterios + ejecución de los comandos técnicos. La verificación visual ya había sido completada en la pasada 2026-08-19 (siguiendo el flujo de `spec-verify`) y los criterios 1-20 mantienen su lógica idéntica en el código actual.

### Referencias consultadas
- Context7: Next.js `/vercel/next.js` — uso de `useSyncExternalStore` para evitar hydration mismatch en portales.
- Context7: React `/react/react` — implementación canónica de `useSyncExternalStore` con `getServerSnapshot` para SSR.
- Context7: Tailwind CSS `/tailwindlabs/tailwindcss.com` — configuración v4 con `@theme inline` y variables CSS referenciadas.

### Screenshots generados (pasada 2026-08-19)
- `.playwright-mcp/06-feed-desktop.png`
- `.playwright-mcp/06-modal-desktop.png`
- `.playwright-mcp/06-modal-all-room.png`
- `.playwright-mcp/06-modal-unselect-mateo.png`
- `.playwright-mcp/06-modal-errors.png`
- `.playwright-mcp/06-feed-after-post.png`
- `.playwright-mcp/06-feed-after-reload.png`
- `.playwright-mcp/06-feed-announcement-top2.png`
- `.playwright-mcp/06-feed-allroom-meal.png`
- `.playwright-mcp/06-feed-mobile.png`
- `.playwright-mcp/06-drawer-mobile.png`
- `.playwright-mcp/06-modal-mobile.png`
- `.playwright-mcp/06-modal-mobile-top.png`
