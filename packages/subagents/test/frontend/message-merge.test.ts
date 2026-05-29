import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../frontend/src/types.js";
import { mergeHydratedMessages, upsertMessage } from "../../frontend/src/utils/message-merge.js";

function assistantMessage(id: string, text: string, options: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id,
		instanceId: "thread-1",
		role: "assistant",
		blocks: [{ type: "text", text }],
		timestamp: 1,
		...options,
	};
}

describe("message merge", () => {
	it("keeps a live partial message when REST hydration returns the same message", () => {
		const partial = assistantMessage("m1", "hello", { partial: true, streaming: true });
		const hydrated = assistantMessage("m1", "hello world");

		const result = mergeHydratedMessages([partial], [hydrated]);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("m1");
		expect(result[0].blocks).toEqual([{ type: "text", text: "hello world" }]);
		expect(result[0].partial).toBe(false);
		expect(result[0].streaming).toBe(false);
	});

	it("updates the same message on final SSE event instead of duplicating", () => {
		const hydrated = assistantMessage("m1", "hello world");
		const final = assistantMessage("m1", "hello world", { partial: false, streaming: false });

		const result = upsertMessage([hydrated], final);

		expect(result).toHaveLength(1);
		expect(result[0].partial).toBe(false);
	});

	it("dedupes messages without an exact id by deterministic content signature", () => {
		const hydrated = assistantMessage("generated-1", "same text");
		const final = assistantMessage("generated-2", "same text");

		const result = upsertMessage([hydrated], final);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("generated-2");
	});
});
