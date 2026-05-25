# F-006: ChatInput rediseñado con controles

## Objective

Rediseñar el input de chat para que sea más limpio, moderno, y con controles adicionales: selector de modelo, indicador de modo steer, y mejor UX visual.

## Scope Boundaries

### In scope
- Rediseñar estilos de `ChatInput`: bordes más sutiles, mejor placeholder, integración visual con el tema.
- Agregar selector de modelo (dropdown) si hay espacio.
- Mejorar indicador de modo steer: chip sutil en lugar de cambiar todo el placeholder.
- Agregar accesos rápidos: botón de adjuntar (placeholder), botón de micrófono (placeholder).
- Mantener funcionalidad existente: Enter envía, Shift+Enter nueva línea, auto-resize, abort.

### Out of scope
- Funcionalidad real de adjuntar archivos.
- Funcionalidad real de voz.
- Selector de modelo funcional (solo UI).

## Verified Context

- `ChatInput.tsx` actual tiene textarea auto-expandible, botón de enviar, botón de abort.
- Usa `useChatStore` para `isStreaming`, `pendingSteering`, `pendingFollowUp`.
- Usa `orpc.sessions.prompt`, `orpc.sessions.steer`, `orpc.sessions.abort`.

## Assumptions

- El layout puede acomodar un selector de modelo sin romper el diseño responsive.

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/src/components/ChatInput.tsx` | Rewrite | Nuevo diseño y controles |

## Dependencies

- F-001 (Tema oscuro refinado) — para estilos consistentes.

## Parallelization

- Can be done in parallel with F-002, F-003, F-004 after F-001.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`simple` — rediseño de un componente existente.
