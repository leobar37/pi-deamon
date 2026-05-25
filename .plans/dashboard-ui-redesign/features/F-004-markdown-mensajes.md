# F-004: Renderizado de markdown en mensajes

## Objective

Permitir que los mensajes del asistente se rendericen con formato markdown: listas, negritas, enlaces, párrafos, etc. Actualmente todo se muestra como texto plano con `whitespace-pre-wrap`.

## Scope Boundaries

### In scope
- Integrar librería de markdown rendering (ej: `marked` + `DOMPurify`, o `react-markdown`).
- Crear componente `MarkdownRenderer` que reciba string markdown y retorne JSX seguro.
- Modificar `MessageItem` para usar `MarkdownRenderer` en mensajes del asistente.
- Soporte para: párrafos, listas (ul/ol), negritas, itálicas, código inline, enlaces, blockquotes.

### Out of scope
- Syntax highlighting en bloques de código — eso es F-005.
- Bloques HTTP formateados — eso es F-005.
- Markdown en mensajes de usuario (se mantienen como texto plano).

## Verified Context

- `MessageItem.tsx` renderiza mensajes del asistente con `whitespace-pre-wrap`.
- Los mensajes vienen del backend como strings o arrays de content parts.
- El frontend usa React 19 + Vite.

## Assumptions

- Se puede agregar una dependencia de markdown sin problemas de bundle size.
- `react-markdown` es compatible con React 19 (verificar antes).

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/package.json` | Modify | Agregar dependencia markdown |
| `packages/dashboard/frontend/src/components/MarkdownRenderer.tsx` | Create | Nuevo componente |
| `packages/dashboard/frontend/src/components/MessageItem.tsx` | Modify | Usar MarkdownRenderer |

## Dependencies

- F-001 (Tema oscuro refinado) — para estilos de elementos markdown.

## Parallelization

- Can be done in parallel with F-002, F-003, F-006 after F-001.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`simple` — integración de librería + componente wrapper.
