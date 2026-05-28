# Contexto: Dashboard Composer + Mocks + UI Provider

## Aplicación
`packages/dashboard` es una aplicación que expone un servidor HTTP embebido (Bun) y un frontend React (Vite + Tailwind + Jotai + React 19). La comunicación fluye por HTTP: oRPC para request/response y SSE para streaming de eventos.

## Estado actual del frontend

### Store (Jotai-based, ya implementado)
- `SessionRuntimeProvider` con `createSessionRuntime()` que expone:
  - `store`: Jotai store
  - `maps`: ReactiveMaps para sessions, messages, streaming
  - `indexes`: DerivedIndex para messagesBySession, sessionsByCwd
- Hooks: `useSession`, `useSessionMessages`, `useSessionStreaming`, `useSessionList`, `useSessionsByCwd`, `useSessionModel`
- Actions: `createActions(runtime, optimistic)` — prompt, steer, abort, loadMessages, loadSessions, etc.
- Event handlers: ~25 tipos de eventos SSE con handlers modulares

### UI State (problema)
- `store/ui.ts` — Store Zustand con solo `activeSessionId`, **nunca usado como provider**
- La sesión activa se maneja vía URL hash (`#/session/{id}`)
- No hay estado global de UI para: sidebar collapsed, modales, preferencias, panel de herramientas

### Composer (ChatInput) — monolithic
- Un solo archivo `ChatInput.tsx` (~180 líneas)
- Contiene: textarea, auto-resize, steer indicator, queue chips, abort button, send button
- ModelSelector está en `ChatHeader.tsx` (arriba), el usuario quiere que esté en el composer

### Tests existentes
- Solo tests unitarios del store en `test/`:
  - `deduplication.test.ts` — pruebas de `findDuplicateUserMessage`, `isRecentlyConfirmed`
  - `event-handlers.test.ts` — pruebas de `applyEvent` con eventos SSE
- Sin MSW, sin tests de componentes
- Vitest config con `happy-dom`

## Arquitectura relevante

```
packages/dashboard/frontend/src/
├── store/
│   ├── provider.tsx       ← SessionRuntimeProvider (Jotai)
│   ├── runtime.ts         ← createSessionRuntime()
│   ├── atoms.ts           ← Atom factories con WeakMap caching
│   ├── hooks.ts           ← useSession*, useSessionModel
│   ├── actions.ts         ← createActions()
│   ├── optimistic.ts      ← Optimistic UI manager
│   ├── ui.ts              ← Zustand store (NO USADO)
│   └── event-handlers/    ← ~25 handlers SSE
├── components/
│   ├── ChatView.tsx       ← Orquesta ChatHeader + messages + ChatInput
│   ├── ChatHeader.tsx     ← Título, status, ModelSelector (MAL UBICADO)
│   ├── ChatInput.tsx      ← Composer monolithic
│   ├── ModelSelector.tsx  ← Componente completo (BIEN HECHO)
│   ├── MessageItem.tsx    ← Render por rol
│   ├── blocks/            ← BlockRenderer, TextBlock, ThinkingBlock, etc.
│   └── Sidebar.tsx        ← Sidebar jerárquico
├── orpc.ts               ← Cliente oRPC tipado
├── api-types.ts          ← Tipos de API
└── App.tsx                ← Layout + SessionRuntimeProvider
```

## Restricciones
- Usar Bun para scripts
- Seguir convenciones existentes: Jotai, Tailwind CSS, oRPC
- `bun run build` debe pasar después de los cambios
- `bun run test` debe pasar (y los tests nuevos también)
- No romper funcionalidad existente (SSE streaming, optimistic UI, hash routing)
