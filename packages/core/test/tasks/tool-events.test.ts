import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { taskChangedEventFromToolResult } from "../../src/tasks/tool-events.js";
import type { TaskRecord } from "../../src/tasks/types.js";

const task: TaskRecord = {
	id: "deadbeef",
	title: "Emit task progress",
	status: "pending",
	createdAt: "2026-06-15T00:00:00.000Z",
	updatedAt: "2026-06-15T00:00:00.000Z",
	revision: 1,
};

describe("taskChangedEventFromToolResult", () => {
	it("converts todos tool details into task change events", () => {
		const event = taskChangedEventFromToolResult(
			{
				type: "tool_execution_end",
				toolName: "task_create",
				isError: false,
				result: {
					details: {
						action: "create",
						task,
					},
				},
			},
			123,
		);

		assert.ok(event);
		assert.equal(event.type, "task.changed");
		assert.equal(event.action, "created");
		assert.equal(event.taskId, task.id);
		assert.equal(event.task, task);
		assert.equal(event.timestamp, 123);
	});

	it("derives status-specific actions from update results", () => {
		const event = taskChangedEventFromToolResult({
			type: "tool_execution_end",
			toolName: "task_update",
			isError: false,
			result: {
				details: {
					action: "update",
					task: { ...task, status: "completed" },
				},
			},
		});

		assert.ok(event);
		assert.equal(event.action, "completed");
	});

	it("ignores read-only, failed, and unrelated tool results", () => {
		assert.equal(
			taskChangedEventFromToolResult({
				type: "tool_execution_end",
				toolName: "task_list",
				isError: false,
				result: { details: { action: "list", tasks: [task] } },
			}),
			null,
		);
		assert.equal(
			taskChangedEventFromToolResult({
				type: "tool_execution_end",
				toolName: "task_create",
				isError: true,
				result: { details: { action: "create", task } },
			}),
			null,
		);
		assert.equal(
			taskChangedEventFromToolResult({
				type: "tool_execution_end",
				toolName: "bash",
				isError: false,
				result: { details: { action: "create", task } },
			}),
			null,
		);
	});
});
