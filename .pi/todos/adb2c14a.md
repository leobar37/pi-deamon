{
  "id": "adb2c14a",
  "title": "Implement event refactoring plan",
  "tags": [
    "event-refactoring",
    "T-001"
  ],
  "status": "closed",
  "created_at": "2026-05-20T20:34:42.359Z"
}

Implement the 8 tasks from .plans/event-refactoring

Completed all 8 tasks:
- T-001: event-core.ts with createEvent, TypedEventBus, Error isolation
- T-002: event-defs.ts with SubAgentEvents (9 event creators)
- T-003: Rewrote SubAgentEventBus with dual new/legacy API
- T-004: Migrated instance.ts emit→publish; controller.ts kept legacy compat
- T-005: Lion events defs.ts with LionEvents (21 event creators)
- T-006: Rewrote LionEventBus with dual API + emit→publish bridge
- T-007: Lion consumers auto-bridged through bus.emit()
- T-008: bun run check passes, subagent tests pass, exports updated
