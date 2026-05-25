# Tarea 7: Controles de sesión: prompt, steer, abort (frontend)

## Objetivo
Permitir al usuario interactuar con una sesión activa desde el frontend: enviar prompts, steer, follow-up, abortar, cambiar modelo.

## Criterios de aceptación

- [ ] Input de texto en la parte inferior del chat:
  - `textarea` auto-expandible (crece hasta 5 líneas).
  - `Enter` envía el mensaje; `Shift+Enter` inserta nueva línea.
  - Placeholder contextual: "Escribe un mensaje..." (idle), "Enviar steer..." (streaming).
  - Botón de envío con icono (paper plane) al lado derecho.
- [ ] Durante streaming (`agent_start` sin `agent_end`):
  - Input automáticamente se convierte en modo "steer": envía `steer` en lugar de `prompt`.
  - Botón "Abort" visible junto al input (icono de cuadrado/stop).
  - Click en Abort llama a `sessions.abort`.
- [ ] Cola de mensajes pendientes:
  - Mostrar chips encima del input con los mensajes en cola (steering / follow-up).
  - Evento `queue_update` del SSE actualiza esta lista en tiempo real.
- [ ] Comandos slash (`/`):
  - Detectar cuando el input empieza con `/` y mostrar un dropdown de comandos disponibles.
  - `/compact`, `/model`, `/session`, `/clear`, etc. deben enviarse como prompts normales (el servidor expande templates y skills).
  - Comandos de extensión registrados deben listarse dinámicamente.
- [ ] Selector de modelo:
  - Dropdown en la barra superior de la sesión.
  - Lista de modelos disponibles obtenida del servidor (endpoint `models.list` o desde el estado de la sesión).
  - Cambio de modelo llama a `session.setModel` (o equivalente).
- [ ] Botones de lifecycle:
  - "Start" para iniciar runtime si la sesión está stopped.
  - "Stop" para detener runtime si está activo.

## Archivos a crear
- `packages/dashboard/frontend/src/components/ChatInput.tsx`
- `packages/dashboard/frontend/src/components/CommandPalette.tsx` (dropdown de comandos slash)
- `packages/dashboard/frontend/src/components/ModelSelector.tsx`
- `packages/dashboard/frontend/src/components/QueueChips.tsx`

## Archivos a modificar
- `packages/dashboard/frontend/src/store/chat.ts` (acciones de envío, steer, abort)
- `packages/dashboard/frontend/src/orpc.ts` (endpoints de control)

## Notas
- Los comandos slash requieren que el servidor expanda templates y skills. Esto ya está soportado por `AgentSession.prompt()` si se pasa `expandPromptTemplates: true` (que es el default). El frontend solo envía el texto; el servidor hace el resto.
- El cambio de modelo puede requerir un nuevo endpoint o usar `sessions.prompt` con `/model <nombre>`.
- Considerar atajos de teclado: `Ctrl+C` para abortar durante streaming.
