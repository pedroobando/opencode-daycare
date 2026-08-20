# OpenDayCare

Aplicación web para la gestión de guarderías, construida con Next.js y Tailwind CSS. La UI replica los mockups visuales de `reference/pantallas/` y todo el texto visible para el usuario está en español.

## Stack

- [Next.js](https://nextjs.org) 16.3.1 (App Router, typed routes)
- [React](https://react.dev) 19.2.8
- [Tailwind CSS](https://tailwindcss.com) v4 — `@import "tailwindcss"` + `@theme inline`, plugin PostCSS `@tailwindcss/postcss`
- [TypeScript](https://www.typescriptlang.org) (modo estricto)
- ESLint flat config (`eslint-config-next/core-web-vitals` + `typescript`)

## Requisitos

- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io) — usar siempre `pnpm` aunque exista `package-lock.json`; el lockfile del proyecto es `pnpm-lock.yaml`.

## Instalación

```bash
pnpm install
```

## Scripts disponibles

- `pnpm dev` — inicia el servidor de desarrollo en http://localhost:3000.
- `pnpm build` — compila la aplicación para producción.
- `pnpm start` — inicia la aplicación ya compilada (requiere `pnpm build` previo).
- `pnpm lint` — ejecuta ESLint.
- `npx tsc --noEmit` — chequeo de tipos con la configuración de `tsconfig.json` (no hay script `typecheck`).

> No hay framework de tests configurado. Antes de añadir uno (jest, vitest, playwright-test, etc.), consultar con el equipo.

## Estructura del proyecto

```
app/                          # Código de la aplicación (App Router)
  auth/                       # Pantallas de autenticación (login, activar cuenta, etc.)
  kids/                       # Listado y perfil de niños (rutas dinámicas con [id])
  components/                 # Componentes reutilizables agrupados por dominio (feed, auth, kids)
  lib/                        # Datos mockeados estáticos (posts, kids)
  utils/                      # Utilidades puras (colores, slugify, email, random-code)
  layout.tsx, page.tsx, globals.css, favicon.ico
public/                       # Activos estáticos
reference/
  pantallas/*.dc.html         # Mockups HTML del producto objetivo (sólo docs)
  support.js                  # Generado por dc-runtime — NO editar
  screenshots/*.png           # Capturas de los mockups
specs/                        # Especificaciones de pantallas y funcionalidades
  NN-slug.md                  # Specs numeradas en orden cronológico (kebab-case)
  .spec-config.yml            # Configuración del flujo spec-driven
.playwright-mcp/              # Capturas del MCP de Playwright (gitignored)
```

## Convenciones

- **Identificadores en inglés:** todas las variables, funciones, constantes, clases, tipos, interfaces, enums, archivos y carpetas se nombran en inglés.
- **UI copy en español:** sólo el texto visible para el usuario (etiquetas, mensajes, etc.) permanece en español.
- **Naming casing:**
  - `camelCase` para variables, funciones, hooks y métodos de instancia.
  - `PascalCase` para componentes React, tipos, interfaces, clases y enums.
  - `UPPER_SNAKE_CASE` para constantes reales y claves de variables de entorno.
- **Funciones:** las helpers, handlers y componentes reutilizables se declaran como arrow functions. Los route roots (`page.tsx`, `layout.tsx`, `not-found.tsx`, etc.) pueden declararse como `function` regular.
- **Alias de importación:** `@/*` apunta a la raíz del repositorio (definido en `tsconfig.json` → `paths: { "@/*": ["./*"] }`), no a `./src/`.
- **Tailwind v4:** usar `@import "tailwindcss"` y `@theme inline`. No añadir directivas v3 (`@tailwind base/components/utilities`).
- **Comentarios:** todos los comentarios inline, JSDoc/TSDoc y notas de documentación se escriben en inglés.
- **Sin valores mágicos:** extraer literales repetidos a constantes con nombre descriptivo.

## Notas

- En el repositorio conviven `package-lock.json` y `pnpm-lock.yaml`. Usar siempre `pnpm`; el lockfile válido es `pnpm-lock.yaml`.
- `pnpm-workspace.yaml` habilita el build de `unrs-resolver` (`allowBuilds.unrs-resolver: true`). No eliminar.
- `.next/`, `.playwright-mcp/`, `next-env.d.ts` y `*.tsbuildinfo` están en `.gitignore` y se regeneran automáticamente.
- `reference/pantallas/support.js` se regenera por una herramienta externa (`dc-runtime`); su cabecera indica explícitamente que no debe editarse.
- El bloque `BEGIN:nextjs-agent-rules` que aparece al inicio de `AGENTS.md` lo reescribe `next dev`; mantenerlo o commitearlo de forma limpia, no suprimirlo.
- No hay CI, pre-commit hooks ni Husky configurados. La disciplina de lint/typecheck es manual.

## Más información

- Reglas completas del proyecto, convenciones de clean code y guía de agentes en [`AGENTS.md`](./AGENTS.md).
- Para crear una nueva spec, usar el comando `/spec <descripción>`; las specs se guardan en `specs/` con el formato `NN-slug.md`.
- Documentación oficial de [Next.js](https://nextjs.org/docs).