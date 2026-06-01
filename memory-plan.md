# Lion Memory Plan

## Current Position

Lion can work without a shared memory store today.

The current flow already has:

- durable plan files under `.plans/<slug>/`
- phase separation between planning and building
- `lion_tasks` as the delegation boundary
- subagent context recording
- compaction hooks for the main Lion session and subagent sessions
- structured run and job state for active execution

This is enough for supervised medium-sized work where the orchestrator can keep recent context in the active session and where subagent outputs are reviewed promptly.

## Limitation

For long-running work, relying only on the active context window and recent subagent summaries is fragile.

The main risks are:

- compaction can preserve only a small working window
- old decisions can fall out of the active prompt
- subagent findings can become hard to retrieve after several rounds
- build continuation depends too much on recent summaries
- review and validation evidence can become scattered across messages and logs

## Proposed Direction

Add a shared Lion memory store scoped to the active plan.

The memory should be available to:

- the main Lion orchestrator
- analyzer, planner, executor, reviewer, and validator subagents
- compaction
- dashboard and debugging surfaces

The memory store should live inside the plan folder:

```text
.plans/<slug>/
  lion/
    memory/
      index.json
      decisions.jsonl
      evidence.jsonl
      blockers.jsonl
      files.jsonl
      subagents.jsonl
      handoffs.jsonl
```

The JSONL files should be append-only. Derived files such as `index.json` can be updated for fast lookup, but the append-only records should remain the source of truth.

## Main Orchestrator Writes

The main orchestrator should record:

- interpreted user objective
- active plan and task
- orchestration decisions
- blockers and recovery decisions
- next step
- review or validation gates

## Subagent Writes

Subagents should record:

- findings
- files inspected
- files changed
- validation evidence
- blockers
- final structured result
- handoff notes for the next agent

## Tool Surface

Potential shared tools:

```text
lion_memory_write
lion_memory_read
lion_memory_search
lion_memory_summarize
```

Subagents can either use the same tools with scoped permissions or wrapper tools:

```text
subagent_memory_write
subagent_memory_read
```

The implementation should keep one physical store. The wrapper names should only express role and permission boundaries.

## Compaction Behavior

Compaction should not paste the full memory store into the prompt.

It should preserve:

- a small working window
- the active objective
- active plan and task
- current blocker, if any
- latest decisions
- latest handoff
- pointers to relevant memory files and entries

Example compaction pointer:

```text
Lion memory store: .plans/example/lion/memory
Recent decisions: decisions.jsonl entries 14-18
Active blocker: blockers.jsonl entry 3
Current handoff: handoffs.jsonl entry 7
```

## Implementation Notes

This should be implemented as a plan-scoped memory service, not as ad hoc file writes inside tools.

Suggested pieces:

- `LionMemoryStore`
- typed memory entry schemas
- append-only JSONL writer
- index builder or lightweight search
- main-thread memory tools
- subagent memory tools or scoped wrappers
- compaction integration that emits a short window plus store pointers
- tests for append-only writes, read/search behavior, and compaction output

## Decision

Do not block current Lion usage on this memory layer.

Treat it as the next hardening step before trusting Lion with long, multi-round builds.
