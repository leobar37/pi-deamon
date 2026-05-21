# T-005: Lion event definitions

**Phase**: lion  
**Dependencies**: T-001  
**Requirements**: FR-005

## Objective

Create `packages/extensions/src/extensions/lion/events/defs.ts` defining `LionEvents` — a `const` map of `createEvent()` creators covering all existing Lion event types from `LionEventMap`.

## Event Mapping

| Old type string | Constant name | Payload |
|---|---|---|
| `"lion.activate.start"` | `activateStart` | `{ input?: string }` |
| `"lion.activate.complete"` | `activateComplete` | `{ mode: LionMode }` |
| `"lion.plan.loaded"` | `planLoaded` | `{ taskCount: number; kind: LionPlanKind }` |
| `"lion.mode.changed"` | `modeChanged` | `{ mode: LionMode }` |
| `"lion.build.start"` | `buildStart` | `{}` |
| `"lion.task.selected"` | `taskSelected` | `{ title: string }` |
| `"lion.delegation.prompt.created"` | `delegationPromptCreated` | `{ agent: string; promptLength: number }` |
| `"lion.delegation.start"` | `delegationStart` | `{ agent: string }` |
| `"lion.delegation.end"` | `delegationEnd` | `{ agent: string; status: string; summary: string }` |
| `"lion.validation.start"` | `validationStart` | `{ focus?: string }` |
| `"lion.validation.end"` | `validationEnd` | `{ status: string; summary: string }` |
| `"lion.validation.verdict"` | `validationVerdict` | `{ verdict: string; summary: string }` |
| `"lion.review.verdict"` | `reviewVerdict` | `{ verdict: LionReviewVerdict; summary: string }` |
| `"lion.correction.requested"` | `correctionRequested` | `{ feedback: string }` |
| `"lion.task.approved"` | `taskApproved` | `{}` |
| `"lion.task.rejected"` | `taskRejected` | `{ reason: string }` |
| `"lion.task.marked_complete"` | `taskMarkedComplete` | `{}` |
| `"lion.build.complete"` | `buildComplete` | `{ result: LionBuildResult }` |
| `"lion.build.failed"` | `buildFailed` | `{ error: string }` |
| `"lion.rule.violation"` | `ruleViolation` | `{ rule: string; message: string }` |
| `"lion.subagent.event"` | `subagentEvent` | `{ subagentEvent: SubAgentEvent }` |

Note: The old `LionEventBase` fields (`timestamp`, `runId`, `planSlug`, `planPath`, `taskId`, `attempt`) are NOT part of the payload. These are metadata that `publish()` should tag automatically via an enhanced bus publish. For now, the reporter/sink pattern handles them.

## Files to Create

- `packages/extensions/src/extensions/lion/events/defs.ts`

## Imports

```typescript
import { createEvent } from "@local/pi-subagents";
// or directly from ../../../../subagents/src/event-core.ts via workspace dep
```

## Verification

- Each creator has the correct `.type` string matching existing LionEventMap types
- All existing Lion event types are covered
- `LionEvents.buildStart.type === "lion.build.start"`
