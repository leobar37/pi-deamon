import type { AgentSessionEventListener } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import type { DelegationTask, SubAgentDefinition, SubAgentRunStore } from "../src/types.js";

// =====================================================================
// Mocks — all functions must be defined inline since vi.mock is hoisted
// =====================================================================

vi.mock("../src/workspace/index.js", () => ({
	SubAgentWorkspace: vi.fn().mockImplementation(() => ({
		prepare: vi.fn().mockResolvedValue({
			cwd: "/fake/cwd",
			isolated: false,
			cleanup: vi.fn().mockResolvedValue(undefined),
		}),
	})),
}));

vi.mock("../src/session-factory.js", () => {
	// Build a controllable fake session completely inline

	const listeners = new Set<AgentSessionEventListener>();

	const control = {
		emit(event: any) {
			for (const listener of listeners) {
				listener(event);
			}
		},
	};

	const session = {
		subscribe: vi.fn((fn: AgentSessionEventListener) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		}) as any,
		sendUserMessage: vi.fn().mockImplementation(async () => {
			// Simulate: session sends agent_start -> assistant response -> agent_end
			control.emit({ type: "agent_start" });
			control.emit({ type: "turn_end", toolResults: [] });
			control.emit({
				type: "message_end",
				message: { role: "assistant", content: "Done" },
			});
			control.emit({ type: "agent_end" });
		}),
		steer: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
		model: { provider: "test-provider", id: "test-model" },
		thinkingLevel: "medium",
		isStreaming: false,
		isCompacting: false,
		steeringMode: "all",
		followUpMode: "all",
		sessionFile: undefined,
		sessionId: "fake-session",
		sessionName: undefined,
		autoCompactionEnabled: false,
		messages: [],
		pendingMessageCount: 0,
		modelRegistry: undefined,
		sessionManager: {
			getBranch: vi.fn().mockReturnValue([]),
		},
		setModel: vi.fn(),
		cycleModel: vi.fn(),
		setThinkingLevel: vi.fn(),
		cycleThinkingLevel: vi.fn(),
		setSteeringMode: vi.fn(),
		setFollowUpMode: vi.fn(),
		setAutoCompactionEnabled: vi.fn(),
		setAutoRetryEnabled: vi.fn(),
		abortRetry: vi.fn(),
		abortBash: vi.fn(),
		getSessionStats: vi.fn().mockReturnValue({}),
		exportToHtml: vi.fn().mockResolvedValue(""),
		getLastAssistantText: vi.fn().mockReturnValue("Completed summary"),
		prompt: vi.fn(),
		followUp: vi.fn(),
		clearQueue: vi.fn().mockReturnValue({ steering: [], followUp: [] }),
		getActiveToolNames: vi.fn().mockReturnValue([]),
		getAllTools: vi.fn().mockReturnValue([]),
		setActiveToolsByName: vi.fn(),
		executeBash: vi.fn().mockResolvedValue({ output: "", exitCode: 0 }),
		compact: vi.fn().mockResolvedValue({}),
	};

	return {
		buildSubAgentInstructions: vi.fn().mockReturnValue("Built instructions"),
		createSubAgentSession: vi.fn().mockResolvedValue({ session }),
	};
});

// =====================================================================
// Imports (after mocks)
// =====================================================================

import { SubAgentInstance } from "../src/instance.js";
import { createSubAgentSession } from "../src/session-factory.js";

const sampleDefinition: SubAgentDefinition = {
	name: "test-agent",
	description: "A test agent",
	systemPrompt: "You are a test agent.",
	capabilities: { canEdit: false, canExecute: false, canWrite: false, canResearch: true },
	thinkingLevel: "low",
	allowQuery: true,
	verboseTools: false,
};

const sampleTask: DelegationTask = {
	id: "task-1",
	definition: "test-agent",
	prompt: "Do the thing",
};

function createInstance(eventBus?: any, runStore?: SubAgentRunStore): SubAgentInstance {
	return new SubAgentInstance({
		instanceId: "inst-1",
		config: {
			name: "test-agent",
			description: "A test agent",
			systemPrompt: "You are a test agent.",
			capabilities: { canEdit: false, canExecute: false, canWrite: false, canResearch: true },
			instructionBuilder: undefined,
		},
		definition: sampleDefinition,
		task: sampleTask,
		cwd: "/fake/root",
		resourceCwd: "/fake/root",
		eventBus: eventBus ?? { on: vi.fn(), emit: vi.fn(), subscribe: vi.fn(), clear: vi.fn() },
		runStore,
	});
}

// =====================================================================
// Tests
// =====================================================================

describe("SubAgentInstance", () => {
	describe("constructor", () => {
		it("initializes in created state", () => {
			const instance = createInstance();
			const state = instance.getState();
			expect(state.state).toBe("created");
			expect(state.instanceId).toBe("inst-1");
			expect(state.taskId).toBe("task-1");
		});

		it("emits instance.created event", () => {
			const eventBus = { on: vi.fn(), emit: vi.fn(), subscribe: vi.fn(), clear: vi.fn() };
			const _instance = new SubAgentInstance({
				instanceId: "inst-2",
				config: {} as any,
				definition: sampleDefinition,
				task: sampleTask,
				cwd: "/fake",
				resourceCwd: "/fake",
				eventBus: eventBus as any,
			});
			expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: "instance.created" }));
		});
	});

	describe("start()", () => {
		it("completes and returns DelegationResult", async () => {
			const instance = createInstance();
			const result = await instance.start();
			expect(result.status).toBe("completed");
			expect(result.taskId).toBe("task-1");
		});

		it("returns DelegationResult with correct shape", async () => {
			const instance = createInstance();
			const result = await instance.start();
			expect(result).toHaveProperty("taskId");
			expect(result).toHaveProperty("agent");
			expect(result).toHaveProperty("status");
			expect(result).toHaveProperty("summary");
			expect(result).toHaveProperty("duration");
			expect(result).toHaveProperty("turnCount");
			expect(result).toHaveProperty("finalState");
			expect(result.agent).toBe("test-agent");
		});

		it("fails if called from non-created state", async () => {
			const instance = createInstance();
			await instance.start();
			await expect(instance.start()).rejects.toThrow('Cannot start instance "inst-1" from state "completed"');
		});

		it("passes the parent resource cwd when creating the session", async () => {
			const instance = new SubAgentInstance({
				instanceId: "inst-resource",
				config: {
					name: "test-agent",
					description: "A test agent",
					systemPrompt: "You are a test agent.",
					capabilities: { canEdit: false, canExecute: false, canWrite: false, canResearch: true },
				},
				definition: sampleDefinition,
				task: sampleTask,
				cwd: "/repo/root",
				resourceCwd: "/repo/root",
				eventBus: { on: vi.fn(), emit: vi.fn(), subscribe: vi.fn(), clear: vi.fn() } as any,
			});

			await instance.start();

			expect(createSubAgentSession).toHaveBeenCalledWith(
				expect.objectContaining({
					cwd: "/fake/cwd",
					resourceCwd: "/repo/root",
				}),
			);
		});

		it("emits model metadata after creating the session", async () => {
			const eventBus = { on: vi.fn(), emit: vi.fn(), subscribe: vi.fn(), clear: vi.fn() };
			const instance = createInstance(eventBus);

			await instance.start();

			expect(eventBus.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "instance.state",
					state: expect.objectContaining({
						modelProvider: "test-provider",
						modelId: "test-model",
					}),
				}),
			);
		});

		it("records run input and final output", async () => {
			const runStore: SubAgentRunStore = {
				getPath: vi.fn().mockReturnValue("/tmp/run.json"),
				read: vi.fn().mockResolvedValue(null),
				start: vi.fn().mockResolvedValue({} as any),
				complete: vi.fn().mockResolvedValue({} as any),
			};
			const instance = createInstance(undefined, runStore);

			await instance.start();

			expect(runStore.start).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionId: "fake-session",
					taskId: "task-1",
					instanceId: "inst-1",
					definitionName: "test-agent",
					prompt: "Do the thing",
					modelProvider: "test-provider",
					modelId: "test-model",
				}),
			);
			await vi.waitFor(() => {
				expect(runStore.complete).toHaveBeenCalledWith(
					expect.objectContaining({
						sessionId: "fake-session",
						taskId: "task-1",
						status: "completed",
						summary: "Completed summary",
						turnCount: 1,
						toolCount: 0,
						modelProvider: "test-provider",
						modelId: "test-model",
					}),
				);
			});
		});
	});

	describe("cancel()", () => {
		it("cancel on completed is no-op", async () => {
			const instance = createInstance();
			await instance.start();
			await expect(instance.cancel()).resolves.toBeUndefined();
		});
	});

	describe("getState()", () => {
		it("returns all required fields", () => {
			const instance = createInstance();
			const state = instance.getState();
			expect(state).toHaveProperty("instanceId");
			expect(state).toHaveProperty("taskId");
			expect(state).toHaveProperty("definitionName");
			expect(state).toHaveProperty("state");
			expect(state).toHaveProperty("startTime");
			expect(state).toHaveProperty("endTime");
			expect(state).toHaveProperty("turnCount");
			expect(state).toHaveProperty("lastActivityAt");
			expect(state).toHaveProperty("currentTool");
			expect(state).toHaveProperty("error");
			expect(state).toHaveProperty("toolCount");
			expect(state).toHaveProperty("currentToolStartedAt");
			expect(state).toHaveProperty("durationMs");
		});
	});

	describe("dispose()", () => {
		it("can dispose without starting", async () => {
			const instance = createInstance();
			await expect(instance.dispose()).resolves.toBeUndefined();
		});

		it("is idempotent", async () => {
			const instance = createInstance();
			await instance.dispose();
			await expect(instance.dispose()).resolves.toBeUndefined();
		});
	});

	describe("RPC proxy methods", () => {
		it("getRpcState throws if not running", () => {
			const instance = createInstance();
			expect(() => instance.getRpcState()).toThrow("not running");
		});

		it("getMessages throws if not running", () => {
			const instance = createInstance();
			expect(() => instance.getMessages()).toThrow("not running");
		});

		it("getLastAssistantText throws if not running", () => {
			const instance = createInstance();
			expect(() => instance.getLastAssistantText()).toThrow("not running");
		});

		it("getSessionName throws if not running", () => {
			const instance = createInstance();
			expect(() => instance.getSessionName()).toThrow("not running");
		});
	});

	describe("query()", () => {
		it("returns failed response if not running", async () => {
			const instance = createInstance();
			const response = await instance.query({
				queryId: "q-1",
				question: "What?",
			});
			expect(response.failed).toBe(true);
		});
	});

	describe("summarize()", () => {
		it("returns null if no session", async () => {
			const instance = createInstance();
			const summary = await instance.summarize();
			expect(summary).toBeNull();
		});
	});
});
