# F-007: Integración de estados sutiles en chat

## Objective

Reemplazar la barra de estado intrusiva (`StatusIndicators`) por indicadores sutiles integrados en el header de conversación y el área de input.

## Scope Boundaries

### In scope
- Integrar indicadores de estado en `ChatHeader`: dot de estado (idle/streaming/compacting), contador de mensajes en cola.
- Integrar indicador de streaming en `ChatInput`: spinner sutil cerca del botón de enviar.
- Eliminar o reducir `StatusIndicators` a un componente mínimo o integrarlo completamente.
- Mantener toda la información visible: streaming, compaction, retry, queue.

### Out of scope
- Nuevos estados o eventos — solo reorganizar UI existente.

## Verified Context

- `StatusIndicators.tsx` actual muestra: streaming, compaction, retry, queue.
- `ChatHeader` (F-003) tendrá espacio para indicadores.
- `ChatInput` (F-006) tendrá espacio para indicador de streaming.

## Assumptions

- Toda la información de estado cabe en el header + input sin saturar.

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/src/components/StatusIndicators.tsx` | Modify/Delete | Integrar en otros componentes |
| `packages/dashboard/frontend/src/components/ChatHeader.tsx` | Modify | Agregar indicadores de estado |
| `packages/dashboard/frontend/src/components/ChatInput.tsx` | Modify | Agregar indicador de streaming |
| `packages/dashboard/frontend/src/components/ChatView.tsx` | Modify | Remover StatusIndicators bar |

## Dependencies

- F-003 (Header de conversación) — necesita el header existente.
- F-006 (ChatInput rediseñado) — necesita el input rediseñado.

## Parallelization

- Must wait for F-003 and F-006.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`simple` — reorganización de UI existente.
