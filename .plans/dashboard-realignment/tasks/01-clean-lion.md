# Tarea 1: Limpiar código huérfano de Lion del servidor

## Objetivo
Eliminar todo el código relacionado con Lion (planning/orquestación) que ya no existe en el coding-agent actual.

## Criterios de aceptación

- [ ] Eliminar `LionDashboardState` de `src/procedures/dashboard.ts` y `src/procedures/schemas.ts`.
- [ ] Eliminar campos `runId`, `planSlug`, `planPath`, `taskId`, `attempt` de `DashboardEventPayload` y `DashboardEventPayloadSchema`.
- [ ] Eliminar `source: "lion" | "subagent"` de `DashboardEventPayload`; reemplazar por `sessionId?: string` para asociar eventos a sesiones.
- [ ] Quitar `getLionState` y `setLionStateGetter` de `DashboardDaemon`.
- [ ] Quitar `DashboardEventBridge` (o refactorizarlo drásticamente); eliminar la suscripción genérica a `GenericEventBus`.
- [ ] Actualizar `createDashboardRouter` para que ya no reciba `getLionState`.
- [ ] Actualizar `src/index.ts` para que ya no exporte tipos de Lion.
- [ ] Verificar que no queden referencias a "lion", "subagent", "plan", "run", "task" en `packages/dashboard/src/`.

## Archivos a modificar
- `packages/dashboard/src/procedures/dashboard.ts`
- `packages/dashboard/src/procedures/schemas.ts`
- `packages/dashboard/src/procedures/index.ts`
- `packages/dashboard/src/server/daemon.ts`
- `packages/dashboard/src/bridge.ts`
- `packages/dashboard/src/types.ts`
- `packages/dashboard/src/index.ts`

## Notas
- Esto es destrucción controlada. No reemplazar nada todavía, solo eliminar lo que no sirve.
- Los tests (`daemon.test.ts`, `router.test.ts`) probablemente fallen tras esto; anotarlos para arreglar en tareas posteriores.
