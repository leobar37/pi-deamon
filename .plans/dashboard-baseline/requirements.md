# Requirements: Dashboard Package Baseline

## Functional Requirements

### FR-001: DashboardDaemon API
Export a `DashboardDaemon` class with:
- `constructor(config?: DashboardConfig)` - configure host, port, frontend dist path
- `start(port?: number): Promise<URL>` - start the HTTP server
- `stop(): void` - stop the server
- `get isRunning(): boolean` - running state
- `get url(): URL | null` - server URL

### FR-002: Event Bridge
The daemon must accept one or more `TypedEventBus` instances and subscribe to all events:
- `bridge(bus: TypedEventBus): void` - subscribe wildcard to an event bus
- All events are forwarded to connected SSE clients

### FR-003: oRPC Server
Start a Bun HTTP server with:
- `RPCHandler` from `@orpc/server/fetch` mounted at `/api`
- CORS support for local development
- Static file serving for the built frontend at `/`

### FR-004: State Snapshot Endpoint
`dashboard.state.get` returns:
- Connected event bus count
- Recent events (last N, configurable, default 100)
- Server uptime
- Active subscriber count

### FR-005: Event Stream Endpoint (SSE)
`dashboard.events.stream` uses oRPC `eventIterator` to stream:
- Events from all bridged buses in real time
- Keep-alive pings every 5 seconds
- Clean disconnect when client closes

### FR-006: Frontend Scaffold
A Vite + React + Tailwind + Zustand app that:
- Connects to the daemon's oRPC endpoint
- Displays connection status
- Shows a simple event log
- Is responsive to mobile

### FR-007: Lion Integration
The lion extension must:
- Import `DashboardDaemon` from `@local/pi-dashboard`
- Create one daemon instance
- Bridge `LionEventBus` events
- Register `/dashboard` command that starts the server and prints the URL

### FR-008: Build Script
A `build.ts` script similar to `packages/subagents/build.ts` that bundles `src/index.ts` to `dist/index.js` with Bun.

### FR-009: Frontend Build
A Vite build that outputs to `frontend/dist/` which gets served by the daemon.

## Non-Functional Requirements

### NFR-001: No Circular Dependencies
- `@local/pi-dashboard` depends on `@local/pi-subagents` (for event types) and `@orpc/server`
- `@local/pi-extensions` depends on `@local/pi-dashboard` (for DashboardDaemon)
- No cycles

### NFR-002: Portable Server
The daemon must work with `Bun.serve()` only. No Express, no Fastify.

### NFR-003: Graceful Shutdown
`stop()` must:
- Close the HTTP server
- Unsubscribe from all bridged event buses
- Clean up SSE connections

### NFR-004: Error Resilience
A crashed or disconnected frontend must not crash the daemon. SSE client disconnects via `AbortSignal` must clean up subscriptions.

### NFR-005: Minimal Frontend Size
The built frontend must be under 500KB gzipped. No heavy UI frameworks.

### NFR-006: Configurable Port
The `/dashboard` command must accept an optional port argument (e.g. `/dashboard 9393`). Default: `9393`.

### NFR-007: Self-Contained
The frontend must be entirely self-contained - no CDN links, no external resources. All JS/CSS bundled into the Vite build.
