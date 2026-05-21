# T-002: SubAgent event definitions (`event-defs.ts`)

**Phase**: foundation  
**Dependencies**: T-001  
**Requirements**: FR-004

## Objective

Create `packages/subagents/src/event-defs.ts` defining `SubAgentEvents` — a `const` map of `createEvent()` creators covering all existing subagent event types.

## Event Mapping

| Old type string | Constant name | Payload |
|---|---|---|
| `"lifecycle.change"` | `lifecycleChange` | `{ instanceId, previous, current }` |
| `"task.start"` | `taskStart` | `{ instanceId, taskId, definitionName, description? }` |
| `"task.end"` | `taskEnd` | `{ instanceId, taskId, result: DelegationResult }` |
| `"turn.complete"` | `turnComplete` | `{ instanceId, taskId, turnIndex, toolCount, hadError }` |
| `"tool.execute"` | `toolExecute` | `{ instanceId, taskId, toolName, toolCallId, isError }` |
| `"progress.update"` | `progressUpdate` | `{ instanceId, taskId, message }` |
| `"query.response"` | `queryResponse` | `{ instanceId, taskId, queryId, question, answer }` |
| `"summary.available"` | `summaryAvailable` | `{ instanceId, taskId, summary, messageCount }` |
| `"error"` | `error` | `{ instanceId, taskId, error, fatal }` |

The type strings use kebab-case with a `subagent.` prefix for namespace clarity (e.g. `"subagent.task.start"`).

## Files to Create

- `packages/subagents/src/event-defs.ts`

## Verification

- Each creator has the correct `.type` string
- `SubAgentEvents.taskStart.match({ type: "subagent.task.start" })` returns `true`
- All fields from existing `SubAgentEventMap` are covered
