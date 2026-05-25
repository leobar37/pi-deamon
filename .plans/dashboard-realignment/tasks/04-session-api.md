# Tarea 4: Unificar y tipar la API de sesiones

## Objetivo
Alinear los endpoints de sesiones con el modelo real del coding-agent, eliminando inconsistencias y usando el cliente oRPC tipado en el frontend.

## Criterios de aceptación

- [ ] Endpoint `sessions.list`: devuelve sesiones desde `SessionManager.list(cwd)` + estado runtime enriquecido (si está activa). Schema Zod tipado.
- [ ] Endpoint `sessions.get`: devuelve info completa de una sesión por ID.
- [ ] Endpoint `sessions.create`: crea nueva sesión en disco y la registra.
- [ ] Endpoint `sessions.continueRecent`: continúa la sesión más reciente del cwd.
- [ ] Endpoint `sessions.start`: inicia el runtime del agente para la sesión (ya implementado en `SessionHost`, pero verificar que construye runtime completo).
- [ ] Endpoint `sessions.stop`: detiene el runtime y persiste.
- [ ] Endpoint `sessions.remove`: elimina del host y del disco.
- [ ] Endpoint `sessions.prompt`: envía prompt a sesión activa.
- [ ] Endpoints `sessions.steer`, `sessions.followUp`, `sessions.abort`: funcionan sobre sesión activa.
- [ ] Endpoint `sessions.state.get`: devuelve estado del runtime.
- [ ] Endpoint `sessions.messages.get`: devuelve mensajes (de runtime si activo, de disco si no).
- [ ] Todos los endpoints usan schemas Zod para input y output.
- [ ] El frontend usa el cliente oRPC tipado (`orpc.sessions.list()`) en lugar de `fetch` directo.
- [ ] Exportar el tipo `DashboardRouter` actualizado para que el frontend tenga tipado completo.

## Archivos a modificar
- `packages/dashboard/src/procedures/session.ts` (refactorizar)
- `packages/dashboard/src/procedures/schemas.ts` (actualizar)
- `packages/dashboard/src/procedures/index.ts` (actualizar router)
- `packages/dashboard/frontend/src/orpc.ts` (tipar correctamente con todos los endpoints)
- `packages/dashboard/frontend/src/components/SessionList.tsx` (usar oRPC en lugar de fetch)

## Notas
- Los endpoints ya existen en `session.ts`; la tarea es principalmente de alineación y tipado.
- `SessionHost` y `LiveSession` ya tienen el runtime real. Verificar que `LiveSession.start()` pasa las opciones correctas (modelo, tools, etc.) al `createAgentSession`.
- El `EventStreamProvider` de la tarea 3 debe estar disponible para que el frontend pueda suscribirse a eventos de sesión.
