# Task Index: subagents-improvements

## Priority Order

**Phase 1 - Foundation (safe simplifications)**
- T-001: Remove dead code (TypedEventBus, presets, dashboard-html, execution system A, commented exports)
- T-002: Remove createEvent() factory, unify to flat event shape
- T-003: Remove dual execution system (migrate controller.executePlan to TaskExecutor)

**Phase 2 - Architecture (reduce complexity)**
- T-004: Simplify delegation guard (113 -> ~15 lines, no regex intent detection)
- T-005: Extract concerns from LionRuntime (split into focused modules)
- T-006: Fix type system issues (inline imports, duplicated EffectiveSubAgentConfig)

**Phase 3 - Test coverage (fill gaps)**
- T-007: Test transport layer (http-server, state-manager, event-store)
- T-008: Test frontend (components, hooks, Zustand stores)

**Phase 4 - Reliability (fix real bugs)**
- T-009: Dashboard reconstruction (replay past events, session_tree handling)
- T-010: Fix chain execution type-unsafe mutation and parallel state machine handshake

## Dependencies

T-002 depends on T-001 (remove dead code first)
T-003 depends on T-002 (event shape unified before refactoring execution)
T-005 depends on T-002, T-003 (simplify foundation before splitting)
T-006 is independent of T-004, T-005
T-007, T-008 are independent of each other
T-009 depends on T-002 (event shape)
T-010 depends on T-003 (execution unified)
