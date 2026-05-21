# T-006: Rewrite `LionEventBus`

**Phase**: lion  
**Dependencies**: T-005  
**Requirements**: FR-003

## Objective

Rewrite `packages/extensions/src/extensions/lion/events/bus.ts` so `LionEventBus` uses `TypedEventBus<typeof LionEvents>` internally.

## Implementation

Follow the same pattern as T-003 (`SubAgentEventBus` rewrite):

- Internal `TypedEventBus<typeof LionEvents>` instance
- New API: `publish(creator, payload)`, `subscribe(creator, handler)`, `subscribe(handler)`
- Legacy API: `on(type, handler)`, `emit(event)`, `clear()` (for migration compatibility)

The LionEventBus is simpler than SubAgentEventBus because it has fewer consumers and no `off()` overload.

## Files to Edit

- `packages/extensions/src/extensions/lion/events/bus.ts` (rewrite)

## Verification

- Legacy `events.on("lion.build.start", handler)` still works
- New `events.publish(LionEvents.buildStart, {})` works
- Wildcard `events.on("*", handler)` receives all events
- `clear()` removes all listeners
