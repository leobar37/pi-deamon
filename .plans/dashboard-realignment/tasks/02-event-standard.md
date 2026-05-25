# Tarea 2: Estándar declarativo de eventos del servidor

## Objetivo
Definir un contrato tipado y serializable de eventos que el servidor emite al frontend, como mapeo directo de `AgentSessionEvent` del coding-agent.

## Criterios de aceptación

- [ ] Crear `packages/dashboard/src/events/types.ts` con union type `ServerEvent` que cubra:
  - Lifecycle de sesión: `session_created`, `session_started`, `session_stopped`, `session_removed`
  - Agent: `agent_start`, `agent_end`
  - Mensajes: `message_start`, `message_update`, `message_end`
  - Tools: `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
  - Queue: `queue_update`
  - Compaction: `compaction_start`, `compaction_end`
  - Modelo: `model_select`, `thinking_level_changed`
  - Retry: `auto_retry_start`, `auto_retry_end`
  - Info: `session_info_changed`
  - Ping: `ping` (keep-alive)
- [ ] Cada evento tiene: `type: string`, `sessionId: string`, `timestamp: number`, y payload específico.
- [ ] Crear schemas Zod para cada evento en `packages/dashboard/src/events/schemas.ts`.
- [ ] Crear función `serializeAgentSessionEvent(event: AgentSessionEvent, sessionId: string): ServerEvent` que convierta eventos internos a eventos de red.
- [ ] Exportar tipos desde `packages/dashboard/src/index.ts` (type-only) para que el frontend los consuma.
- [ ] El payload debe ser plano y serializable a JSON (no funciones, no instancias de clase, no ciclos).

## Archivos a crear
- `packages/dashboard/src/events/types.ts`
- `packages/dashboard/src/events/schemas.ts`
- `packages/dashboard/src/events/serialize.ts`

## Archivos a modificar
- `packages/dashboard/src/index.ts`

## Notas
- No inventar eventos nuevos; mapear directamente desde `AgentSessionEvent`.
- Los mensajes (`message_start`, `message_update`, `message_end`) contienen objetos `AgentMessage` que deben serializarse completamente.
- Los eventos de tool execution contienen `args` y `result` que ya son JSON-friendly.
