# Context: Event System Refactoring

## Problem

The current event system across `packages/subagents` and `packages/extensions` uses raw string-typed event maps (`SubAgentEventMap`, `LionEventMap`) with a manual `SubAgentEventBus` and `LionEventBus` that map listeners by string keys. This works but:

1. **No type-safe publish**: `emit()` takes a raw event object — no compile-time check that the payload matches the type string
2. **No creator-first API**: Consumers must know the event shape and construct the full object inline
3. **No `.match()` narrowing**: Wildcard listeners must manually switch on `event.type` with no narrowing
4. **Duplicated bus logic**: `SubAgentEventBus` and `LionEventBus` are nearly identical implementations

## Goal

Introduce a shared, opinionated event primitive (`createEvent` + `TypedEventBus`) that provides:

- `createEvent<Payload>("name")` — a factory object that acts as both creator and matcher
- `bus.publish(creator, payload)` — type-safe publish with autocompleted payload
- `bus.subscribe(creator, handler)` — typed subscription narrowed to the event's payload
- `bus.subscribe((event) => { ... })` — wildcard with `.match()` for narrowing
- Zero runtime overhead beyond what exists

## Dependencies

The primitives live in `@local/pi-subagents` because:
- `@local/pi-extensions` (lion) depends on `@local/pi-subagents`
- `@local/pi-dashboard` (future) will depend on `@local/pi-subagents`
- No circular deps

## Migration Strategy

1. Add `event-core.ts` with primitives to `@local/pi-subagents`
2. Add `event-defs.ts` with `SubAgentEvents` creators  
3. Rewrite `SubAgentEventBus` to use `TypedEventBus` internally
4. Migrate all subagent event consumers (`instance.ts`, `controller.ts`)
5. Add `event-defs.ts` for Lion events in `@local/pi-extensions`
6. Rewrite `LionEventBus` to use `TypedEventBus` internally
7. Migrate all lion event consumers (`reporter.ts`, `rule-monitor.ts`, `store.ts`, `tools.ts`, `commands.ts`, `runtime.ts`)

## Future (not in scope)

- `packages/dashboard` will consume both event buses via the primitives introduced here
