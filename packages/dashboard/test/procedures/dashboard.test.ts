import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { RPCHandler } from "@orpc/server/fetch";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SubagentsClient } from "../../src/api/subagents-client.js";
import type { dashboardContract } from "../../src/contract.js";
import { createDatabase } from "../../src/db/connection.js";
import { runMigrations } from "../../src/db/migrate.js";
import {
	createCanvasNodeRepository,
	createProjectRepository,
	createSessionRepository,
} from "../../src/db/repositories.js";
import { DashboardEventBus } from "../../src/events.js";
import { createDashboardRouter } from "../../src/procedures/index.js";

function createTestContext() {
	const dir = mkdtempSync(join(tmpdir(), "pi-dashboard-proc-test-"));
	const dbPath = join(dir, "dashboard.sqlite");
	const db = createDatabase({ path: dbPath });
	runMigrations(db);
	return {
		dir,
		db,
		projects: createProjectRepository(db),
		sessions: createSessionRepository(db),
		canvasNodes: createCanvasNodeRepository(db),
		events: new DashboardEventBus(),
	};
}

function createMockSubagentsClient(threadId: string): SubagentsClient {
	let state: "running" | "paused" = "running";
	const promptCalls: Array<{ message: string; mode: "prompt" | "follow_up" | "steer" }> = [];
	return {
		threads: {
			create: async () => ({
				threadId,
				name: "Mock Session",
				createdAt: Date.now(),
				cwd: "/mock",
			}),
			get: async () => ({
				instanceId: threadId,
				taskId: "task-1",
				definitionName: "standalone",
				cwd: "/mock",
				runId: "run-1",
				runIndex: 0,
				state,
				startTime: Date.now(),
				endTime: null,
				turnCount: 0,
				lastActivityAt: Date.now(),
				currentTool: null,
				error: null,
				toolCount: 0,
				currentToolStartedAt: null,
				durationMs: 0,
				kind: "main" as const,
				isLive: true,
				sessionId: "session-1",
			}),
			abort: async () => {
				state = "paused";
				return { threadId };
			},
			resume: async () => {
				state = "running";
				return { threadId };
			},
			cancel: async () => {
				state = "paused";
				return { threadId };
			},
			kill: async () => {
				state = "paused";
				return { threadId };
			},
			prompt: async (input: { message: string; mode: "prompt" | "follow_up" | "steer" }) => {
				promptCalls.push({ message: input.message, mode: input.mode });
				state = "running";
				return { threadId, mode: input.mode, status: "sent" as const, acceptedAt: Date.now() };
			},
			messages: async () => [{ role: "user", content: [] }],
			events: async () => [{ type: "instance.state" }],
			commands: async () => [{ name: "skill:planner", source: "skill" as const }],
			models: async () => [
				{ provider: "anthropic", id: "claude", name: "Claude", api: "anthropic", reasoning: true },
			],
			model: async () => ({
				threadId,
				provider: "anthropic",
				modelId: "claude",
				status: "selected" as const,
				selectedAt: Date.now(),
			}),
		},
	} as unknown as SubagentsClient;
}

function createTestClient(options: {
	context: ReturnType<typeof createTestContext>;
	subagentsUrl?: string;
	createSubagentsClient?: (url: string) => SubagentsClient;
}) {
	const ctx = options.context;
	const router = createDashboardRouter({
		getStartTime: () => Date.now(),
		context: {
			db: ctx.db,
			projects: ctx.projects,
			sessions: ctx.sessions,
			canvasNodes: ctx.canvasNodes,
			events: ctx.events,
		},
		getSubagentsUrl: () => options.subagentsUrl,
		createSubagentsClient: options.createSubagentsClient,
	});
	const handler = new RPCHandler(router);
	const link = new RPCLink({
		url: "http://localhost/rpc",
		fetch: async (request) => {
			const { response } = await handler.handle(request, {
				prefix: "/rpc",
				context: {
					db: ctx.db,
					projects: ctx.projects,
					sessions: ctx.sessions,
					canvasNodes: ctx.canvasNodes,
					events: ctx.events,
				},
			});
			return response ?? new Response("Not found", { status: 404 });
		},
	});
	return createORPCClient(link) as ContractRouterClient<typeof dashboardContract>;
}

describe("dashboard procedures", () => {
	let ctx: ReturnType<typeof createTestContext>;
	let cleanup = () => {};

	beforeEach(() => {
		ctx = createTestContext();
		cleanup = () => {
			rmSync(ctx.dir, { recursive: true, force: true });
		};
	});

	afterEach(() => {
		cleanup();
	});

	it("creates, lists, updates, and deletes projects", async () => {
		const client = createTestClient({ context: ctx });

		const created = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		expect(created.name).toBe("Test");

		const listed = await client.projects.list();
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(created.id);

		const updated = await client.projects.update({ id: created.id, name: "Renamed" });
		expect(updated.name).toBe("Renamed");

		await client.projects.delete({ id: created.id });
		expect(await client.projects.list()).toHaveLength(0);
	});

	it("records typed dashboard events", async () => {
		const client = createTestClient({ context: ctx });

		const project = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		const session = await client.sessions.create({ projectId: project.id });

		const events = await client.events.list({ projectId: project.id });
		expect(events.map((event) => event.type)).toContain("project.created");
		expect(events.map((event) => event.type)).toContain("session.created");
		const sessionEvent = events.find((event) => event.type === "session.created");
		expect(sessionEvent?.session.id).toBe(session.id);
	});

	it("creates a session and materializes it in subagents", async () => {
		const threadId = "standalone-test-thread";
		const subagentsClient = createMockSubagentsClient(threadId);
		const client = createTestClient({
			context: ctx,
			subagentsUrl: "http://127.0.0.1:9999",
			createSubagentsClient: () => subagentsClient,
		});

		const project = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		const session = await client.sessions.create({ projectId: project.id });
		expect(session.projectId).toBe(project.id);
		expect(session.threadId).toBe(threadId);

		const status = await client.sessions.status({ id: session.id });
		expect(status.state).toBe("running");
		expect(status.isRunning).toBe(true);
		expect(status.canAbort).toBe(true);
	});

	it("aborts a live session through subagents", async () => {
		const threadId = "standalone-test-thread";
		const subagentsClient = createMockSubagentsClient(threadId);
		const client = createTestClient({
			context: ctx,
			subagentsUrl: "http://127.0.0.1:9999",
			createSubagentsClient: () => subagentsClient,
		});

		const project = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		const session = await client.sessions.create({ projectId: project.id });

		const runtime = await client.sessions.abort({ id: session.id });
		expect(runtime.state).toBe("idle");
		expect(runtime.isRunning).toBe(false);
		expect(runtime.canAbort).toBe(false);
	});

	it("proxies declarative session runtime actions through subagents", async () => {
		const threadId = "standalone-test-thread";
		const subagentsClient = createMockSubagentsClient(threadId);
		const client = createTestClient({
			context: ctx,
			subagentsUrl: "http://127.0.0.1:9999",
			createSubagentsClient: () => subagentsClient,
		});

		const project = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		const session = await client.sessions.create({ projectId: project.id });

		const prompt = await client.sessions.prompt({ id: session.id, message: "Build this" });
		const commands = await client.sessions.commands({ id: session.id });
		const messages = await client.sessions.messages({ id: session.id });
		const resumed = await client.sessions.resume({ id: session.id });
		const cancelled = await client.sessions.cancel({ id: session.id });
		const killed = await client.sessions.kill({ id: session.id });
		const events = await client.events.list({ sessionId: session.id });

		expect(prompt.action).toBe("prompt");
		expect(commands[0]?.name).toBe("skill:planner");
		expect(messages).toHaveLength(1);
		expect(resumed.state).toBe("running");
		expect(cancelled.state).toBe("idle");
		expect(killed.state).toBe("offline");
		expect(events.map((event) => event.type)).toContain("session.action");
	});

	it("marks sessions as offline when subagents is unreachable", async () => {
		const client = createTestClient({ context: ctx });

		const project = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		const session = await client.sessions.create({ projectId: project.id, name: "Offline" });
		expect(session.threadId).toBeNull();

		const status = await client.sessions.status({ id: session.id });
		expect(status.state).toBe("offline");
		expect(status.isLive).toBe(false);
	});

	it("persists canvas node layout", async () => {
		const client = createTestClient({ context: ctx });

		const project = await client.projects.create({ name: "Test", defaultCwd: "/tmp/test" });
		const session = await client.sessions.create({ projectId: project.id });

		const node = await client.layout.update({
			sessionId: session.id,
			x: 10,
			y: 20,
			width: 100,
			height: 200,
		});
		expect(node.x).toBe(10);

		const fetched = await client.layout.get({ sessionId: session.id });
		expect(fetched?.width).toBe(100);
	});
});
