# Context: Dashboard Package Baseline

## Problem

Pi has rich observability internally (TypedEventBus, LionEventBus, SubAgentEventBus) but no real-time visual interface to inspect what's happening. Users currently have no way to:
- See sub-agent progress (turns, tools, status) in real time
- View the orchestrator's plan execution flow
- Debug delegation chains between Lion and sub-agents
- Monitor event history across runs

## Existing Infrastructure

The event refactoring introduced a typed event system shared across packages:

```
@local/pi-subagents (event-core.ts)
├── createEvent<Payload>(type) → EventCreator
├── TypedEventBus              → publish(), subscribe(), clear()
├── SubAgentEventBus extends TypedEventBus
└── SubAgentEvents (9 creators)

@local/pi-extensions (lion)
└── LionEventBus extends TypedEventBus
└── LionEvents (21 creators)
```

Both buses are in-memory, in-process (same PID). Any code inside the Pi process can subscribe to them.

## Goal

Create `packages/dashboard` - a new workspace package that:

1. **Exports `DashboardDaemon`** - a class that starts an HTTP server
2. **Uses oRPC** (`@orpc/server`) for type-safe RPC + SSE event streaming
3. **Serves a React SPA** (Vite + Tailwind + Zustand + oRPC client)
4. **Bridges events** from Lion/SubAgent buses to the connected web clients
5. **Wires into the lion extension** via a `/dashboard` command

## Architecture

```
Pi Process
│
├── LionRuntime
│   ├── LionEventBus ───────┐
│   └── SubAgentController──┤
│       └── SubAgentEventBus┘
│                            │
├── DashboardDaemon          │
│   ├── EventBridge  ◄──────┘  (subscribe a ambos buses)
│   │   └── oRPC EventPublisher
│   ├── oRPC Router (RPCHandler)
│   │   ├── dashboard.state.get    → snapshot
│   │   └── dashboard.events.stream → EventIterator (SSE)
│   ├── Bun.serve
│   │   ├── /api/*  → oRPC
│   │   └── /*      → static files
│   └── Frontend (React SPA)
│       ├── oRPC client (RPCLink)
│       ├── Zustand store
│       └── Tailwind UI
```

## Dependencies

- `@orpc/server@^1.14` - server-side RPC + EventIterator + EventPublisher
- `@orpc/client@^1.14` - client-side (frontend)
- `zod` - schema validation for oRPC (optional, uses standard-schema)
- React 19, Vite 6, Tailwind 4, Zustand 5 - frontend

## Integration with Lion

The `@local/pi-extensions` lion extension will:
1. Import `DashboardDaemon` from `@local/pi-dashboard`
2. Create an instance during extension init
3. Subscribe `LionEventBus` and `SubAgentEventBus` events into the daemon
4. Register `/dashboard` command to start the server

## Out of Scope

- Authentication/authorization for the dashboard
- Persistence of dashboard state
- Multiple concurrent dashboard instances
- HTTPS support
- Hot reload of the server
