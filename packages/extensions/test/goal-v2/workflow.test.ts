import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoalContextTracker } from "../../src/extensions/goal-v2/context-store.js";
import { createCore, setGoal, setGoalPhase, setGoalStatus } from "../../src/extensions/goal-v2/core.js";
import type { GoalContextDocument } from "../../src/extensions/goal-v2/types.js";

function testCoreTracksPhaseAndBlockedStatus(): void {
	const core = createCore();
	const goal = setGoal(core, "ship the feature");

	assert.equal(goal.status, "active");
	assert.equal(goal.phase, "context_gathering");

	setGoalPhase(core, "executing");
	assert.equal(core.goal?.status, "active");
	assert.equal(core.goal?.phase, "executing");

	setGoalPhase(core, "blocked", "waiting for credentials");
	assert.equal(core.goal?.status, "blocked");
	assert.equal(core.goal?.phase, "blocked");
	assert.equal(core.goal?.blockerReason, "waiting for credentials");

	setGoalStatus(core, "active");
	assert.equal(core.goal?.status, "active");
	assert.equal(core.goal?.phase, "executing");
	assert.equal(core.goal?.blockerReason, undefined);
}

async function testContextPersistsStructuredProgress(): Promise<void> {
	const cwd = mkdtempSync(join(tmpdir(), "goal-v2-"));
	try {
		const core = createCore();
		const goal = setGoal(core, "improve goal tracking");
		const tracker = new GoalContextTracker(cwd, "session-1");
		const contextPath = await tracker.initialize(goal);

		await tracker.recordProgress(
			goal,
			{
				kind: "verification",
				summary: "Checked workflow",
				details: "Validated context persistence",
				evidence: ["test/goal-v2/workflow.test.ts"],
			},
			{
				successCriteria: ["progress is durable"],
				relevantFiles: ["packages/extensions/src/extensions/goal-v2/context-store.ts"],
				constraints: ["no provider calls"],
				blockers: ["none"],
				notes: ["keep context compact"],
			},
		);

		const doc = JSON.parse(readFileSync(contextPath, "utf8")) as GoalContextDocument;
		assert.deepEqual(doc.successCriteria, ["progress is durable"]);
		assert.deepEqual(doc.relevantFiles, ["packages/extensions/src/extensions/goal-v2/context-store.ts"]);
		assert.deepEqual(doc.constraints, ["no provider calls"]);
		assert.deepEqual(doc.blockers, ["none"]);
		assert.deepEqual(doc.notes, ["keep context compact"]);
		assert.deepEqual(doc.iterations.at(-1), {
			id: doc.iterations.at(-1)?.id,
			kind: "verification",
			summary: "Checked workflow",
			details: "Validated context persistence",
			evidence: ["test/goal-v2/workflow.test.ts"],
			createdAt: doc.iterations.at(-1)?.createdAt,
		});
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
}

testCoreTracksPhaseAndBlockedStatus();
await testContextPersistsStructuredProgress();
