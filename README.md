# OpenDayCare

Aplicación web para la gestión de guarderías, construida con Next.js y Tailwind CSS.

## Stack

- [Next.js](https://nextjs.org) 16.3.1 (App Router)
- [React](https://react.dev) 19.2.8
- [Tailwind CSS](https://tailwindcss.com) v4
- [TypeScript](https://www.typescriptlang.org) (modo estricto)

## Requisitos

- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io)

## Instalación

```bash
pnpm install
```

## Scripts disponibles

- `pnpm dev` — inicia el servidor de desarrollo en http://localhost:3000
- `pnpm build` — compila la aplicación para producción
- `pnpm start` — inicia la aplicación compilada
- `pnpm lint` — ejecuta ESLint
- `npx tsc --noEmit` — ejecuta el chequeo de tipos

## Estructura del proyecto

```
app/            # Código de la aplicación (App Router)
public/         # Activos estáticos
reference/      # Mockups visuales y capturas del producto objetivo
specs/          # Especificaciones de funcionalidades
```

## Convenciones

- El código (variables, funciones, tipos, archivos y carpetas) se escribe en inglés.
- El texto visible para los usuarios se mantiene en español.
- Se usa `camelCase` para variables y funciones, `PascalCase` para componentes y tipos, y `UPPER_SNAKE_CASE` para constantes.
- El alias `@/*` apunta a la raíz del repositorio.

## Más información

Para conocer más sobre Next.js, consulta la [documentación oficial](https://nextjs.org/docs).
