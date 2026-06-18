import assert from "node:assert/strict";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { formatTaskList, renderTaskList, serializeTaskListForAgent } from "../../src/extensions/todos/format.js";
import type { TaskRecord } from "../../src/extensions/todos/types.js";

const tasks: TaskRecord[] = [
	{
		id: "11111111",
		title: "Active task",
		status: "in_progress",
		createdAt: "2026-06-17T00:00:00.000Z",
		updatedAt: "2026-06-17T00:00:00.000Z",
		revision: 1,
	},
	{
		id: "22222222",
		title: "Pending task",
		status: "pending",
		createdAt: "2026-06-17T00:00:00.000Z",
		updatedAt: "2026-06-17T00:00:00.000Z",
		revision: 1,
	},
	{
		id: "33333333",
		title: "Blocked task",
		status: "blocked",
		createdAt: "2026-06-17T00:00:00.000Z",
		updatedAt: "2026-06-17T00:00:00.000Z",
		revision: 1,
	},
	{
		id: "44444444",
		title: "Completed task",
		status: "completed",
		createdAt: "2026-06-17T00:00:00.000Z",
		updatedAt: "2026-06-17T00:00:00.000Z",
		completedAt: "2026-06-17T00:00:00.000Z",
		revision: 1,
	},
];

const plainTheme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as unknown as Theme;

function assertNoSections(text: string): void {
	assert.ok(!text.includes("In progress"));
	assert.ok(!text.includes("Pending ("));
	assert.ok(!text.includes("Blocked ("));
	assert.ok(!text.includes("Completed ("));
	assert.ok(!text.includes("none"));
}

describe("todos task formatting", () => {
	it("formats console task output as a flat checklist", () => {
		const text = formatTaskList(tasks);

		assertNoSections(text);
		assert.match(text, /\[ \] TASK-11111111 Active task/);
		assert.match(text, /\[ \] TASK-22222222 Pending task/);
		assert.match(text, /\[ \] TASK-33333333 Blocked task/);
		assert.match(text, /\[x\] TASK-44444444 Completed task/);
	});

	it("renders tool task output as a flat checklist", () => {
		const text = renderTaskList(plainTheme, tasks, true);

		assertNoSections(text);
		assert.match(text, /\[ \] TASK-11111111 Active task/);
		assert.match(text, /\[ \] TASK-22222222 Pending task/);
		assert.match(text, /\[ \] TASK-33333333 Blocked task/);
		assert.match(text, /\[x\] TASK-44444444 Completed task/);
	});

	it("keeps agent serialization grouped by internal status", () => {
		const parsed = JSON.parse(serializeTaskListForAgent(tasks)) as {
			in_progress: TaskRecord[];
			pending: TaskRecord[];
			blocked: TaskRecord[];
			completed: TaskRecord[];
		};

		assert.equal(parsed.in_progress[0]?.title, "Active task");
		assert.equal(parsed.pending[0]?.title, "Pending task");
		assert.equal(parsed.blocked[0]?.title, "Blocked task");
		assert.equal(parsed.completed[0]?.title, "Completed task");
	});
});
