# Pi Web Dashboard Frontend

## Finalidad

Interfaz web moderna tipo ChatGPT para el dashboard de sesiones de Pi. Permite visualizar, crear y gestionar sesiones de coding-agent con chat en tiempo real, streaming de mensajes, y renderizado de markdown.

## Estructura de archivos

```
packages/dashboard/frontend/
├── package.json              # Dependencias: React 19, Tailwind v4, Zustand, react-markdown, highlight.js
├── vite.config.ts            # Configuracion de Vite + Tailwind CSS
├── tsconfig.json             # TypeScript config
├── index.html                # Entry HTML
├── progress.md               # Registro de avance del proyecto
├── AGENTS.md                 # Este archivo
│
├── src/
│   ├── main.tsx              # Punto de entrada React (StrictMode)
│   ├── App.tsx               # Layout raiz: sidebar + area de chat
│   ├── index.css             # Variables CSS del tema oscuro refinado (@theme Tailwind v4)
│   ├── orpc.ts               # Cliente oRPC tipado + tipos ServerEvent, SessionInfo
│   │
│   ├── components/
│   │   ├── Sidebar.tsx       # Sidebar izquierdo: navegacion jerarquica, agrupacion temporal, proyectos
│   │   ├── ChatView.tsx      # Area principal: header + mensajes + input
│   │   ├── ChatHeader.tsx    # Header de conversacion: titulo editable, estado, controles start/stop
│   │   ├── ChatInput.tsx     # Input de chat: textarea auto-resize, steer mode, abort, queue chips
│   │   ├── MessageItem.tsx   # Renderizado de mensajes: user, assistant, tool, custom
│   │   ├── MarkdownRenderer.tsx  # Renderizado de markdown con react-markdown
│   │   ├── CodeBlock.tsx     # Bloques de codigo con syntax highlighting (highlight.js)
│   │   └── HttpBlock.tsx     # Bloques HTTP formateados: method, URL, status, headers, body
│   │
│   └── store/
│       ├── sessions.ts       # Zustand store: lista de sesiones, sesion activa, SSE events
│       └── chat.ts           # Zustand store: mensajes, streaming state, tool calls, queue
```

## Tema visual

Tema oscuro refinado al estilo ChatGPT/Claude:
- Base: negro puro (`#000000`)
- Superficies: grises sutiles
- Acentos: azul minimal
- Estados: verde, rojo, amarillo, naranja, purple

Variables CSS definidas en `index.css` via `@theme` (Tailwind v4).

## Dependencias principales

| Paquete | Proposito |
|---------|-----------|
| React 19 | UI framework |
| Tailwind CSS v4 | Estilos utilitarios |
| Zustand | State management |
| @orpc/client | Cliente tipado para API |
| react-markdown | Renderizado de markdown |
| highlight.js | Syntax highlighting |

## Comandos

```bash
bun run dev      # Desarrollo con Vite
bun run build    # Build de produccion (tsc + vite build)
bun run preview  # Preview del build
```

## Convenciones

- Usar variables CSS del tema (`bg-bg-base`, `text-text-primary`, `border-border-subtle`, etc.)
- No usar clases `gray-*` directamente; migrar a variables del tema
- Componentes funcionales con hooks
- Stores Zustand para estado global
- Cliente oRPC para todas las llamadas API (no fetch directo)
