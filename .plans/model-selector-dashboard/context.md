# Contexto: Selector de Modelos en Pi Dashboard

## Aplicación
`packages/dashboard` es una aplicación desktop con Electron que expone un servidor HTTP embebido (Bun) y un frontend React (Vite + Tailwind + Jotai). La comunicación fluye por HTTP: oRPC para request/response y SSE para streaming de eventos.

## Objetivo
Agregar al dashboard la capacidad de:
1. Listar modelos disponibles (filtrados por autenticación configurada)
2. Ver el modelo actualmente activo en una sesión
3. Cambiar el modelo de una sesión en caliente
4. Mostrar un selector de modelos en la UI del composer (ChatHeader)

## Arquitectura relevante
- **Backend oRPC**: `packages/dashboard/src/procedures/session.ts` define todos los endpoints de sesión
- **SessionHost**: `packages/dashboard/src/session/host.ts` orquesta sesiones
- **LiveSession**: `packages/dashboard/src/session/live-session.ts` envuelve `AgentSession` del coding-agent
- **AgentSession** (coding-agent): ya expone `setModel()`, `model` getter, y emite evento SSE `model_select`
- **ModelRegistry** (coding-agent): `packages/coding-agent/src/core/model-registry.ts` tiene `getAvailable()`, `find()`, `getAll()`
- **Frontend store**: Jotai + ReactiveMaps en `packages/dashboard/frontend/src/store/`
- **Event handlers**: `packages/dashboard/frontend/src/store/event-handlers/index.ts` actualmente ignora `model_select` (`explicitNoOps`)
- **ChatHeader**: `packages/dashboard/frontend/src/components/ChatHeader.tsx` tiene un área derecha vacía lista para controles

## Restricciones
- No modificar `packages/ai/src/models.generated.ts` directamente
- Usar Bun para scripts del repo
- Seguir convenciones existentes de oRPC, Zod, Jotai, y Tailwind
- `bun run check` debe pasar después de los cambios