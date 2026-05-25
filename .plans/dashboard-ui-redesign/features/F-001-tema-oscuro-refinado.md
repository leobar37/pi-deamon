# F-001: Tema oscuro refinado y estilos base

## Objective

Establecer la foundation visual del dashboard: paleta de colores, tipografía, espaciado, y variables CSS que todos los demás componentes usarán. Transformar el tema de "gris/azul genérico" a "negro puro con grises sutiles" al estilo ChatGPT/Claude.

## Scope Boundaries

### In scope
- Redefinir paleta de colores en `index.css` (Tailwind v4 `@theme`).
- Configurar tipografía base (tamaños, pesos, alturas de línea).
- Definir variables para: fondos, texto, bordes, acentos, estados.
- Ajustar `App.tsx` para usar los nuevos colores base.

### Out of scope
- Cambios de layout (sidebar, chat view) — eso es F-002/F-003.
- Nuevos componentes — eso son features posteriores.
- Cambios de backend.

## Verified Context

- Tailwind v4 se usa con `@import "tailwindcss"` en `index.css`.
- No hay `tailwind.config.js`; la configuración va en CSS con `@theme`.
- El layout actual usa clases como `bg-gray-950`, `text-gray-100`, `border-gray-800`.

## Assumptions

- Tailwind v4 soporta `@theme` para custom properties.
- Los cambios de color no rompen funcionalidad existente.

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/src/index.css` | Modify | Redefinir `@theme` con nueva paleta |
| `packages/dashboard/frontend/src/App.tsx` | Modify | Ajustar colores base del layout |

## Dependencies

- None (foundation feature).

## Parallelization

- Blocks F-002, F-003, F-004, F-006.
- Can be worked on independently.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`simple` — cambios localizados a CSS y un ajuste en App.tsx.
