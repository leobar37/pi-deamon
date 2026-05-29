# Context: packages/subagents Improvements

## Purpose

Analyze and improve `packages/subagents` - the sub-agent controller package with lifecycle management, event system, execution engine, Lion orchestrator, transport layer, and React dashboard frontend.

## Key Findings from Analysis

### Event System (3 buses, dual defs)
- `SubAgentEventBus` (src/event-bus.ts) + `LionRuntimeEventBus` (src/lion/events/bus.ts) + dead `TypedEventBus` (src/event-core.ts)
- Event definitions duplicated with incompatible shapes: flat `SubAgentEventMap` (src/types.ts:254-370) vs wrapped `createEvent()` (src/event-defs.ts:8-40)
- `createEvent()` factory wraps payload in `.payload` but both buses flatten at emit time. Auto-generated `id`/`timestamp` are unused.
- `LionRuntimeEventBus.publish()` uses unsafe `as LionEvent` cast (src/lion/events/bus.ts:9-14)

### Execution (dual systems)
- System A: `src/execution/` (chain.ts, sequential.ts, parallel.ts, execute.ts) - only called by `controller.executePlan()`
- System B: `TaskExecutor` (src/task-executor.ts) - used by Lion runtime
- Both have identical strategy implementations (sequential/parallel/chain/injectOutput)
- Chain.ts line 30: type-unsafe mutation of instance internals

### LionRuntime God Object (src/lion/runtime.ts)
- 568 lines, 28 public methods across 7 concerns: persistence, state, run tracking, UI, dashboard lifecycle, subagent jobs, logging
- Two parallel state machines: `LionCore` (8 states) vs `MainSessionBridge` (3 states) with no handshake
- Two parallel subagent tracking maps: `#subagentJobs` vs `#subagentUi` with overlapping data

### Plan System (dual loaders)
- Flat line-based parser (src/lion/plans/index.ts:30-60) vs structured directory parser (src/lion/plans/structured.ts:24-42)
- Task IDs are unstable line indices (`task-${i}`), shift on file edits
- `LionPlanKind = "overview"` defined but never produced by any code path

### Dashboard (misnamed, no reconstruction)
- Real HTTP server + SSE streaming to frontend, but no dashboard rendering logic
- `LionDashboardServer` created fresh per `start()` - loses all past events
- Dashboard NOT restarted on `session_tree` branch switch
- `dashboard-html.ts` constant is dead code (never imported)

### Delegation Guard (over-engineered)
- 113 lines for what should be ~15 lines
- Fragile regex intent detection (incomplete Spanish, overly broad triggers)
- Per-turn probe budget (3 probes/turn) that resets every turn instead of per-activation
- Verbose block messages waste tokens

### Test Coverage Gaps
- Transport layer (http-server, state-manager, event-store): ZERO tests
- Frontend (18+ components, 6 hooks, 2 Zustand stores): ZERO tests
- Lion commands, tools, task-runner: untested
- Instance lifecycle: mock-tested only (no pause/resume/cancel paths)

### Dead Code
- `TypedEventBus` (src/event-core.ts:51-112) - 62 lines, exported in public API, zero consumers
- 4 instruction presets (src/instructions/presets.ts) - zero external consumers
- `DASHBOARD_HTML` constant (src/transport/dashboard-html.ts) - never imported
- Execution System A (`src/execution/`) - 5 files, barely consumed
- Commented-out export in src/index.ts:30
- `saveEventLog` on artifact store - write-only, never read

### Type System Issues
- Inline `import()` expressions in types.ts (lines 202-205, 242, 250, 263)
- `EffectiveSubAgentConfig` is hand-copied duplicate of `SubAgentDefinition`
- Prompts contain hardcoded tool call examples that drift from actual schemas

### File Stats
- 66 source files in src/
- ~800 lines in transport/ (6 files, zero tests)
- 15 test files, 3,697 lines (11 pass, 4 fail from peer dep resolution)
- Frontend: 18+ React components, 6 hooks, 2 Zustand stores (zero tests)

## Current Interfaces

### Key Data Flows
1. Definition -> resolveEffectiveConfig -> Controller -> Instance -> SubAgentWorkspace -> createSubAgentSession -> instruction builders (core path, works)
2. Instance events -> EventBus -> TransportManager -> HttpServerTransport -> SSE -> frontend (works for live events)
3. Event persistence: JSONL files under `.lion/dashboard-events/` for dashboard recovery (append-only, no rotation)

### Key Gaps
- No shared "run complete" handshake between LionCore and MainSessionBridge
- Controller config drift: extensions controller has full config, Lion controller uses bare minimum
- No dashboard reconstruction on session_tree
- No input/control UI in frontend (read-only)
