# Tarea 3: Provider de suscripción SSE con filtros

## Objetivo
Reemplazar `DashboardEventBridge` y los loops de streaming ad-hoc por un provider de suscripción declarativo con SSE, soportando filtros por sesión y tipo de evento.

## Criterios de aceptación

- [ ] Crear `packages/dashboard/src/events/provider.ts` con clase `EventStreamProvider`:
  - `subscribe(filters: { sessionId?: string; eventTypes?: string[] }): AsyncIterableIterator<ServerEvent>`
  - `publish(event: ServerEvent): void` — distribuye a todos los subscribers que pasan el filtro.
  - `pingIntervalMs: number` — envía eventos `ping` periódicamente a conexiones inactivas.
  - `getSubscriberCount(): number`
- [ ] Los filtros deben funcionar así:
  - Sin `sessionId`: recibe eventos de todas las sesiones + eventos del sistema.
  - Con `sessionId`: solo eventos de esa sesión.
  - Con `eventTypes`: solo eventos cuyo `type` esté en la lista.
- [ ] Integrar `EventStreamProvider` en `DashboardDaemon`:
  - Reemplazar `DashboardEventBridge` por `EventStreamProvider`.
  - Cuando una sesión arranca (`LiveSession.start()`), suscribirse a `agentSession.subscribe()` y forwardar eventos serializados al provider.
  - Cuando la sesión se detiene, desuscribirse.
- [ ] Crear endpoint oRPC único `events.stream` que acepte `input: { sessionId?: string; eventTypes?: string[] }` y devuelva `AsyncIterableIterator<ServerEvent>` via `@orpc/server/eventIterator`.
  - Eliminar el endpoint `dashboard.events.stream` anterior.
  - Eliminar el endpoint `sessions.events.stream` anterior (o unificarlo en este).
- [ ] Limpiar correctamente subscribers al abortar la conexión (usar `AbortSignal` del handler oRPC).

## Archivos a crear
- `packages/dashboard/src/events/provider.ts`

## Archivos a modificar
- `packages/dashboard/src/server/daemon.ts`
- `packages/dashboard/src/session/live-session.ts` (conectar con provider en lugar de `EventPublisher`)
- `packages/dashboard/src/session/host.ts` (pasar provider al crear sesiones)
- `packages/dashboard/src/procedures/dashboard.ts` (reemplazar streaming por nuevo endpoint)
- `packages/dashboard/src/procedures/session.ts` (eliminar streaming ad-hoc)
- `packages/dashboard/src/bridge.ts` (eliminar)

## Notas
- `@orpc/server` tiene `eventIterator` que ya soporta SSE. Reutilizarlo.
- El `EventPublisher` de oRPC usado actualmente en `LiveSession` y `DashboardEventBridge` debe ser reemplazado completamente por `EventStreamProvider`.
- El frontend usará `EventSource` nativo o un wrapper sobre el cliente oRPC para consumir SSE.
