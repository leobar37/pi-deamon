import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DashboardStateManager } from "../../src/transport/state-manager.js";
import type { SubAgentEvent, SubAgentInstanceState } from "../../src/types.js";

describe("DashboardStateManager", () => {
	let tmpDir: string;
	let manager: DashboardStateManager;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "state-manager-test-"));
		manager = new DashboardStateManager(tmpDir);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	function makeStateEvent(instanceId: string, overrides: Partial<SubAgentInstanceState> = {}): SubAgentEvent {
		const state: SubAgentInstanceState = {
			instanceId,
			taskId: "test-task",
			definitionName: "dev",
			state: "running",
			startTime: Date.now(),
			endTime: null,
			turnCount: 0,
			lastActivityAt: Date.now(),
			currentTool: null,
			error: null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: 0,
			...overrides,
		};
		return {
			type: "instance.state",
			instanceId,
			taskId: "test-task",
			state,
			timestamp: Date.now(),
		} as SubAgentEvent;
	}

	it("rehydrate() loads nothing when no events exist", async () => {
		await manager.rehydrate();
		const all = manager.getAllInstances();
		expect(all).toEqual([]);
	});

	it("appendEvent() persists and updates instance state", async () => {
		const event = makeStateEvent("inst-1");
		await manager.appendEvent("inst-1", event);

		// appendEvent with instance.state adds the instance to live set
		expect(manager.isLive("inst-1")).toBe(true);

		const instance = manager.getInstance("inst-1");
		expect(instance).toBeDefined();
		expect(instance!.instanceId).toBe("inst-1");
		expect(instance!.state).toBe("running");
		expect(instance!.isLive).toBe(true);
	});

	it("rehydrate() loads persisted events as virtual instances", async () => {
		// Persist via first manager
		const event = makeStateEvent("inst-1");
		await manager.appendEvent("inst-1", event);

		// Create a new manager in the same directory and rehydrate
		const manager2 = new DashboardStateManager(tmpDir);
		await manager2.rehydrate();

		const instance = manager2.getInstance("inst-1");
		expect(instance).toBeDefined();
		expect(instance!.instanceId).toBe("inst-1");
		expect(instance!.state).toBe("running");
		// Rehydrated instances are virtual, not live
		expect(instance!.isLive).toBe(false);
	});

	it("registerLiveInstance() adds live instance", () => {
		const state: SubAgentInstanceState = {
			instanceId: "live-1",
			taskId: "task-1",
			definitionName: "dev",
			state: "running",
			startTime: Date.now(),
			endTime: null,
			turnCount: 0,
			lastActivityAt: Date.now(),
			currentTool: null,
			error: null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: 0,
		};
		manager.registerLiveInstance(state);

		expect(manager.isLive("live-1")).toBe(true);
		const instance = manager.getInstance("live-1");
		expect(instance).toBeDefined();
		expect(instance!.isLive).toBe(true);
	});

	it("unregisterLiveInstance() converts live to virtual", () => {
		const state: SubAgentInstanceState = {
			instanceId: "live-1",
			taskId: "task-1",
			definitionName: "dev",
			state: "running",
			startTime: Date.now(),
			endTime: null,
			turnCount: 0,
			lastActivityAt: Date.now(),
			currentTool: null,
			error: null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: 0,
		};
		manager.registerLiveInstance(state);
		expect(manager.isLive("live-1")).toBe(true);

		manager.unregisterLiveInstance("live-1");
		expect(manager.isLive("live-1")).toBe(false);
	});

	it("getAllInstances() returns merged live+virtual", async () => {
		// First persist events to disk so rehydrate can load them as virtual
		await manager.appendEvent("virtual-1", makeStateEvent("virtual-1", { state: "completed" }));

		// Now create a new manager and rehydrate to get virtual instances
		const manager2 = new DashboardStateManager(tmpDir);
		await manager2.rehydrate();

		// Add a live instance
		const liveState: SubAgentInstanceState = {
			instanceId: "live-1",
			taskId: "task-1",
			definitionName: "dev",
			state: "running",
			startTime: Date.now(),
			endTime: null,
			turnCount: 0,
			lastActivityAt: Date.now(),
			currentTool: null,
			error: null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: 0,
		};
		manager2.registerLiveInstance(liveState);

		const all = manager2.getAllInstances();
		expect(all).toHaveLength(2);

		const virtual = all.find((i) => i.instanceId === "virtual-1");
		expect(virtual).toBeDefined();
		expect(virtual!.isLive).toBe(false);

		const live = all.find((i) => i.instanceId === "live-1");
		expect(live).toBeDefined();
		expect(live!.isLive).toBe(true);
	});

	it("getInstance() returns correct instance", () => {
		const state: SubAgentInstanceState = {
			instanceId: "get-inst",
			taskId: "task-1",
			definitionName: "dev",
			state: "running",
			startTime: Date.now(),
			endTime: null,
			turnCount: 0,
			lastActivityAt: Date.now(),
			currentTool: null,
			error: null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: 0,
		};
		manager.registerLiveInstance(state);

		const found = manager.getInstance("get-inst");
		expect(found).toBeDefined();
		expect(found!.instanceId).toBe("get-inst");

		const notFound = manager.getInstance("nonexistent");
		expect(notFound).toBeUndefined();
	});

	it("isLive() returns correct status", () => {
		const state: SubAgentInstanceState = {
			instanceId: "live-check",
			taskId: "task-1",
			definitionName: "dev",
			state: "running",
			startTime: Date.now(),
			endTime: null,
			turnCount: 0,
			lastActivityAt: Date.now(),
			currentTool: null,
			error: null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: 0,
		};
		expect(manager.isLive("live-check")).toBe(false);
		manager.registerLiveInstance(state);
		expect(manager.isLive("live-check")).toBe(true);
		manager.unregisterLiveInstance("live-check");
		expect(manager.isLive("live-check")).toBe(false);
	});
});
