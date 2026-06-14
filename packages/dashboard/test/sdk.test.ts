import { describe, expect, it } from "vitest";
import type { DashboardClient } from "../src/sdk.js";
import { createPiSessionsSdk } from "../src/sdk.js";

type ProjectCreateInput = Parameters<DashboardClient["projects"]["create"]>[0];
type ProjectUpdateInput = Parameters<DashboardClient["projects"]["update"]>[0];
type IdInput = { id: string };
type SessionUpdateInput = Parameters<DashboardClient["sessions"]["update"]>[0];
type SessionPromptInput = Parameters<DashboardClient["sessions"]["prompt"]>[0];
type SessionModelInput = Parameters<DashboardClient["sessions"]["model"]>[0];
type LayoutUpdateInput = Parameters<DashboardClient["layout"]["update"]>[0];

function createMockClient(): DashboardClient {
	const session = {
		id: "session-1",
		projectId: "project-1",
		name: "Session",
		threadId: "thread-1",
		cwd: "/tmp/project",
		createdAt: 1,
		updatedAt: 1,
	};
	const runtime = {
		id: "session-1",
		threadId: "thread-1",
		state: "idle" as const,
		isLive: true,
		isRunning: false,
		canPrompt: true,
		canFollowUp: true,
		canSteer: false,
		canAbort: false,
		canResume: true,
		canCancel: true,
		canKill: true,
		lastActivityAt: 2,
		error: null,
		turnCount: 1,
		toolCount: 0,
		durationMs: 10,
		modelProvider: "anthropic",
		modelId: "claude",
	};

	return {
		projects: {
			list: async () => [],
			create: async (input: ProjectCreateInput) => ({
				id: "project-1",
				name: input.name,
				defaultCwd: input.defaultCwd,
				createdAt: 1,
				updatedAt: 1,
			}),
			update: async (input: ProjectUpdateInput) => ({
				id: input.id,
				name: input.name ?? "Project",
				defaultCwd: "/tmp/project",
				createdAt: 1,
				updatedAt: 2,
			}),
			delete: async (input: IdInput) => ({ id: input.id }),
		},
		sessions: {
			list: async () => [session],
			get: async () => session,
			create: async () => session,
			update: async (input: SessionUpdateInput) => ({ ...session, name: input.name ?? session.name }),
			delete: async (input: IdInput) => ({ id: input.id }),
			status: async () => runtime,
			statuses: async () => [runtime],
			abort: async () => ({ ...runtime, state: "idle" as const }),
			resume: async () => ({ ...runtime, state: "running" as const, isRunning: true }),
			cancel: async () => ({ ...runtime, state: "cancelled" as const, isRunning: false }),
			kill: async () => ({ ...runtime, state: "offline" as const, isLive: false, isRunning: false }),
			prompt: async (input: SessionPromptInput) => ({
				id: input.id,
				threadId: "thread-1",
				action: "prompt" as const,
				status: "sent" as const,
				acceptedAt: 3,
			}),
			followUp: async (input: SessionPromptInput) => ({
				id: input.id,
				threadId: "thread-1",
				action: "follow_up" as const,
				status: "sent" as const,
				acceptedAt: 3,
			}),
			steer: async (input: SessionPromptInput) => ({
				id: input.id,
				threadId: "thread-1",
				action: "steer" as const,
				status: "sent" as const,
				acceptedAt: 3,
			}),
			messages: async () => [{ role: "user", content: [] }],
			threadEvents: async () => [{ type: "instance.state" }],
			commands: async () => [{ name: "skill:planner", source: "skill" as const }],
			models: async () => [
				{ provider: "anthropic", id: "claude", name: "Claude", api: "anthropic", reasoning: true },
			],
			model: async (input: SessionModelInput) => ({
				id: input.id,
				threadId: "thread-1",
				action: "select_model" as const,
				status: "sent" as const,
				acceptedAt: 4,
			}),
		},
		events: {
			list: async () => [],
		},
		layout: {
			get: async () => null,
			update: async (input: LayoutUpdateInput) => ({ ...input, updatedAt: 1 }),
		},
		state: {
			get: async () => ({ uptime: 1 }),
		},
		logs: {
			get: async () => ({ logs: [], total: 0 }),
		},
	} as unknown as DashboardClient;
}

describe("createPiSessionsSdk", () => {
	it("exposes declarative session snapshots and actions", async () => {
		const sdk = createPiSessionsSdk({ dashboardUrl: "http://dashboard.test", client: createMockClient() });

		const snapshot = await sdk.sessions.snapshot("session-1");
		expect(snapshot.definition.id).toBe("session-1");
		expect(snapshot.runtime.canPrompt).toBe(true);

		const receipt = await sdk.actions.prompt("session-1", { message: "hello" });
		expect(receipt.action).toBe("prompt");
		const cancelled = await sdk.actions.cancel("session-1");
		expect(cancelled.state).toBe("cancelled");

		const batch = await sdk.batch.status(["session-1"]);
		expect(batch.ok).toHaveLength(1);
		expect(batch.errors).toHaveLength(0);
	});

	it("subscribes to dashboard SSE events", async () => {
		const eventPayload = {
			id: "event-1",
			type: "session.action",
			timestamp: 1,
			sessionId: "session-1",
			threadId: "thread-1",
			projectId: "project-1",
			action: "prompt",
		};
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(eventPayload)}\n\n`));
				controller.close();
			},
		});
		const events: string[] = [];
		const fetchImpl: typeof fetch = async () => new Response(body, { status: 200 });
		const sdk = createPiSessionsSdk({
			dashboardUrl: "http://dashboard.test",
			client: createMockClient(),
			fetch: fetchImpl,
		});

		sdk.events.subscribe({
			sessionId: "session-1",
			onEvent: (event) => events.push(event.type),
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(events).toEqual(["session.action"]);
	});
});
