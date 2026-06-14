import { describe, expect, it } from "vitest";
import { createDashboardEvent, DashboardEventBus } from "../../src/events.js";

describe("DashboardEventBus", () => {
	it("dispatches typed events and replays filtered history", () => {
		const bus = new DashboardEventBus();
		const received: string[] = [];
		const unsubscribe = bus.on("session.runtime", (event) => {
			received.push(event.runtime.id);
		});

		bus.emit(
			createDashboardEvent("project.created", {
				project: {
					id: "project-1",
					name: "Project",
					defaultCwd: "/tmp/project",
					createdAt: 1,
					updatedAt: 1,
				},
			}),
		);
		bus.emit(
			createDashboardEvent("session.runtime", {
				projectId: "project-1",
				runtime: {
					id: "session-1",
					threadId: "thread-1",
					state: "running",
					isLive: true,
					isRunning: true,
					canPrompt: false,
					canFollowUp: true,
					canSteer: true,
					canAbort: true,
					canResume: false,
					canCancel: true,
					canKill: true,
					lastActivityAt: 2,
					error: null,
					turnCount: 1,
					toolCount: 0,
					durationMs: 10,
					modelProvider: "anthropic",
					modelId: "claude",
				},
			}),
		);

		unsubscribe();

		expect(received).toEqual(["session-1"]);
		expect(bus.list({ projectId: "project-1" })).toHaveLength(2);
		expect(bus.list({ sessionId: "session-1" }).map((event) => event.type)).toEqual(["session.runtime"]);
	});
});
