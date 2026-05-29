# Requirements

## Goals

1. **Simplify event system** - single unified bus with one flat event shape, remove dead TypedEventBus, remove createEvent() factory ceremony
2. **Unify execution** - remove dual execution systems, keep TaskExecutor as single path
3. **Extract concerns from LionRuntime** - no god object, split into focused modules
4. **Remove dead code** - presets, dashboard-html, typed-event-bus, execution system A
5. **Fix delegation guard** - reduce from 113 lines to ~15, remove fragile intent detection
6. **Test transport layer** - http-server, state-manager, event-store coverage
7. **Test frontend** - components, hooks, stores
8. **Fix type hygiene** - no inline imports, derive EffectiveSubAgentConfig
9. **Dashboard reconstruction** - replay past events on start, handle session_tree

## Non-Goals

- Rewrite the frontend from scratch
- Change the package API surface unless removing dead code
- Add new features (input bar, cancel/retry) without solid foundation
- Merge SubAgentEventBus and LionRuntimeEventBus into one (different domains, valid separate buses)
- Full integration test suite (focus on transport + frontend coverage)

## Constraints

- Must not break existing extensions consumers that use subagent_run / subagent_run_plan
- Must not break the Lion workflow (lion_tasks, plan management)
- All changes must preserve the package's public API unless removing dead code
- Frontend tests must use Vitest + jsdom (already configured)
- Transport tests must use Bun.serve mock or a local HTTP server in test
