import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SubAgentEventStore } from "../../src/transport/event-store.js";
import type { SubAgentEvent } from "../../src/types.js";

describe("SubAgentEventStore", () => {
	let tmpDir: string;
	let store: SubAgentEventStore;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "event-store-test-"));
		store = new SubAgentEventStore(tmpDir);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	function makeEvent(overrides: Partial<SubAgentEvent> = {}): SubAgentEvent {
		return {
			type: "instance.created",
			instanceId: "test-instance",
			taskId: "test-task",
			definitionName: "dev",
			timestamp: Date.now(),
			...overrides,
		} as SubAgentEvent;
	}

	it("append() writes event to .events.jsonl file", async () => {
		const event = makeEvent();
		await store.append("inst-1", event);

		const dotLionDir = join(tmpDir, ".lion", "dashboard-events");
		const file = join(dotLionDir, "inst-1.events.jsonl");
		expect(existsSync(file)).toBe(true);
	});

	it("read() returns events in order written", async () => {
		const e1 = makeEvent({ type: "instance.created", timestamp: 1 });
		const e2 = makeEvent({ type: "task.start", timestamp: 2 }) as SubAgentEvent;

		await store.append("inst-1", e1);
		await store.append("inst-1", e2);

		const events = await store.read("inst-1");
		expect(events).toHaveLength(2);
		expect(events[0].type).toBe("instance.created");
		expect(events[1].type).toBe("task.start");
	});

	it("read() returns empty array for unknown instance", async () => {
		const events = await store.read("non-existent");
		expect(events).toEqual([]);
	});

	it("readAllInstanceIds() returns list of instance IDs", async () => {
		await store.append("inst-1", makeEvent());
		await store.append("inst-2", makeEvent());

		const ids = await store.readAllInstanceIds();
		expect(ids.sort()).toEqual(["inst-1", "inst-2"]);
	});

	it("multiple events for same instance", async () => {
		for (let i = 0; i < 5; i++) {
			await store.append("inst-1", makeEvent({ timestamp: i }));
		}

		const events = await store.read("inst-1");
		expect(events).toHaveLength(5);
	});

	it("events from different instances are separate", async () => {
		await store.append("a", makeEvent({ instanceId: "a", timestamp: 1 }));
		await store.append("b", makeEvent({ instanceId: "b", timestamp: 2 }));

		const aEvents = await store.read("a");
		const bEvents = await store.read("b");
		expect(aEvents).toHaveLength(1);
		expect(bEvents).toHaveLength(1);
		expect(aEvents[0].instanceId).toBe("a");
		expect(bEvents[0].instanceId).toBe("b");
	});

	it("handles empty file gracefully", async () => {
		const dotLionDir = join(tmpDir, ".lion", "dashboard-events");
		mkdirSync(dotLionDir, { recursive: true });
		writeFileSync(join(dotLionDir, "empty.events.jsonl"), "", "utf-8");

		const events = await store.read("empty");
		expect(events).toEqual([]);
	});

	it("handles malformed JSON lines gracefully", async () => {
		const dotLionDir = join(tmpDir, ".lion", "dashboard-events");
		mkdirSync(dotLionDir, { recursive: true });
		const content = `{"valid": true}\nnot-json\n{"also-valid": true}\n`;
		writeFileSync(join(dotLionDir, "mixed.events.jsonl"), content, "utf-8");

		const events = await store.read("mixed");
		// Only valid JSON lines are parsed; malformed lines are skipped
		expect(events).toHaveLength(2);
	});

	it("readAllInstanceIds() returns empty when no directory exists", async () => {
		const freshStore = new SubAgentEventStore("/nonexistent/path");
		const ids = await freshStore.readAllInstanceIds();
		expect(ids).toEqual([]);
	});
});
