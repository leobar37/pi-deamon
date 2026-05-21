# Task Index: Event System Refactoring

## Plan

- **Slug**: event-refactoring
- **Mode**: structured
- **Phases**: foundation → subagents → lion → integration

## Tasks

| ID | Title | Phase | Dependencies | Requirements |
|---|---|---|---|---|
| T-001 | Event primitives (`event-core.ts`) | foundation | — | FR-001, FR-002, NFR-001, NFR-002, NFR-003, NFR-004 |
| T-002 | SubAgent event definitions (`event-defs.ts`) | foundation | T-001 | FR-004 |
| T-003 | Rewrite `SubAgentEventBus` | subagents | T-002 | FR-003, NFR-005 |
| T-004 | Migrate `instance.ts` and `controller.ts` | subagents | T-003 | FR-006, NFR-005 |
| T-005 | Lion event definitions | lion | T-001 | FR-005 |
| T-006 | Rewrite `LionEventBus` | lion | T-005 | FR-003 (parallel to T-003) |
| T-007 | Migrate lion consumers | lion | T-006 | FR-007 |
| T-008 | Final check and cleanup | integration | T-004, T-007 | NFR-005, NFR-006 |

## Phases

1. **foundation**: Build the shared primitives and define subagent event creators
2. **subagents**: Rewrite SubAgentEventBus and migrate its consumers
3. **lion**: Define lion event creators, rewrite LionEventBus, migrate consumers
4. **integration**: Run full check, fix remaining issues, verify no breaking changes
