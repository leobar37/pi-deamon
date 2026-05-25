# F-003: Header de conversación editable

## Objective

Agregar un header en el área de chat que muestre el título de la conversación actual, permita editarlo, y contenga controles de sesión (start/stop, modelo, opciones).

## Scope Boundaries

### In scope
- Crear componente `ChatHeader` con:
  - Título de sesión (editable on click).
  - Indicador de estado de la sesión (idle, streaming, etc.).
  - Botones de control: Start/Stop runtime.
  - Selector de modelo (placeholder si no hay API aún).
- Integrar en `ChatView` reemplazando o complementando `StatusIndicators`.

### Out of scope
- Persistencia del nombre de sesión editado (requeriría cambio de backend).
- Selector de modelo funcional (solo UI).

## Verified Context

- `ChatView.tsx` actual tiene `StatusIndicators` como barra sobre los mensajes.
- El store tiene `getActiveSession()` que retorna `SessionEntry` con `info.name`.
- El orpc client tiene `sessions.start`, `sessions.stop`.

## Assumptions

- El nombre de sesión se puede editar localmente en el frontend sin persistir.
- Los controles start/stop ya funcionan via orpc.

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/src/components/ChatHeader.tsx` | Create | Nuevo componente de header |
| `packages/dashboard/frontend/src/components/ChatView.tsx` | Modify | Integrar ChatHeader |
| `packages/dashboard/frontend/src/components/StatusIndicators.tsx` | Modify/Delete | Integrar en header o eliminar |

## Dependencies

- F-001 (Tema oscuro refinado) — para estilos consistentes.

## Parallelization

- Can be done in parallel with F-002, F-004, F-006 after F-001.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`simple` — componente nuevo + integración leve.
