import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeHydratedMessages, useSessionMessagesStore } from "../src/store/session-messages.ts";
import type { ChatMessage } from "../src/types.ts";

const threadId = "main:session-1";

describe("session messages store", () => {
	afterEach(() => {
		useSessionMessagesStore.getState().clearMessages(threadId);
		vi.restoreAllMocks();
	});

	it("preserves optimistic user messages when REST hydration is stale", () => {
		const persisted = message("msg-1", "assistant", "Ready", 10);
		const optimistic = { ...message("optimistic-main:session-1-20", "user", "Continue", 20), optimistic: true };

		expect(mergeHydratedMessages([persisted, optimistic], [persisted])).toEqual([persisted, optimistic]);
	});

	it("reconciles optimistic user messages when the real message arrives", () => {
		const optimistic = { ...message("optimistic-main:session-1-20", "user", "Continue", 20), optimistic: true };
		const persisted = message("msg-2", "user", "Continue", 25);

		expect(mergeHydratedMessages([optimistic], [persisted])).toEqual([persisted]);
	});

	it("can remove failed optimistic messages", () => {
		const optimistic = { ...message("optimistic-main:session-1-20", "user", "Continue", 20), optimistic: true };

		useSessionMessagesStore.getState().addMessage(threadId, optimistic);
		useSessionMessagesStore.getState().removeMessage(threadId, optimistic.id);

		expect(useSessionMessagesStore.getState().getMessages(threadId)).toEqual([]);
	});
});

function message(
	id: string,
	role: ChatMessage["role"],
	text: string,
	timestamp: number,
): ChatMessage {
	return {
		id,
		instanceId: threadId,
		role,
		blocks: [{ type: "text", text }],
		timestamp,
	};
}
