# T-001: Event primitives (`event-core.ts`)

**Phase**: foundation  
**Dependencies**: none  
**Requirements**: FR-001, FR-002, NFR-001, NFR-002, NFR-003, NFR-004

## Objective

Create `packages/subagents/src/event-core.ts` with the shared event primitives:

1. `TypedEvent<Type, Payload>` — base event interface with `type`, `payload`, `timestamp`, `id`
2. `EventCreator<Type, Payload>` — factory object combining `.type`, direct call, and `.match()`
3. `createEvent<Type, Payload>(type)` — factory function returning an EventCreator
4. `TypedEventBus<Defs>` — type-safe event bus with `publish()`, dual `subscribe()`, `clear()`

## Implementation Notes

- Zero npm dependencies. Use `crypto.randomUUID()` for event IDs (built into Node/Bun/Deno).
- The `TypedEventBus` internally stores listeners in a `Map<string, Set<Function>>` (same as current buses).
- Both `.subscribe(creator, handler)` and `.subscribe(handler)` overloads must be supported.
- `publish()` auto-generates `timestamp` and `id`.
- Error isolation: wrap each listener call in try/catch.

## Files to Create

- `packages/subagents/src/event-core.ts`

## Verification

- `createEvent("foo")({ bar: 1 })` returns a `TypedEvent<"foo", { bar: number }>` with auto id/timestamp
- `foo.match({ type: "foo" })` returns `true`
- `foo.match({ type: "bar" })` returns `false`
- Publishing via a creator emits to both specific and wildcard listeners
- Listener errors don't propagate
- `clear()` removes all listeners
