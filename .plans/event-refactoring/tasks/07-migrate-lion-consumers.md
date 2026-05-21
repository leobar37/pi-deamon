# T-007: Migrate lion consumers

**Phase**: lion  
**Dependencies**: T-006  
**Requirements**: FR-007

## Objective

Migrate all lion consumers to use the new API patterns.

### `reporter.ts`

The `createLionRunReporter` function creates a `LionEventSink` — currently a function `(event: LionEvent) => void`. This function should now use `events.publish()` with the corresponding `LionEvents` creator.

However, the `reporter` receives raw `LionEvent` objects from tools. The simplest approach: keep the sink function but have it match the event type and use `publish()`. Since `typenarrow` at runtime is tricky, the reporter can use a helper that maps old event shapes to creator + payload.

Better approach: keep `emit(event: LionEvent)` as a bridge method on `LionEventBus` that internally maps to `publish()`.

### `rule-monitor.ts`

Current:
```typescript
this.emit({
  type: "lion.rule.violation",
  timestamp: Date.now(),
  runId: event.runId,
  ...
});
```

New:
```typescript
this.emit(LionEvents.ruleViolation, { rule: "...", message: "..." });
```

But the `rule-monitor` receives metadata (`runId`, `taskId`, etc.). These metadata fields need to be attached by the reporter/sink. So the monitor just emits the pure payload; the sink enriches with metadata.

### `tools.ts` and `commands.ts`

All `emit(...)` calls convert from constructing full event objects to using creators:

Current:
```typescript
emit({
  type: "lion.delegation.start",
  timestamp: Date.now(),
  runId,
  planSlug: plan.slug,
  ...
  agent: "executor",
});
```

New:
```typescript
emit(LionEvents.delegationStart, { agent: "executor" });
```

The enrichment (runId, planSlug, planPath, taskId) is handled by a wrapper around the sink. This wrapper:
1. Receives `(creator, payload)` calls
2. Auto-attaches contextual metadata from the calling scope
3. Publishes the enriched event

### `runtime.ts` — `recordLionSubagentUiEvent`

The `recordLionSubagentUiEvent` function currently uses a `switch(event.type)` on subagent events. With the new primitives, it can use `.match()` instead:

```typescript
if (SubAgentEvents.taskStart.match(event)) {
  // event.payload is narrowed
  next.status = "running";
}
```

This is cleaner and more type-safe.

## Files to Edit

- `packages/extensions/src/extensions/lion/events/reporter.ts`
- `packages/extensions/src/extensions/lion/events/rule-monitor.ts`
- `packages/extensions/src/extensions/lion/events/store.ts`
- `packages/extensions/src/extensions/lion/tools.ts`
- `packages/extensions/src/extensions/lion/commands.ts`
- `packages/extensions/src/extensions/lion/runtime.ts`
- `packages/extensions/src/extensions/lion/subagents/controller.ts`
- `packages/extensions/src/extensions/lion/subagents/executor.ts`
- `packages/extensions/src/extensions/lion/subagents/reviewer.ts`
- `packages/extensions/src/extensions/lion/subagents/validator.ts`

## Verification

- All `emit(...)` calls replaced with `publish(creator, payload)`
- No raw event construction outside of the bus internals
- Compilation passes
