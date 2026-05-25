<coding_guidelines>
# Pi Dashboard

## Purpose

Web dashboard server for Pi coding agent sessions. Provides an HTTP server with oRPC API endpoints and a React SPA frontend for managing, monitoring, and interacting with agent sessions in real time.

## Architecture

```
packages/dashboard/
├── src/
│   ├── cli.ts                    # pi-web CLI entry point
│   ├── index.ts                  # Public API exports
│   ├── types.ts                  # DashboardConfig
│   ├── contract.ts               # Type-only re-exports for frontend
│   ├── logging.ts                # DashboardLogger (in-memory, structured)
│   │
│   ├── server/
│   │   ├── daemon.ts             # DashboardDaemon — HTTP server, static files, oRPC
│   │   └── static.ts             # SPA static file serving with fallback
│   │
│   ├── session/
│   │   ├── host.ts               # SessionHost — registry, lifecycle, resource limits
│   │   ├── live-session.ts       # LiveSession — single session + AgentSession runtime
│   │   ├── types.ts              # SessionStatus, LiveSessionInfo, SessionHostConfig
│   │   └── index.ts              # Re-exports
│   │
│   ├── events/
│   │   ├── provider.ts           # EventStreamProvider — declarative SSE subscriptions
│   │   ├── types.ts              # ServerEvent union, ServerEventType
│   │   ├── schemas.ts            # Zod schemas for events
│   │   └── serialize.ts          # AgentSessionEvent -> ServerEvent converter
│   │
│   └── procedures/
│       ├── index.ts              # createDashboardRouter factory
│       ├── dashboard.ts          # Dashboard procedures (state, events.stream, logs)
│       ├── session.ts            # Session procedures (CRUD, lifecycle, interaction)
│       └── schemas.ts            # Zod schemas for session API
│
├── frontend/                     # React 19 + Tailwind v4 SPA (see frontend/AGENTS.md)
├── electron/                     # Electron desktop app
│   ├── main.ts                   # Electron main process — spawns backend binary
│   ├── preload.ts                # contextBridge — exposes safe API to renderer
│   ├── tsconfig.json             # TypeScript config for electron build
│   └── vite.config.ts            # Vite build config for main + preload
├── test/                         # Vitest tests for SessionHost and LiveSession
├── package.json
├── build.ts                      # Bun build script (includes --binary target)
└── tsconfig.build.json
```

## Key Concepts

### DashboardDaemon

HTTP server that combines:
- `/api` — oRPC endpoints (dashboard state, session CRUD, SSE event streaming, logs)
- `/` — static React SPA from `frontend/dist`

Auto-builds the frontend on first start if `index.html` is missing.

### SessionHost

Registry and lifecycle manager for `LiveSession` instances:
- CRUD: create, open, continueRecent, get, list, remove
- Runtime: start, stop (with `maxActiveSessions` limit)
- Interaction: prompt, steer, followUp, abort
- Maintenance: idle timeout cleanup, lazy-loading from disk

Wires sessions to `EventStreamProvider` for SSE forwarding.

### LiveSession

Single session wrapper around `SessionManager` + optional `AgentSession`:

Lifecycle: `created -> start() -> starting -> idle <-> streaming -> stop() -> stopped`

Events from the agent runtime are forwarded to both:
1. Internal `EventPublisher` (for programmatic consumers)
2. `EventStreamProvider` (for SSE subscribers)

### EventStreamProvider

Declarative SSE subscription provider:
- `subscribe(filter, signal)` — returns `AsyncIterableIterator<ServerEvent>`
- `publish(event)` — routes to all matching subscribers
- Supports filtering by `sessionId` and `eventTypes`
- Auto-injects ping events every 5s for keep-alive

### ServerEvent

Union of all events emitted to the frontend. Covers:
- Session lifecycle: `session_created`, `session_started`, `session_stopped`, `session_removed`
- Agent lifecycle: `agent_start`, `agent_end`, `turn_start`, `turn_end`
- Message lifecycle: `message_start`, `message_update`, `message_end`
- Block-level streaming: `thinking_start/delta/end`, `text_delta`, `toolcall_start/delta/end`
- Tool execution: `tool_execution_start/update/end`
- Queue: `queue_update`
- Compaction: `compaction_start/end`
- Retry: `auto_retry_start/end`
- Model: `model_select`, `thinking_level_changed`, `session_info_changed`
- Keep-alive: `ping`

## Dependencies

| Package | Purpose |
|---------|---------|
| `@orpc/server` | oRPC server framework |
| `@orpc/client` | Typed client (frontend) |
| `zod` | Schema validation |
| `@earendil-works/pi-coding-agent` | Agent session runtime |
| `react` / `react-dom` | Frontend UI |
| `tailwindcss` | Frontend styling |
| `zustand` | Frontend state management |
| `react-markdown` / `highlight.js` | Frontend markdown rendering |

## Commands

```bash
# Backend
bun run build              # Build backend to dist/
bun run watch              # Build in watch mode
bun run build:frontend     # Build frontend SPA
bun run build:all          # Build backend + frontend
bun run test               # Run vitest tests

# CLI
bun run dist/cli.js        # Start dashboard server (default port 9393)
bun run dist/cli.js --port 8080 --host 0.0.0.0

# Desktop app (Electron)
bun run build:binary       # Compile CLI to standalone binary (dist/pi-web-binary)
bun run build:electron     # Build Electron main + preload scripts
bun run electron:dev       # Build frontend + binary + electron, then run
bun run electron:build     # Full build for packaging
bun run electron:pack      # Package into .dmg / .exe / AppImage
```

## Electron App

The dashboard can be packaged as a desktop application using Electron with a Bun-compiled backend binary.

### Architecture

```
Electron Main (Node.js)
├── Spawns: dist/pi-web-binary --port 0 --host 127.0.0.1
├── Parses backend URL from stdout ("pi-web running at http://...")
├── Healthcheck on /api before loading renderer
└── Creates BrowserWindow with preload script

Renderer (Chromium)
├── Loads: file://frontend/dist/index.html?backendUrl=...
├── React SPA reads backendUrl from query param
└── oRPC client connects to backend via HTTP
```

### Key Implementation Details

- **Dynamic port**: Backend starts on port 0 (OS-assigned) to avoid conflicts
- **URL normalization**: Trailing slash removed from parsed URL before healthcheck
- **URL persistence**: Backend URL stored in global variable for macOS re-activation
- **Single instance**: `app.requestSingleInstanceLock()` prevents multiple instances
- **Cleanup**: `before-quit` kills backend with SIGTERM → SIGKILL after 3s
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, minimal preload API

### Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | Spawns backend binary, creates window, handles lifecycle |
| `electron/preload.ts` | Exposes `platform` and `versions` via contextBridge |
| `electron/vite.config.ts` | Builds main + preload as CJS |
| `build.ts` | `--binary` flag compiles CLI to standalone executable |

## Conventions

- All API endpoints are POST except `events.stream` (GET SSE)
- Use Zod schemas for all oRPC inputs/outputs
- Use `logger.info/warn/error/debug` for structured logging (not console.log)
- Session methods auto-start idle/stopped sessions before interaction
- Lazy-load sessions from disk on first access after `list()`
- Event serialization happens in `serializeAgentSessionEvent` — add new event types there
- Frontend uses hash-based routing (`#/session/<id>`)
- Frontend consumes API exclusively through typed oRPC client (no raw fetch)
- In Electron, the oRPC client reads `backendUrl` from `?backendUrl=` query param

## Testing

Tests cover:
- `SessionHost` lifecycle, CRUD, resource limits, idle cleanup
- `LiveSession` start/stop, prompt, state access
- Error paths and edge cases

Run from package root:
```bash
bun x tsx ../../node_modules/vitest/dist/cli.js --run
```

## Changelog

Location: `packages/dashboard/CHANGELOG.md`

Format follows repo standard: `### Added`, `### Changed`, `### Fixed`, `### Removed` under `## [Unreleased]`.
</coding_guidelines>
