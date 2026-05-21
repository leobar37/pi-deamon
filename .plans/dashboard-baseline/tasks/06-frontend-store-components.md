# T-006: Frontend store + components

**Phase**: frontend
**Dependencies**: T-005
**Requirements**: FR-006

## Objective

Implement the Zustand store and React components for the dashboard.

## Files

### `packages/dashboard/frontend/src/store/dashboard.ts`

```typescript
import { create } from "zustand";

export interface DashboardEvent {
  id: string;
  type: string;
  source: "lion" | "subagent";
  payload: unknown;
  timestamp: number;
}

interface DashboardState {
  // Connection
  connected: boolean;
  error: string | null;

  // Events
  events: DashboardEvent[];
  maxEvents: number;
  addEvent: (event: DashboardEvent) => void;
  clearEvents: () => void;

  // Server info
  uptime: number;
  bridgeCount: number;
  setServerInfo: (uptime: number, bridgeCount: number) => void;

  // Filters
  sourceFilter: "all" | "lion" | "subagent";
  setSourceFilter: (filter: "all" | "lion" | "subagent") => void;
  typeFilter: string | null;
  setTypeFilter: (type: string | null) => void;
}
```

### Component: `packages/dashboard/frontend/src/components/Layout.tsx`

- Title bar with "Pi Dashboard" and connection status indicator (green/red dot)
- Main content area with: EventLog
- Responsive (single column on mobile)

### Component: `packages/dashboard/frontend/src/components/ConnectionStatus.tsx`

- Shows connected/disconnected
- Server uptime
- Bridge count
- Subscriber count
- Auto-refreshes state via `orpc.dashboard.state.get()`

### Component: `packages/dashboard/frontend/src/components/EventStream.tsx`

- Connects to `orpc.dashboard.events.stream()` on mount
- Uses `consumeEventIterator()` from `@orpc/client` to handle the event stream
- Calls `addEvent()` on the store for each event
- Handles reconnection on disconnect
- Calls `signal.abort()` on unmount

### Component: `packages/dashboard/frontend/src/components/EventLog.tsx`

- Virtual-scrolled list of events (or simple scroll-based for initial implementation)
- Each event shows:
  - Timestamp (relative, e.g. "2s ago")
  - Source badge: "lion" (blue) / "subagent" (green)
  - Event type (e.g. "lion.build.start")
  - Payload as expandable JSON
- Filter controls at top: source filter (all/lion/subagent), type filter text input
- Auto-scroll to bottom (with toggle)
- Clear button
- "N events" count

### Implementation Strategy

Start simple:
1. Zustand store with events array + connection state
2. EventStream component that opens SSE and feeds events
3. EventLog that renders the list with basic filtering
4. ConnectionStatus showing state at the top

No virtual scrolling initially — just a scrollable div with `max-h-screen` and overflow.
Keep events capped at `maxEvents` (default 500).

## Verification

- `npm run dev` shows the dashboard UI
- Connecting to a running daemon shows events streaming in
- Source filter works
- Events don't accumulate beyond maxEvents
- Clean unmount doesn't leak connections
