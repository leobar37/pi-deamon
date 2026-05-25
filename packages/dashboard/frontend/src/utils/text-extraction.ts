import type { MessageBlock } from "../store/index.js";

/**
 * Extract plain text from an array of message blocks.
 * Only includes text blocks; other block types are ignored.
 */
export function extractTextFromBlocks(blocks: MessageBlock[]): string {
	return blocks
		.filter((b): b is Extract<MessageBlock, { type: "text" }> => b.type === "text")
		.map((b) => b.text)
		.join("")
		.trim();
}
