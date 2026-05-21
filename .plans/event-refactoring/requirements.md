# Requirements: Event System Refactoring

## Functional Requirements

### FR-001: Typed Event Creator
A `createEvent<Payload>(type)` function that returns an `EventCreator` object with:
- `.type` property (the string type)
- Direct call `(payload) => TypedEvent` for constructing events
- `.match(event)` type narrowing predicate

### FR-002: Typed Event Bus
A `TypedEventBus<Defs>` class that provides:
- `publish(creator, payload)` — type-safe event emission
- `subscribe(creator, handler)` — typed listener registration, returns unsubscribe function
- `subscribe(handler)` — wildcard listener with `.match()` narrowing
- `clear()` — remove all listeners
- `.size` — current listener count

### FR-003: Backward-Compatible SubAgentEventBus
The refactored `SubAgentEventBus` must:
- Export the new `publish()` / `subscribe()` API
- Still export `on(type, handler)`, `emit(event)`, `off()`, `clear()` for legacy usage during migration
- Emit events with `timestamp` and `id` fields (new)

### FR-004: SubAgent Events Defined as Creators
Define `SubAgentEvents` constant map in `event-defs.ts` covering:
- `lifecycleChange`, `taskStart`, `taskEnd`
- `turnComplete`, `toolExecute`, `progressUpdate`
- `queryResponse`, `summaryAvailable`, `error`

### FR-005: Lion Events Defined as Creators
Define `LionEvents` constant map covering all existing Lion event types from `LionEventMap`.

### FR-006: Consumer Migration (SubAgent)
All `.emit()` calls in `instance.ts` and `controller.ts` migrate to `.publish(creator, payload)`.
All `.on()` calls in `controller.ts` migrate to `.subscribe(creator, handler)`.

### FR-007: Consumer Migration (Lion)
All `emit()` calls (sink pattern) in `tools.ts`, `commands.ts`, `rule-monitor.ts` migrate to use `LionEvents` creators.
The `recordLionSubagentUiEvent()` switch in `runtime.ts` migrates to `.match()` narrowing.

## Non-Functional Requirements

### NFR-001: No Dependencies
`event-core.ts` must have zero npm dependencies. Only standard TypeScript/JavaScript.

### NFR-002: Bundle Size
The primitives must add less than 1KB to the bundle.

### NFR-003: Type Safety
A `publish(creator, wrongPayload)` must produce a compile-time error.
A `subscribe(creator, handler)` must provide autocomplete on `handler(event.payload)`.

### NFR-004: Event ID
Every event must have a unique `id` (nanoid or crypto.randomUUID style) for dedup and traceability.

### NFR-005: No Breaking Exports
The public API surface of `@local/pi-subagents` must remain compatible. No consumer should break after the refactor (beyond import path changes for types).

### NFR-006: Error Isolation
Listener errors must not break the bus (try/catch per listener, matching current behavior).
