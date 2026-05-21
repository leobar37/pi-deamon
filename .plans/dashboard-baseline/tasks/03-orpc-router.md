# T-003: oRPC router

**Phase**: server
**Dependencies**: T-002
**Requirements**: FR-004, FR-005

## Objective

Define the oRPC router contract with two procedures: state snapshot and event stream.

## Files

### `packages/dashboard/src/router.ts`

Uses `os` from `@orpc/server` to define the contract:

```typescript
import { os } from "@orpc/server";
import { eventIterator } from "@orpc/server";

// ============================================================
// Types
// ============================================================

export interface DashboardState {
  uptime: number;
  bridgeCount: number;
  subscriberCount: number;
  recentEvents: DashboardEventPayload[];
}

export interface DashboardEventPayload {
  id: string;
  type: string;
  source: "lion" | "subagent";
  payload: unknown;
  timestamp: number;
}

// ============================================================
// Router
// ============================================================

export const dashboardRouter = {
  state: {
    get: os
      .output<DashboardState>()
      .handler(async () => {
        // Returns current snapshot from bridge state
      }),
  },
  events: {
    stream: os
      .output(eventIterator(DashboardEventPayload))
      .handler(async function* ({ signal }) {
        // Yields events from publisher
      }),
  },
};
```

### Implementation Notes

**State procedure** (`dashboard.state.get`):
- Returns current snapshot including uptime, bridge count, subscriber count
- Also returns last N events from an internal ring buffer (kept by bridge)

**Event stream procedure** (`dashboard.events.stream`):
- Uses `EventPublisher` from `@orpc/server`
- The bridge subscribes to Lion/SubAgent buses and publishes events
- The handler uses `for await (payload of publisher.subscribe("*", { signal }))`
- Implements cleanup on signal abort

**Type Safety**:
- Use `zod` (already available in the ecosystem) for schema validation
- Or use TypeScript `satisfies` with manual output types when validation isn't needed

### Wiring

The `DashboardDaemon` creates the router and passes it to the `RPCHandler`. The handler is used in the Bun fetch callback.

## Verification

- Router compiles with proper types
- State endpoint returns a valid JSON response
- Event stream endpoint returns `text/event-stream` when called
