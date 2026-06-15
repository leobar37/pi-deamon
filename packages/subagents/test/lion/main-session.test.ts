import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainSessionBridge } from "../../src/lion/main-session.js";
import { LionRuntime } from "../../src/lion/runtime.js";
import type { SubAgentEvent } from "../../src/types.js";

function createCtx(): ExtensionContext {
	const model = createModel("test-provider", "test-model");
	return {
		isIdle: () => false,
		sessionManager: {
			getSessionId: () => "session-1",
			getSessionName: () => "Main",
			getSessionFile: () => "/tmp/session.jsonl",
			getCwd: () => "/tmp/project",
			getEntries: () => [],
			getLeafId: () => undefined,
		},
		model,
		modelRegistry: {
			find: (provider: string, modelId: string) =>
				provider === "next-provider" && modelId === "next-model" ? createModel(provider, modelId) : null,
			getAvailable: () => [model, createModel("next-provider", "next-model")],
		},
	} as unknown as ExtensionContext;
}

describe("MainSessionBridge timing", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("tracks the current main execution duration instead of accumulating across executions", () => {
		vi.useFakeTimers();
		const bridge = new MainSessionBridge();
		const ctx = createCtx();

		vi.setSystemTime(1000);
		bridge.record({ type: "agent_start" }, ctx);
		vi.setSystemTime(1600);
		bridge.record({ type: "agent_end", messages: [] }, ctx);
		expect(bridge.getThread()?.durationMs).toBe(600);

		vi.setSystemTime(5000);
		bridge.record({ type: "agent_start" }, ctx);
		vi.setSystemTime(5300);
		bridge.record({ type: "agent_end", messages: [] }, ctx);

		expect(bridge.getThread()?.startTime).toBe(5000);
		expect(bridge.getThread()?.durationMs).toBe(300);
	});

	it("tracks the active main-session tool start time", () => {
		vi.useFakeTimers();
		const bridge = new MainSessionBridge();
		const ctx = createCtx();

		vi.setSystemTime(1000);
		bridge.record({ type: "agent_start" }, ctx);
		vi.setSystemTime(1200);
		bridge.record({ type: "tool_execution_start", toolName: "lion_tasks", toolCallId: "tool-1", args: {} }, ctx);

		expect(bridge.getThread()?.currentTool).toBe("lion_tasks");
		expect(bridge.getThread()?.currentToolStartedAt).toBe(1200);

		vi.setSystemTime(1400);
		bridge.record(
			{ type: "tool_execution_end", toolName: "lion_tasks", toolCallId: "tool-1", result: {}, isError: false },
			ctx,
		);

		expect(bridge.getThread()?.currentTool).toBeNull();
		expect(bridge.getThread()?.currentToolStartedAt).toBeNull();
	});

	it("records the main session even when Lion is inactive", () => {
		const runtime = new LionRuntime({} as any, "/tmp/project");
		const ctx = createCtx();

		runtime.restore(ctx);
		runtime.recordMainSessionEvent({ type: "agent_start" }, ctx);

		expect(runtime.state.active).toBe(false);
		expect(runtime.mainSession.getThread()).toMatchObject({
			instanceId: "main:session-1",
			kind: "main",
			state: "running",
			sessionId: "session-1",
		});
	});

	it("keeps user messages from runtime events before session persistence catches up", () => {
		const bridge = new MainSessionBridge();
		const ctx = createCtx();
		const message = {
			role: "user" as const,
			content: "que paso",
			timestamp: 20,
		};

		bridge.record({ type: "message_end", message }, ctx);

		expect(bridge.getMessages("main:session-1")).toEqual([message]);
	});

	it("does not drop runtime messages when turn_end session context is stale", () => {
		const bridge = new MainSessionBridge();
		const ctx = createCtx();
		const events: SubAgentEvent[] = [];
		const message = {
			role: "user" as const,
			content: "que paso",
			timestamp: 20,
		};

		bridge.subscribe((event) => events.push(event));
		bridge.record({ type: "message_end", message }, ctx);
		bridge.record({ type: "turn_end", turnIndex: 0, message: {} as never, toolResults: [] }, ctx);

		expect(bridge.getMessages("main:session-1")).toEqual([message]);
		const snapshot = events.find((event) => event.type === "session.snapshot");
		expect(snapshot && "messages" in snapshot ? snapshot.messages : []).toEqual([message]);
	});

	it("merges agent_end messages instead of replacing the main transcript", () => {
		const bridge = new MainSessionBridge();
		const ctx = createCtx();
		const firstUser = {
			role: "user" as const,
			content: "hola",
			timestamp: 10,
		};
		const firstAssistant = {
			role: "assistant" as const,
			content: [{ type: "text" as const, text: "Hola" }],
			api: "openai" as const,
			timestamp: 11,
			provider: "test-provider",
			model: "test-model",
			usage: emptyUsage(),
			stopReason: "stop" as const,
		};
		const secondUser = {
			role: "user" as const,
			content: "que paso",
			timestamp: 20,
		};
		const secondAssistant = {
			role: "assistant" as const,
			content: [{ type: "text" as const, text: "Nada" }],
			api: "openai" as const,
			timestamp: 21,
			provider: "test-provider",
			model: "test-model",
			usage: emptyUsage(),
			stopReason: "stop" as const,
		};

		bridge.record({ type: "message_end", message: firstUser }, ctx);
		bridge.record({ type: "message_end", message: firstAssistant }, ctx);
		bridge.record({ type: "agent_end", messages: [secondUser, secondAssistant] }, ctx);

		expect(bridge.getMessages("main:session-1")).toEqual([firstUser, firstAssistant, secondUser, secondAssistant]);
	});

	it("selects the real Pi model for the main session", async () => {
		const selectedModels: Model<Api>[] = [];
		const bridge = new MainSessionBridge({
			setModel: async (model: Model<Api>) => {
				selectedModels.push(model);
				return true;
			},
		} as never);
		const events: SubAgentEvent[] = [];
		bridge.subscribe((event) => events.push(event));
		bridge.attach(createCtx());

		const selected = await bridge.setModel("main:session-1", "next-provider", "next-model");

		expect(selected).toBe(true);
		expect(selectedModels).toHaveLength(1);
		expect(selectedModels[0]).toMatchObject({ provider: "next-provider", id: "next-model" });
		expect(bridge.getThread()).toMatchObject({ modelProvider: "next-provider", modelId: "next-model" });
		expect(events.some((event) => event.type === "instance.state" && event.instanceId === "main:session-1")).toBe(
			true,
		);
	});

	it("does not update main session model when Pi rejects the selection", async () => {
		const bridge = new MainSessionBridge({
			setModel: async () => false,
		} as never);
		const events: SubAgentEvent[] = [];
		bridge.subscribe((event) => events.push(event));
		bridge.attach(createCtx());
		events.length = 0;

		const selected = await bridge.setModel("main:session-1", "next-provider", "next-model");

		expect(selected).toBe(false);
		expect(bridge.getThread()).toMatchObject({ modelProvider: "test-provider", modelId: "test-model" });
		expect(events.some((event) => event.type === "instance.state")).toBe(false);
	});
});

function createModel(provider: string, id: string): Model<Api> {
	return {
		api: "openai-completions",
		provider,
		id,
		name: id,
		reasoning: false,
	} as Model<Api>;
}

function emptyUsage() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			total: 0,
		},
	};
}
