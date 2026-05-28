# Requisitos

## R1: Endpoint backend para listar modelos
- Nuevo endpoint `sessions.models.list` que retorne modelos disponibles (con auth configurada) usando `ModelRegistry.getAvailable()`
- Cada modelo debe incluir: `provider`, `id`, `name`, `api`, `reasoning`
- Si se pasa `sessionId`, incluir el modelo actual de esa sesión en la respuesta

## R2: Endpoint backend para cambiar modelo
- Nuevo endpoint `sessions.models.set` que reciba `sessionId`, `provider`, `modelId`
- Validar que el modelo existe y tiene auth configurada
- Llamar `liveSession.setModel(model)` → `agentSession.setModel(model)`
- Retornar `{ success: true }`

## R3: Exponer modelo en LiveSession/SessionHost
- Agregar `getModel()` y `setModel()` a `LiveSession` como proxies a `_agentSession`
- Agregar acceso necesario en `SessionHost` para soportar los endpoints

## R4: Estado de modelo en el frontend
- Agregar campo `model?: ModelInfo` a `SessionEntry` en el store
- Crear hook `useSessionModel(sessionId)`
- Crear actions `loadAvailableModels()` y `setSessionModel(sessionId, provider, modelId)`

## R5: Manejar evento SSE `model_select`
- Remover `"model_select"` de `explicitNoOps` en event-handlers
- Implementar handler que actualice el campo `model` del `SessionEntry` correspondiente

## R6: Selector de modelos en UI
- Crear componente `ModelSelector` (dropdown/select) en o cerca del `ChatHeader`
- Mostrar nombre del modelo actual
- Al abrir, cargar modelos disponibles vía `sessions.models.list`
- Al seleccionar, llamar `sessions.models.set`
- Agrupar modelos por provider para mejor UX