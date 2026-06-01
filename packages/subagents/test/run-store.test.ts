import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SubAgentRunStore } from "../src/run-store.js";

describe("SubAgentRunStore", () => {
	let tmpDir: string;
	let store: SubAgentRunStore;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "subagent-run-store-"));
		store = new SubAgentRunStore(tmpDir);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("records and reads a running subagent execution", async () => {
		await store.start({
			sessionId: "session-1",
			taskId: "task-1",
			instanceId: "instance-1",
			definitionName: "executor",
			cwd: "/repo",
			prompt: "Implement the task",
			systemPrompt: "You are executor.",
			modelProvider: "test",
			modelId: "model",
			startedAt: 123,
		});

		const record = await store.read("session-1", "task-1");

		expect(record).toMatchObject({
			version: 1,
			sessionId: "session-1",
			taskId: "task-1",
			instanceId: "instance-1",
			definitionName: "executor",
			status: "running",
			prompt: "Implement the task",
			systemPrompt: "You are executor.",
			modelProvider: "test",
			modelId: "model",
			startedAt: 123,
			turnCount: 0,
			toolCount: 0,
		});
	});

	it("records final output and validation metadata", async () => {
		await store.start({
			sessionId: "session-1",
			taskId: "task-1",
			instanceId: "instance-1",
			definitionName: "reviewer",
			cwd: "/repo",
			prompt: "Review the change",
			startedAt: 100,
		});

		await store.complete({
			sessionId: "session-1",
			taskId: "task-1",
			status: "completed",
			summary: "No findings.",
			recordedResult: {
				status: "completed",
				summary: "No findings.",
				files: ["packages/subagents/src/run-store.ts"],
				evidence: ["bun x vitest --run test/run-store.test.ts passed"],
				risks: ["No residual risk"],
				nextStep: "Return to orchestrator",
			},
			completedAt: 200,
			turnCount: 2,
			toolCount: 3,
			modelProvider: "provider",
			modelId: "model",
		});

		const record = await store.read("session-1", "task-1");

		expect(record).toMatchObject({
			status: "completed",
			summary: "No findings.",
			recordedResult: {
				status: "completed",
				summary: "No findings.",
				files: ["packages/subagents/src/run-store.ts"],
				evidence: ["bun x vitest --run test/run-store.test.ts passed"],
				risks: ["No residual risk"],
				nextStep: "Return to orchestrator",
			},
			completedAt: 200,
			turnCount: 2,
			toolCount: 3,
			modelProvider: "provider",
			modelId: "model",
		});
	});

	it("lists run records newest first", async () => {
		await store.start({
			sessionId: "session-1",
			taskId: "older",
			instanceId: "instance-older",
			definitionName: "executor",
			cwd: "/repo",
			prompt: "Older task",
			startedAt: 100,
		});
		await store.start({
			sessionId: "session-2",
			taskId: "newer",
			instanceId: "instance-newer",
			definitionName: "reviewer",
			cwd: "/repo",
			prompt: "Newer task",
			startedAt: 200,
		});

		const records = await store.list();

		expect(records.map((record) => record.taskId)).toEqual(["newer", "older"]);
	});

	it("filters listed run records", async () => {
		await store.start({
			sessionId: "session-1",
			taskId: "task-1",
			instanceId: "instance-1",
			definitionName: "executor",
			cwd: "/repo",
			runId: "run-a",
			prompt: "Implement",
			startedAt: 100,
		});
		await store.complete({
			sessionId: "session-1",
			taskId: "task-1",
			status: "completed",
			summary: "Done",
			completedAt: 300,
			turnCount: 1,
			toolCount: 1,
		});
		await store.start({
			sessionId: "session-2",
			taskId: "task-2",
			instanceId: "instance-2",
			definitionName: "reviewer",
			cwd: "/repo",
			runId: "run-b",
			prompt: "Review",
			startedAt: 200,
		});

		expect((await store.list({ status: "completed" })).map((record) => record.taskId)).toEqual(["task-1"]);
		expect((await store.list({ runId: "run-b" })).map((record) => record.taskId)).toEqual(["task-2"]);
		expect((await store.list({ definitionName: "executor" })).map((record) => record.taskId)).toEqual(["task-1"]);
		expect((await store.list({ sessionId: "session-2" })).map((record) => record.taskId)).toEqual(["task-2"]);
	});
});
