# F-005: Bloques de código y HTTP formateados

## Objective

Extender el renderizado de markdown para soportar bloques de código con syntax highlighting básico y bloques HTTP formateados (method, URL, status, headers, body).

## Scope Boundaries

### In scope
- Syntax highlighting básico para bloques de código usando `highlight.js` o solución ligera.
- Componente `CodeBlock` con: lenguaje detectado, botón de copiar, estilos oscuros.
- Componente `HttpBlock` para bloques HTTP: formatear method, URL, status code, headers, body.
- Integrar ambos en `MarkdownRenderer` via custom renderers.

### Out of scope
- Syntax highlighting completo para todos los lenguajes (solo populares: js, ts, json, bash, http).
- Editor de código interactivo.

## Verified Context

- F-004 creará el `MarkdownRenderer` base.
- Los mensajes del asistente a veces contienen bloques de código (```) y bloques HTTP.

## Assumptions

- `react-markdown` permite custom renderers para `code` elements.
- `highlight.js` tiene temas oscuros built-in.

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/package.json` | Modify | Agregar highlight.js |
| `packages/dashboard/frontend/src/components/CodeBlock.tsx` | Create | Bloques de código |
| `packages/dashboard/frontend/src/components/HttpBlock.tsx` | Create | Bloques HTTP |
| `packages/dashboard/frontend/src/components/MarkdownRenderer.tsx` | Modify | Integrar custom renderers |

## Dependencies

- F-004 (Markdown en mensajes) — necesita el renderer base.

## Parallelization

- Must wait for F-004 to complete.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`simple` — extensión del renderer existente.
