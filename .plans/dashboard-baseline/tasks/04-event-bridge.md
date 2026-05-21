# T-004: Event bridge

**Phase**: server
**Dependencies**: T-003
**Requirements**: FR-002, NFR-004

## Objective

Implement the event bridge that subscribes to TypedEventBus instances and forwards events to the oRPC EventPublisher.

## Architecture

```
LionEventBus ──┐
               ├──→ bridge.subscribe("*", forward)
SubAgentBus  ──┘
                    │
                    ▼
          EventPublisher (oRPC)
                    │
                    ▼
          dashboard.events.stream (SSE to clients)
```

## Implementation

### `packages/dashboard/src/bridge.ts`

```typescript
import { EventPublisher } from "@orpc/server";
import { TypedEventBus, type TypedEvent } from "@local/pi-subagents";
import type { DashboardEventPayload } from "./router.js";

export class DashboardEventBridge {
  private publisher = new EventPublisher<DashboardEventPayload>();
  private subscriptions: Array<() => void> = [];
  private ringBuffer: DashboardEventPayload[] = [];
  private maxEvents = 100;

  // Subscribe to a TypedEventBus
  bridge(bus: TypedEventBus, source: "lion" | "subagent"): void {
    const unsub = bus.subscribe((typedEvent: TypedEvent) => {
      const payload: DashboardEventPayload = {
        id: typedEvent.id,
        type: typedEvent.type,
        source,
        payload: typedEvent.payload,
        timestamp: typedEvent.timestamp,
      };
      this.ringBuffer.push(payload);
      if (this.ringBuffer.length > this.maxEvents) {
        this.ringBuffer.shift();
      }
      this.publisher.publish("*", payload);
    });
    this.subscriptions.push(unsub);
  }

  // Get the EventPublisher for the router
  getPublisher(): EventPublisher<DashboardEventPayload> {
    return this.publisher;
  }

  // Get recent events snapshot
  getRecentEvents(limit?: number): DashboardEventPayload[] {
    const n = limit ?? this.maxEvents;
    return this.ringBuffer.slice(-n);
  }

  // Get current subscriber count
  getSubscriberCount(): number {
    return this.publisher.subscriberCount;
  }

  // Cleanup
  clear(): void {
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];
    this.ringBuffer = [];
  }

  get bridgeCount(): number {
    return this.subscriptions.length;
  }
}
```

**Note**: `EventPublisher` from oRPC is lightweight with synchronous publishing. The `subscriberCount` property may not exist in the public API - we track subscribers via a counter in the bridge.

### Usage in DashboardDaemon

```typescript
export class DashboardDaemon {
  private bridge = new DashboardEventBridge();
  
  bridge(bus: TypedEventBus, source?: "lion" | "subagent"): void {
    this.bridge.bridge(bus, source ?? "lion");
  }
}
```

### Edge Cases

- **Clean disconnect**: When an SSE client disconnects, oRPC aborts the `signal` in the generator. The bridge doesn't need to track individual clients - the `EventPublisher` handles this.
- **No subscribers**: When no clients are connected, events are still stored in the ring buffer.
- **Rapid events**: The ring buffer prevents unbounded memory growth.

## Verification

- `bridge.subscribe("*")` receives events from both Lion and SubAgent buses
- `getRecentEvents()` returns last N events in FIFO order
- `clear()` removes all subscriptions
- Ring buffer does not exceed `maxEvents`
