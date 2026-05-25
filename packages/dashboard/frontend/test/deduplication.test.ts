import { describe, expect, it, beforeEach } from "vitest";
import { createSessionRuntime } from "../src/store/runtime.js";
import { findDuplicateUserMessage, isRecentlyConfirmed } from "../src/store/deduplication.js";
import type { SessionRuntime } from "../src/store/runtime.js";

describe("deduplication", () => {
	let runtime: SessionRuntime;

	beforeEach(() => {
		runtime = createSessionRuntime();
	});

	describe("findDuplicateUserMessage", () => {
		it("returns undefined when no messages exist", () => {
			const result = findDuplicateUserMessage(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBeUndefined();
		});

		it("finds a duplicate non-optimistic user message", () => {
			const msg = {
				id: "m1",
				sessionId: "s1",
				role: "user" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now(),
				streaming: false,
				optimistic: false,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = findDuplicateUserMessage(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBe("m1");
		});

		it("ignores optimistic messages", () => {
			const msg = {
				id: "m1",
				sessionId: "s1",
				role: "user" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now(),
				streaming: false,
				optimistic: true,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = findDuplicateUserMessage(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBeUndefined();
		});

		it("ignores messages from other sessions", () => {
			const msg = {
				id: "m1",
				sessionId: "s2",
				role: "user" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now(),
				streaming: false,
				optimistic: false,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = findDuplicateUserMessage(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBeUndefined();
		});

		it("ignores assistant messages", () => {
			const msg = {
				id: "m1",
				sessionId: "s1",
				role: "assistant" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now(),
				streaming: false,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = findDuplicateUserMessage(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBeUndefined();
		});
	});

	describe("isRecentlyConfirmed", () => {
		it("returns undefined when no confirmed messages exist", () => {
			const result = isRecentlyConfirmed(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBeUndefined();
		});

		it("finds a recently confirmed message within the window", () => {
			const msg = {
				id: "m1",
				sessionId: "s1",
				role: "user" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now(),
				streaming: false,
				optimistic: false,
				partial: false,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = isRecentlyConfirmed(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBe("m1");
		});

		it("ignores confirmed messages outside the window", () => {
			const msg = {
				id: "m1",
				sessionId: "s1",
				role: "user" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now() - 10000, // 10s ago
				streaming: false,
				optimistic: false,
				partial: false,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = isRecentlyConfirmed(runtime, "s1", [{ type: "text", text: "hello" }], 5000);
			expect(result).toBeUndefined();
		});

		it("ignores partial messages", () => {
			const msg = {
				id: "m1",
				sessionId: "s1",
				role: "user" as const,
				blocks: [{ type: "text" as const, text: "hello" }],
				timestamp: Date.now(),
				streaming: false,
				optimistic: false,
				partial: true,
			};
			runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: "m1", value: msg });

			const result = isRecentlyConfirmed(runtime, "s1", [{ type: "text", text: "hello" }]);
			expect(result).toBeUndefined();
		});
	});
});
