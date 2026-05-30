import { describe, expect, it, beforeEach } from "vitest";
import { createSessionRuntime } from "../src/store/runtime.js";
import { applyEvent } from "../src/store/event-handlers/index.js";
import { subagentTreeAtom } from "../src/store/atoms.js";
import type { SessionRuntime } from "../src/store/runtime.js";
import type { ServerEvent } from "@local/pi-dashboard";

describe("event handlers", () => {
	let runtime: SessionRuntime;

	beforeEach(() => {
		runtime = createSessionRuntime();
	});

	describe("message lifecycle", () => {
		it("creates a new assistant message on message_start", () => {
			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_start",
				message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, event);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			expect(msgIds.length).toBe(1);
			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[0]));
			expect(msg?.role).toBe("assistant");
			expect(msg?.partial).toBe(true);
		});

		it("creates a new user message on message_start", () => {
			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_start",
				message: { role: "user", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, event);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			expect(msgIds.length).toBe(1);
			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[0]));
			expect(msg?.role).toBe("user");
			expect(msg?.partial).toBe(true);
		});

		it("skips duplicate user messages", () => {
			// First message
			const event1: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_start",
				message: { role: "user", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, event1);

			// End the first message so it's no longer partial
			const endEvent: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_end",
				message: { role: "user", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, endEvent);

			// Duplicate message
			const event2: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_start",
				message: { role: "user", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, event2);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			expect(msgIds.length).toBe(1);
		});

		it("reuses recently confirmed message for server echo", () => {
			// Simulate optimistic message that was confirmed
			const now = Date.now();
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: "optimistic-m1",
				value: {
					id: "optimistic-m1",
					sessionId: "s1",
					role: "user" as const,
					blocks: [{ type: "text" as const, text: "hello" }],
					timestamp: now,
					streaming: false,
					optimistic: false,
					partial: false,
				},
			});

			// Server echo arrives
			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: now + 100,
				type: "message_start",
				message: { role: "user", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, event);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			expect(msgIds.length).toBe(1);
			const msg = runtime.store.get(runtime.maps.messages.atomFor("optimistic-m1"));
			expect(msg?.partial).toBe(true);
		});

		it("updates partial message on message_update", () => {
			const startEvent: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_start",
				message: { role: "assistant", content: [{ type: "text", text: "he" }] },
			};
			applyEvent(runtime, startEvent);

			const updateEvent: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_update",
				message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
				assistantMessageEvent: undefined,
			};
			applyEvent(runtime, updateEvent);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[0]));
			expect(msg?.blocks[0]).toEqual({ type: "text", text: "hello" });
		});

		it("finalizes message on message_end", () => {
			const startEvent: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_start",
				message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
			};
			applyEvent(runtime, startEvent);

			const endEvent: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "message_end",
				message: { role: "assistant", content: [{ type: "text", text: "hello world" }] },
			};
			applyEvent(runtime, endEvent);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[0]));
			expect(msg?.partial).toBe(false);
			expect(msg?.streaming).toBe(false);
		});
	});

	describe("thinking blocks", () => {
		it("creates thinking block on thinking_start", () => {
			// First create a partial assistant message
			const msgId = "m1";
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgId,
				value: {
					id: msgId,
					sessionId: "s1",
					role: "assistant" as const,
					blocks: [],
					timestamp: Date.now(),
					streaming: true,
					partial: true,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "thinking_start",
				contentIndex: 0,
			};
			applyEvent(runtime, event);

			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgId));
			expect(msg?.blocks[0]).toEqual({ type: "thinking", thinking: "" });
		});

		it("appends to thinking block on thinking_delta", () => {
			const msgId = "m1";
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgId,
				value: {
					id: msgId,
					sessionId: "s1",
					role: "assistant" as const,
					blocks: [{ type: "thinking" as const, thinking: "" }],
					timestamp: Date.now(),
					streaming: true,
					partial: true,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "thinking_delta",
				contentIndex: 0,
				delta: "Let me think...",
			};
			applyEvent(runtime, event);

			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgId));
			expect(msg?.blocks[0]).toEqual({ type: "thinking", thinking: "Let me think..." });
		});
	});

	describe("text deltas", () => {
		it("appends text on text_delta", () => {
			const msgId = "m1";
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgId,
				value: {
					id: msgId,
					sessionId: "s1",
					role: "assistant" as const,
					blocks: [{ type: "text" as const, text: "Hel" }],
					timestamp: Date.now(),
					streaming: true,
					partial: true,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "text_delta",
				contentIndex: 0,
				delta: "lo",
			};
			applyEvent(runtime, event);

			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgId));
			expect(msg?.blocks[0]).toEqual({ type: "text", text: "Hello" });
		});
	});

	describe("tool execution", () => {
		it("creates tool message on tool_execution_start", () => {
			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "tool_execution_start",
				toolCallId: "tc1",
				toolName: "read_file",
				args: { path: "/test" },
			};
			applyEvent(runtime, event);

			const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor("s1"));
			expect(msgIds.length).toBe(1);
			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[0]));
			expect(msg?.role).toBe("tool");
			expect(msg?.toolName).toBe("read_file");
			expect(msg?.partial).toBe(true);
		});

		it("updates partial result on tool_execution_update", () => {
			const msgId = "m1";
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgId,
				value: {
					id: msgId,
					sessionId: "s1",
					role: "tool" as const,
					blocks: [],
					timestamp: Date.now(),
					streaming: true,
					toolCallId: "tc1",
					toolName: "read_file",
					partial: true,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "tool_execution_update",
				toolCallId: "tc1",
				toolName: "read_file",
				args: { path: "/test" },
				partialResult: "partial output...",
			};
			applyEvent(runtime, event);

			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgId));
			expect(msg?.blocks[0]).toEqual({
				type: "toolResult",
				toolCallId: "tc1",
				content: "partial output...",
				isError: false,
			});
		});

		it("finalizes tool message on tool_execution_end", () => {
			const msgId = "m1";
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgId,
				value: {
					id: msgId,
					sessionId: "s1",
					role: "tool" as const,
					blocks: [],
					timestamp: Date.now(),
					streaming: true,
					toolCallId: "tc1",
					toolName: "read_file",
					partial: true,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "tool_execution_end",
				toolCallId: "tc1",
				toolName: "read_file",
				result: "file content",
				isError: false,
			};
			applyEvent(runtime, event);

			const msg = runtime.store.get(runtime.maps.messages.atomFor(msgId));
			expect(msg?.partial).toBe(false);
			expect(msg?.streaming).toBe(false);
			expect(msg?.blocks[0]).toEqual({
				type: "toolResult",
				toolCallId: "tc1",
				content: "file content",
				isError: false,
			});
		});
	});

	describe("session lifecycle", () => {
		it("updates session status on session_started", () => {
			runtime.store.set(runtime.maps.sessions.mapAtom, {
				type: "set",
				key: "s1",
				value: {
					info: {
						id: "s1",
						status: "created" as const,
						isActive: false,
						cwd: "",
						createdAt: Date.now(),
						lastActivityAt: Date.now(),
						messageCount: 0,
					},
					streaming: false,
					compacting: false,
					pendingMessages: 0,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "session_started",
			};
			applyEvent(runtime, event);

			const entry = runtime.store.get(runtime.maps.sessions.atomFor("s1"));
			expect(entry?.info.status).toBe("idle");
			expect(entry?.info.isActive).toBe(true);
		});
	});

	describe("agent lifecycle", () => {
		it("sets streaming state on agent_start", () => {
			runtime.store.set(runtime.maps.sessions.mapAtom, {
				type: "set",
				key: "s1",
				value: {
					info: {
						id: "s1",
						status: "idle" as const,
						isActive: true,
						cwd: "",
						createdAt: Date.now(),
						lastActivityAt: Date.now(),
						messageCount: 0,
					},
					streaming: false,
					compacting: false,
					pendingMessages: 0,
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "agent_start",
			};
			applyEvent(runtime, event);

			const entry = runtime.store.get(runtime.maps.sessions.atomFor("s1"));
			expect(entry?.streaming).toBe(true);
			expect(entry?.info.status).toBe("streaming");
		});
	});

	describe("subagent lifecycle", () => {
		it("creates subagent on subagent_start", () => {
			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_start",
				id: "sa1",
				parentId: undefined,
				name: "ResearchAgent",
				status: "running",
			};
			applyEvent(runtime, event);

			const sub = runtime.store.get(runtime.maps.subagents.atomFor("sa1"));
			expect(sub).toBeDefined();
			expect(sub?.id).toBe("sa1");
			expect(sub?.parentId).toBeNull();
			expect(sub?.sessionId).toBe("s1");
			expect(sub?.name).toBe("ResearchAgent");
			expect(sub?.status).toBe("running");
		});

		it("creates child subagent with parentId on subagent_start", () => {
			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_start",
				id: "sa2",
				parentId: "sa1",
				name: "ChildAgent",
				status: "running",
			};
			applyEvent(runtime, event);

			const sub = runtime.store.get(runtime.maps.subagents.atomFor("sa2"));
			expect(sub?.parentId).toBe("sa1");
		});

		it("updates subagent on subagent_end", () => {
			runtime.store.set(runtime.maps.subagents.mapAtom, {
				type: "set",
				key: "sa1",
				value: {
					id: "sa1",
					parentId: null,
					sessionId: "s1",
					name: "ResearchAgent",
					status: "running" as const,
					startedAt: Date.now(),
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_end",
				id: "sa1",
				result: { data: "done" },
				status: "completed",
			};
			applyEvent(runtime, event);

			const sub = runtime.store.get(runtime.maps.subagents.atomFor("sa1"));
			expect(sub?.status).toBe("completed");
			expect(sub?.result).toEqual({ data: "done" });
			expect(sub?.endedAt).toBeDefined();
		});

		it("updates progress on subagent_progress", () => {
			runtime.store.set(runtime.maps.subagents.mapAtom, {
				type: "set",
				key: "sa1",
				value: {
					id: "sa1",
					parentId: null,
					sessionId: "s1",
					name: "ResearchAgent",
					status: "running" as const,
					startedAt: Date.now(),
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_progress",
				id: "sa1",
				message: "Processing...",
				progress: 0.5,
			};
			applyEvent(runtime, event);

			const sub = runtime.store.get(runtime.maps.subagents.atomFor("sa1"));
			expect(sub?.message).toBe("Processing...");
			expect(sub?.progress).toBe(0.5);
		});

		it("sets failed status on subagent_error", () => {
			runtime.store.set(runtime.maps.subagents.mapAtom, {
				type: "set",
				key: "sa1",
				value: {
					id: "sa1",
					parentId: null,
					sessionId: "s1",
					name: "ResearchAgent",
					status: "running" as const,
					startedAt: Date.now(),
				},
			});

			const event: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_error",
				id: "sa1",
				error: "Something went wrong",
			};
			applyEvent(runtime, event);

			const sub = runtime.store.get(runtime.maps.subagents.atomFor("sa1"));
			expect(sub?.status).toBe("failed");
			expect(sub?.error).toBe("Something went wrong");
			expect(sub?.endedAt).toBeDefined();
		});

		it("indexes subagents by session", () => {
			const event1: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_start",
				id: "sa1",
				parentId: undefined,
				name: "Agent1",
				status: "running",
			};
			const event2: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_start",
				id: "sa2",
				parentId: "sa1",
				name: "Agent2",
				status: "running",
			};
			applyEvent(runtime, event1);
			applyEvent(runtime, event2);

			const s1Ids = runtime.store.get(runtime.indexes.subagentsBySession.atomFor("s1"));
			expect(s1Ids).toContain("sa1");
			expect(s1Ids).toContain("sa2");
		});

		it("indexes subagents by parentId in tree", () => {
			const event1: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_start",
				id: "sa1",
				parentId: undefined,
				name: "Root",
				status: "running",
			};
			const event2: ServerEvent = {
				sessionId: "s1",
				timestamp: Date.now(),
				type: "subagent_start",
				id: "sa2",
				parentId: "sa1",
				name: "Child",
				status: "running",
			};
			applyEvent(runtime, event1);
			applyEvent(runtime, event2);

			const rootChildren = runtime.store.get(subagentTreeAtom(runtime, null));
			expect(rootChildren.map((s) => s.id)).toContain("sa1");
			expect(rootChildren.map((s) => s.id)).not.toContain("sa2");

			const sa1Children = runtime.store.get(subagentTreeAtom(runtime, "sa1"));
			expect(sa1Children.map((s) => s.id)).toContain("sa2");
		});
	});
});
