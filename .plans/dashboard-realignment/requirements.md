# Requisitos

## Funcionales

1. **Eliminar código huérfano de Lion**
   - Quitar `LionDashboardState`, `subagents`, `runHistory`, `planSlug`, `planPath`, `runId`, `taskId` del servidor y del frontend.
   - Quitar `DashboardEventBridge` y sus referencias a `source: "lion" | "subagent"`.
   - Quitar componentes del frontend que muestran datos de Lion (`OrchestratorPanel`, `EventLog` genérico).

2. **Estándar declarativo de eventos del servidor**
   - Definir `ServerEvent` como union tipada de todos los eventos que el servidor puede emitir al frontend.
   - El esquema debe ser un mapeo directo y tipado de `AgentSessionEvent` a JSON serializable.
   - Cada evento tiene: `type`, `sessionId`, `timestamp`, y payload específico.
   - Validación Zod en los endpoints oRPC para inputs y outputs.

3. **Provider de suscripción SSE declarativo**
   - Reemplazar `DashboardEventBridge` por `EventStreamProvider` que:
     - Acepte suscriptores con filtros: `sessionId?: string`, `eventTypes?: string[]`.
     - Emita eventos tipados (`ServerEvent`) desde las sesiones activas.
     - Soporte stream global (todos los eventos del sistema) y stream por sesión.
     - Envíe pings cada 5s para mantener la conexión viva.
   - Unificar los endpoints de streaming: un solo endpoint `events.stream` con filtros, en lugar de múltiples loops ad-hoc.

4. **API de sesiones alineada con el coding-agent actual**
   - Endpoints CRUD de sesiones (`list`, `create`, `get`, `remove`, `open`, `continueRecent`).
   - Lifecycle del runtime (`start`, `stop`).
   - Interacción (`prompt`, `steer`, `followUp`, `abort`).
   - Estado (`state.get`, `messages.get`).
   - Eventos (`events.stream` con `sessionId`).
   - Todos los endpoints usan schemas Zod y el cliente oRPC tipado.

5. **Dashboard con listado de sesiones estilo TUI**
   - Sidebar izquierdo con:
     - Acciones globales: Nuevo chat, Buscar, Configuración.
     - Agrupación por proyecto (cwd): cada proyecto expande para mostrar sus sesiones.
     - Cada sesión muestra: nombre, indicador de estado, conteo de mensajes, timestamp relativo.
   - Click en sesión navega al chat de esa sesión.
   - Estado en tiempo real via SSE (sin polling).
   - Diseño responsive (sidebar colapsable).

6. **Vista de chat con streaming en tiempo real**
   - Área principal con historial de mensajes (usuario, assistant, tool calls, custom).
   - Streaming en vivo: texto aparece chunk por chunk via eventos `message_update`.
   - Tool calls renderizados como tarjetas expandibles.
   - Indicadores de estado: streaming, compaction, retry, queue.
   - Scroll automático con posibilidad de pausa.

7. **Controles de sesión**
   - Input de prompt (textarea auto-expandible, Enter para enviar, Shift+Enter para nueva línea).
   - Botón Abort durante streaming.
   - Visualización de mensajes en cola (steering / follow-up).
   - Selector de modelo en la barra de la sesión.
   - Botones Start/Stop del runtime.

## No funcionales

- Solo `localhost` (`127.0.0.1`), sin autenticación remota.
- SPA estática servida por el mismo servidor Bun.
- API oRPC tipada; el frontend usa el cliente oRPC exclusivamente (no `fetch` directo).
- Tipado estricto: no `any` types, no inline imports.
