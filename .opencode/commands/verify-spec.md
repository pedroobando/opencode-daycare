---
description: Verifica los criterios de aceptación de un spec.
agent: spec-verifier
---

Verifica los criterios de aceptación del spec `$ARGUMENTS`.

Si `$ARGUMENTS` es solo el slug (por ejemplo `01-feed-home`), trátalo como `specs/01-feed-home.md`. Si es una ruta absoluta o relativa, úsala directamente.

Sigue tu flujo de trabajo:
1. Lee el spec.
2. Revisa cada criterio de aceptación.
3. Usa Context7 para verificar recomendaciones de Next.js / App Router / Tailwind v4.
4. Usa Playwright para navegar, tomar screenshots y comparar pantallas contra `reference/screenshots/` con tu capacidad de visión.
5. Ejecuta los comandos técnicos necesarios (`pnpm dev`, `pnpm build`, `pnpm lint`, `npx tsc --noEmit`).
6. Marca los checks en el spec y agrega una sección de resultados.
7. Reporta el resumen final al usuario.
