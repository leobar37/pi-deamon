# Requisitos

## R1: UI Provider con Jotai (reemplazar Zustand)

- Crear `UIProvider` con contexto Jotai-based que maneje estado global de UI
- Migrar el estado activo de sesión de Zustand a Jotai
- Estados a incluir:
  - `activeSessionId: string | null`
  - `sidebarCollapsed: boolean`
  - `modelSelectorOpen: boolean` (para evitar race conditions)
  - `toast/notification state` (preparado para futuro)
- Hooks: `useActiveSession`, `useSetActiveSession`, `useSidebarCollapsed`, `useToggleSidebar`
- Integrar en `App.tsx` junto con `SessionRuntimeProvider`
- El hash routing debe seguir funcionando (sincronizar `activeSessionId` con hash)

## R2: Mover ModelSelector al Composer

- Mover `ModelSelector` del `ChatHeader` al `ChatInput`
- Posicionar como toolbar/badge sobre el textarea (estilo ChatGPT: "Model: Claude Opus 4" como pill clickable)
- El `ChatHeader` debe quitar el ModelSelector (solo título + status)
- Mantener el dropdown de modelos funcionando igual

## R3: Refactor ChatInput → Composer modular

Dividir `ChatInput.tsx` en una estructura de directorio `composer/`:

```
components/composer/
├── index.ts              ← Re-export público
├── Composer.tsx          ← Orquestador principal (estado, submit, etc.)
├── ComposerTextarea.tsx  ← Textarea con auto-resize
├── ComposerToolbar.tsx   ← Toolbar con ModelSelector + attachements placeholder
├── ComposerActions.tsx   ← Send/Abort buttons
├── ComposerIndicator.tsx ← Steer mode indicator + streaming status
└── ComposerQueueChips.tsx ← Pending queue chips
```

- `ChatInput.tsx` debe seguir exportando `ChatInput` (backward compat)
- `ChatView.tsx` debe seguir importando desde `./ChatInput`

## R4: Mock Setup (MSW + test utilities)

- Inicializar MSW (Mock Service Worker) para mockear HTTP
- Crear factory de datos mock:
  - `mockSession()` — genera `SessionInfo`
  - `mockMessage()` — genera `ChatMessage` (user, assistant, tool)
  - `mockModelList()` — genera lista de `ModelInfo`
- Crear `mockORPCClient()` — mock del cliente oRPC que devuelve datos predecibles
- Crear `mockSSEStream()` — generador de eventos SSE para testing de streaming
- Crear `renderWithProviders()` — wrapper de testing que provee:
  - `SessionRuntimeProvider`
  - `UIProvider`
  - Mock de oRPC

## R5: Component Tests

Tests que rendericen componentes reales con datos mock:

### Message List Rendering
- Renderizar lista de mensajes (user + assistant + tool)
- Verificar que se muestran los bloques de texto, thinking, tool calls
- Verificar streaming indicator (cursor + "Thinking...")
- Verificar empty state ("No messages yet")

### Send Message Flow
- Escribir en textarea y enviar
- Verificar que se agrega mensaje optimista (user)
- Verificar que se muestra "Sending..."
- Verificar abort button durante streaming
- Verificar steer indicator durante streaming

### Model Selector in Composer
- Verificar que el modelo actual se muestra en el toolbar
- Abrir dropdown y verificar que carga modelos
- Seleccionar modelo y verificar que se llama a la API

### UI State
- Verificar que `setActiveSession` cambia la sesión activa
- Verificar sidebar collapse/expand
- Verificar que hash routing sincroniza sesión activa

## Dependencias nuevas a agregar

| Paquete | Propósito |
|---------|-----------|
| `msw` ^2.x | Mock Service Worker para HTTP |
| `@testing-library/react` ^16.x | Renderizado de componentes en tests |
| `@testing-library/jest-dom` ^6.x | Matchers DOM y accesibilidad |
| `@testing-library/user-event` ^14.x | Simulación de interacciones de usuario |
