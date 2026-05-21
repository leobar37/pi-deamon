# T-002: DashboardDaemon class

**Phase**: server
**Dependencies**: T-001
**Requirements**: FR-001, FR-003, NFR-002, NFR-003

## Objective

Implement the `DashboardDaemon` class that starts/stops a Bun HTTP server with oRPC.

## Files

### `packages/dashboard/src/types.ts`

```typescript
export interface DashboardConfig {
  host?: string;          // default: "127.0.0.1"
  port?: number;          // default: 9393
  frontendDir?: string;   // path to built frontend, default: resolved from package
}
```

### `packages/dashboard/src/daemon.ts`

```typescript
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { TypedEventBus } from "@local/pi-subagents";

export class DashboardDaemon {
  private handler: RPCHandler;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private config: Required<DashboardConfig>;
  private startTime: number = 0;
  private bridges: Array<() => void> = [];  // cleanup fns

  constructor(config?: DashboardConfig);
  
  // Bridge a TypedEventBus — subscribes wildcard
  bridge(bus: TypedEventBus): void;
  
  // Start the server
  async start(port?: number): Promise<URL>;
  
  // Stop the server
  stop(): void;
  
  // Accessors
  get isRunning(): boolean;
  get url(): URL | null;
  get uptime(): number;
}
```

### Implementation Details

**Server**:
- Uses `Bun.serve()` with fetch handler
- Checks `req.url` for `/api/*` prefix → delegates to `RPCHandler.handle()`
- Otherwise serves static files from `frontendDir`
- CORS enabled for development

**RPCHandler**:
- Mounted at prefix `/api`
- With `CORSPlugin` for local dev
- Router passed via constructor (created in next task)

**Static serving**:
- `new URL(req.url).pathname === "/"` → `index.html`
- Otherwise map to file in `frontendDir`
- Uses `Bun.file()` for streaming responses
- 404 for unknown paths

**Graceful shutdown**:
- `stop()` calls `server.stop()`
- Runs all bridge cleanup functions
- Resets internal state

## Verification

- `new DashboardDaemon().start(9393)` returns a URL
- `isRunning` is true after start, false after stop
- Server responds with 404 for unknown paths
- `stop()` can be called multiple times safely
