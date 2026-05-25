import { describe, expect, it, beforeEach } from "vitest";
import { createSessionRuntime } from "../src/store/runtime.js";
import { applyEvent } from "../src/store/event-handlers/index.js";
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
});
