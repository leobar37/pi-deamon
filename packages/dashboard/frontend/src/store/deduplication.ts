import type { SessionRuntime } from "./runtime.js";
import type { MessageBlock } from "./index.js";
import { extractTextFromBlocks } from "../utils/text-extraction.js";

/**
 * Find an optimistic pending user message that matches the given content.
 * Used to resolve the optimistic placeholder when the server echo arrives.
 * Returns the message ID if found, undefined otherwise.
 */
export function findOptimisticUserMessage(
	runtime: SessionRuntime,
	sessionId: string,
	blocks: MessageBlock[],
): string | undefined {
	const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor(sessionId));
	const newText = extractTextFromBlocks(blocks);

	for (const id of msgIds) {
		const msg = runtime.store.get(runtime.maps.messages.atomFor(id));
		if (msg?.role === "user" && msg.optimistic) {
			const existingText = extractTextFromBlocks(msg.blocks);
			if (existingText === newText) {
				return id;
			}
		}
	}
	return undefined;
}
