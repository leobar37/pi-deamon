# Contexto: Re-alineación del Dashboard Web

## Estado Actual

El paquete `packages/dashboard` (publicado como `@earendil-works/pi-web`, binario `pi-web`) **es** la implementación del coding-agent con interfaz web.

### Servidor (`src/server/daemon.ts`)
- `DashboardDaemon` arranca un servidor Bun con oRPC en `/api` y archivos estáticos en `/`.
- `SessionHost` + `LiveSession` gestionan sesiones reales del coding-agent. `LiveSession.start()` llama a `createAgentSession()` de `pi-coding-agent`, obteniendo un `AgentSession` con todo el runtime (modelo, tools, extensiones).
- El CLI `pi-web` arranca el daemon en standalone.

### Problemas identificados
1. **Código viejo de Lion**: `LionDashboardState`, `subagents`, `runHistory`, `planSlug`, `planPath`, `runId`, `taskId` — todo esto es de un sistema de planning/orquestación que ya no existe en el coding-agent actual.
2. **Eventos no declarativos**: `DashboardEventBridge` hace mapeo genérico `rawEvent as Record<string, unknown>` sin esquema ni tipado. No hay un estándar claro de qué eventos se emiten.
3. **Suscripción desordenada**: El `EventPublisher` de oRPC se usa con `publish("*", event)` sin filtros ni estructura. Cada endpoint de streaming reinventa su propio loop con pings.
4. **Frontend desconectado**: Componentes `OrchestratorPanel`, `EventLog`, `EventStream` muestran datos de Lion que no existen. La vista de sesiones (`SessionList`) usa `fetch` directo en vez del cliente oRPC tipado.

### Coding-Agent actual (`packages/coding-agent`)
- `AgentSession` emite eventos tipados (`AgentSessionEvent`) que cubren: `agent_start/end`, `message_start/update/end`, `tool_execution_start/update/end`, `queue_update`, `compaction_start/end`, `model_select`, `thinking_level_changed`, `auto_retry_start/end`, `session_info_changed`.
- `SessionManager` maneja persistencia JSONL y descubrimiento de sesiones en disco.
- La TUI (terminal) muestra un sidebar con proyectos (cwd) y sesiones, más un área de chat — esto es lo que el usuario quiere replicar en el dashboard web.

## Objetivo

Limpiar el dashboard: eliminar código de Lion, establecer un estándar de eventos declarativo con suscripción SSE, y rehacer el frontend con un sidebar de proyectos/sesiones + chat streaming.
