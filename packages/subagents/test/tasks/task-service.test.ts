import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { TaskService } from "../../src/tasks/service.js";
import type { SubAgentEvent } from "../../src/types.js";

describe("TaskService", () => {
	it("emits task change events for mutations", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "task-service-"));
		try {
			const events: SubAgentEvent[] = [];
			const service = new TaskService(cwd, (event) => events.push(event));
			const created = await service.create({ title: "Emit task change" }, "session-1");
			assert.ok(!("error" in created));
			assert.equal(events.length, 1);
			assert.equal(events[0]?.type, "task.changed");
			assert.equal(events[0]?.taskId, created.id);
			assert.equal(events[0]?.action, "created");

			const completed = await service.complete(created.id, created.revision, "session-1");
			assert.ok(!("error" in completed));
			assert.equal(events.length, 2);
			assert.equal(events[1]?.type, "task.changed");
			assert.equal(events[1]?.action, "completed");
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});
