# Tarea 6: Vista de chat con streaming (frontend)

## Objetivo
Mostrar el historial de mensajes de una sesión y el streaming en vivo, incluyendo tool calls y resultados.

## Criterios de aceptación

- [ ] Área principal de chat con:
  - Mensajes del usuario: alineados a la derecha, fondo `blue-900/50`.
  - Mensajes del assistant: alineados a la izquierda, fondo `gray-800`.
    - Texto renderizado como markdown (código con syntax highlighting).
    - Tool calls: tarjeta expandible con nombre de tool, args JSON, y resultado.
    - Thinking blocks (si el modelo los soporta): renderizado como bloque colapsable con estilo distintivo.
  - Mensajes custom (compaction, retry, cambio de modelo): notificaciones inline sutiles.
- [ ] Streaming en vivo:
  - El texto del assistant aparece chunk por chunk a medida que llegan eventos `message_update` del SSE.
  - No recargar todo el mensaje; acumular contenido incrementalmente.
- [ ] Indicadores de estado:
  - Spinner "Pensando..." durante `agent_start` sin `message_start`.
  - Badge "Compactando..." durante `compaction_start`.
  - Badge "Reintentando (2/3)..." durante `auto_retry_start`.
  - Lista de mensajes en cola (steering / follow-up) como chips encima del input.
- [ ] Scroll:
  - Auto-scroll al fondo cuando llegan nuevos mensajes.
  - Si el usuario se desplaza hacia arriba, pausar auto-scroll hasta que vuelva al fondo.
- [ ] Cargar historial inicial via `sessions.messages.get` y luego suscribirse a `events.stream?sessionId=xxx` para updates.
- [ ] Header de la sesión mostrando: nombre, modelo actual, botón start/stop.

## Archivos a crear
- `packages/dashboard/frontend/src/components/ChatView.tsx`
- `packages/dashboard/frontend/src/components/MessageItem.tsx`
- `packages/dashboard/frontend/src/components/ToolCallCard.tsx`
- `packages/dashboard/frontend/src/components/StatusIndicators.tsx`
- `packages/dashboard/frontend/src/components/MarkdownRenderer.tsx`
- `packages/dashboard/frontend/src/store/chat.ts` (Zustand store para estado del chat)

## Archivos a modificar
- `packages/dashboard/frontend/src/App.tsx`

## Notas
- Para syntax highlighting, usar `react-markdown` + `refractor` (prism) o `shiki`. Mantener bundle razonable.
- Los tool calls deben ser visualmente diferenciables: borde `amber-500/30`, icono de herramienta.
- El store de chat debe manejar mensajes parciales durante streaming: un mensaje en estado "streaming" se va actualizando hasta que llega `message_end`.
