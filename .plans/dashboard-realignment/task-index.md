# Índice de Tareas

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Limpiar código huérfano de Lion del servidor | [tasks/01-clean-lion.md](tasks/01-clean-lion.md) | pendiente |
| 2 | Estándar declarativo de eventos del servidor | [tasks/02-event-standard.md](tasks/02-event-standard.md) | pendiente |
| 3 | Provider de suscripción SSE con filtros | [tasks/03-sse-provider.md](tasks/03-sse-provider.md) | pendiente |
| 4 | Unificar y tipar la API de sesiones | [tasks/04-session-api.md](tasks/04-session-api.md) | pendiente |
| 5 | Sidebar de sesiones estilo TUI (frontend) | [tasks/05-session-sidebar.md](tasks/05-session-sidebar.md) | pendiente |
| 6 | Vista de chat con streaming (frontend) | [tasks/06-chat-view.md](tasks/06-chat-view.md) | pendiente |
| 7 | Controles de sesión: prompt, steer, abort (frontend) | [tasks/07-session-controls.md](tasks/07-session-controls.md) | pendiente |

## Dependencias entre tareas

```
[1] Clean Lion code ───────┐
[2] Event Standard ────────┼──→ [3] SSE Provider ───→ [4] Session API
                           │                              │
                           │                              ├──→ [5] Sidebar
                           │                              ├──→ [6] Chat
                           │                              └──→ [7] Controls
                           │
                           └──→ [2] y [3] pueden hacerse en paralelo tras [1]
```

- Las tareas 1 y 2 son infraestructura del servidor y pueden hacerse en secuencia o con overlap.
- La tarea 3 depende de 1 y 2.
- La tarea 4 depende de 3.
- Las tareas 5, 6, 7 son frontend y dependen de 4.
