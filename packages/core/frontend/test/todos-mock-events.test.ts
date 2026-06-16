import { describe, expect, it } from "vitest";
import { advanceMockTodoProgress } from "../src/mocks/tasks";

describe("todos mock progress events", () => {
	it("emits a tool session event and matching task change event", () => {
		const events = advanceMockTodoProgress();

		expect(events.sessionEvent.type).toBe("session.event");
		expect(events.taskEvent.type).toBe("task.changed");
		if (events.sessionEvent.type !== "session.event" || events.taskEvent.type !== "task.changed") {
			throw new Error("Unexpected mock event shape");
		}

		expect(events.sessionEvent.sessionEvent.type).toBe("tool_execution_end");
		expect(events.sessionEvent.sessionEvent.toolName).toMatch(/^task_/);
		expect(events.taskEvent.taskId).toBe(events.taskEvent.task.id);
	});
});
