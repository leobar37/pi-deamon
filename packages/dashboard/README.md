# @earendil-works/pi-web

Web dashboard server for [Pi](https://github.com/earendil-works/pi-mono) coding agent sessions.

## Installation

```bash
bun add @earendil-works/pi-web
```

## Usage

### CLI

Start the dashboard server from the command line:

```bash
# Default: http://127.0.0.1:9393
pi-web

# Custom port
pi-web --port 8080

# Listen on all interfaces
pi-web --host 0.0.0.0
```

### Dashboard Daemon

Start a web server with integrated session management:

```ts
import { DashboardDaemon } from "@earendil-works/pi-web";

const daemon = new DashboardDaemon({ port: 9393 });

const url = await daemon.start();
console.log(`Dashboard at ${url.href}`);

// Cleanup on shutdown
daemon.stop();
```

The server exposes:
- `/api` — oRPC endpoints for session management and real-time events
- `/` — static React SPA frontend

### Session API

The dashboard exposes session management endpoints via oRPC under `/api/sessions.*`. All endpoints return JSON except `events.stream` which returns SSE.

#### Create a session

```bash
curl -X POST http://localhost:9393/api/sessions.create \
  -H "Content-Type: application/json" \
  -d '{"cwd": "/path/to/project"}'
```

#### Start the agent runtime

```bash
curl -X POST http://localhost:9393/api/sessions.start \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "<session-id>"}'
```

#### Send a prompt

```bash
curl -X POST http://localhost:9393/api/sessions.prompt \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "<session-id>", "message": "Hello, world"}'
```

#### Stream events (SSE)

```bash
curl "http://localhost:9393/api/sessions.events.stream?input={\"sessionId\":\"<session-id>\"}"
```

#### Full endpoint inventory

| Endpoint | Method | Description |
|----------|--------|-------------|
| `sessions.list` | POST | List all sessions for a project (disk + host merged) |
| `sessions.get` | POST | Get session details by ID |
| `sessions.create` | POST | Create a new session |
| `sessions.open` | POST | Open an existing session file |
| `sessions.continueRecent` | POST | Continue the most recent session |
| `sessions.remove` | POST | Stop and remove a session |
| `sessions.start` | POST | Start the agent runtime |
| `sessions.stop` | POST | Stop the agent runtime |
| `sessions.prompt` | POST | Send a prompt to the session |
| `sessions.steer` | POST | Queue a steering message |
| `sessions.followUp` | POST | Queue a follow-up message |
| `sessions.abort` | POST | Abort current operation |
| `sessions.state.get` | POST | Get session runtime state |
| `sessions.messages.get` | POST | Get all messages (from disk or runtime) |
| `sessions.events.stream` | GET | SSE stream of agent events |

### Dashboard State & Logs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `state.get` | POST | Server uptime and active SSE subscriber count |
| `events.stream` | GET | Unified SSE stream with session/event type filtering |
| `logs.get` | POST | Query recent structured logs with level/session filters |

### Typed Client

```ts
import { createORPCClient } from "@orpc/client";
import type { DashboardRouter } from "@earendil-works/pi-web";

const client = createORPCClient<DashboardRouter>({
  url: "http://localhost:9393/api",
});

const { session } = await client.sessions.create.call({ cwd: "/project" });
await client.sessions.start.call({ sessionId: session.id });
await client.sessions.prompt.call({ sessionId: session.id, message: "Hello" });

// Subscribe to SSE events
const response = await fetch(
  "http://localhost:9393/api/sessions.events.stream?input=" +
  encodeURIComponent(JSON.stringify({ sessionId: session.id }))
);
const reader = response.body?.getReader();
```

### SessionHost (Programmatic)

For programmatic session management without HTTP:

```ts
import { SessionHost } from "@earendil-works/pi-web";

const host = new SessionHost({
  defaultCwd: "/project",
  maxActiveSessions: 5,
  idleTimeoutMs: 1000 * 60 * 30, // 30 minutes
});

const session = await host.create("/project");
await host.start(session.id);
await host.prompt(session.id, "Hello, world");

// Stream events via internal EventPublisher
const events = session.eventPublisher.subscribe("*");
for await (const event of events) {
  console.log(event.type);
}
```

## Event System

The dashboard uses a declarative event protocol for real-time communication with the frontend. All events are typed as `ServerEvent` and delivered via SSE.

### Event Categories

| Category | Events |
|----------|--------|
| Session lifecycle | `session_created`, `session_started`, `session_stopped`, `session_removed` |
| Agent lifecycle | `agent_start`, `agent_end`, `turn_start`, `turn_end` |
| Message lifecycle | `message_start`, `message_update`, `message_end` |
| Block-level streaming | `thinking_start`, `thinking_delta`, `thinking_end`, `text_delta`, `toolcall_start`, `toolcall_delta`, `toolcall_end` |
| Tool execution | `tool_execution_start`, `tool_execution_update`, `tool_execution_end` |
| Queue | `queue_update` |
| Compaction | `compaction_start`, `compaction_end` |
| Retry | `auto_retry_start`, `auto_retry_end` |
| Model | `model_select`, `thinking_level_changed`, `session_info_changed` |
| Keep-alive | `ping` |

### EventStreamProvider

```ts
import { EventStreamProvider } from "@earendil-works/pi-web";

const provider = new EventStreamProvider();

// Subscribe to all events for a session
const events = provider.subscribe({ sessionId: "abc123" });
for await (const event of events) {
  console.log(event.type, event.timestamp);
}

// Publish an event
provider.publish({
  sessionId: "abc123",
  timestamp: Date.now(),
  type: "agent_start",
});
```

## Configuration

### DashboardDaemon

| Option | Default | Description |
|--------|---------|-------------|
| `host` | `"127.0.0.1"` | Server hostname |
| `port` | `9393` | Server port |
| `frontendDir` | `../frontend/dist` | Path to static frontend files |

### SessionHost

| Option | Default | Description |
|--------|---------|-------------|
| `defaultCwd` | `process.cwd()` | Default working directory |
| `sessionsDir` | (derived from cwd) | Custom sessions directory |
| `maxActiveSessions` | `10` | Max concurrent agent runtimes |
| `idleTimeoutMs` | `1800000` (30 min) | Auto-stop idle sessions |

## Architecture

```
DashboardDaemon
├── HTTP server (Bun.serve)
│   ├── /api — oRPC handler (CORS enabled)
│   │   ├── dashboard: state.get, events.stream, logs.get
│   │   └── sessions: CRUD, lifecycle, interaction
│   └── / — static SPA files (with SPA fallback)
├── EventStreamProvider — SSE subscription routing
├── SessionHost — session registry and lifecycle
│   └── LiveSession[] — individual sessions with AgentSession runtime
└── DashboardLogger — structured in-memory logging
```

### Electron Desktop App

```
Electron App
├── Main Process (Node.js)
│   ├── electron/main.ts — spawns pi-web-binary, creates window
│   └── electron/preload.ts — contextBridge API
└── Renderer Process (Chromium)
    └── frontend/dist/index.html — React SPA

Backend (spawned process)
└── dist/pi-web-binary — Bun-compiled standalone binary
    └── DashboardDaemon on dynamic port
```

## Frontend

The dashboard includes a React 19 SPA in `frontend/` with:
- Dark theme UI (Tailwind CSS v4)
- Real-time chat with markdown rendering
- Session sidebar with temporal grouping
- Streaming message display with syntax highlighting

See `frontend/AGENTS.md` for frontend-specific conventions.

## Desktop App (Electron)

The dashboard can be packaged as a cross-platform desktop application using Electron. The backend runs as a Bun-compiled binary spawned by the Electron main process, and the frontend loads via `file://` with the backend URL injected via query parameter.

### Desktop development

```bash
# Build frontend + binary + electron, then run
bun run electron:dev
```

This compiles the backend to a standalone binary (`dist/pi-web-binary`), builds the Electron main/preload scripts, and launches the app.

### Build for distribution

```bash
# Build everything (backend, frontend, binary, electron)
bun run electron:build

# Package into .dmg (mac), .exe (win), or AppImage (linux)
bun run electron:pack
```

### How it works

```
Electron Main Process (Node.js)
├── Spawns: dist/pi-web-binary (Bun runtime, port 0)
├── Parses backend URL from stdout
├── Creates BrowserWindow
└── Loads: file://frontend/dist/index.html?backendUrl=...

Renderer Process (Chromium)
├── React SPA
└── oRPC client reads ?backendUrl= from URL
```

The backend port is dynamically assigned (`--port 0`) to avoid conflicts. The Electron main process parses the URL from the binary's stdout output, waits for a healthcheck on `/api`, then loads the frontend with the backend URL injected.

## Development

```bash
# Build backend
bun run build

# Build frontend
bun run build:frontend

# Build everything
bun run build:all

# Build standalone binary (for Electron)
bun run build:binary

# Build Electron main + preload
bun run build:electron

# Watch mode
bun run watch

# Run tests
bun run test
```

## License

MIT
