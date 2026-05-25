/**
 * Message block types — normalized representation of message content.
 *
 * Pi's agent-core emits messages with content as arrays of typed blocks:
 *   [{type: "thinking", thinking: "..."}, {type: "text", text: "..."}]
 *
 * The dashboard frontend normalizes these into a unified block model for
 * rendering. Each block is self-contained and renderable.
 */

export type MessageBlock =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; signature?: string; redacted?: boolean }
	| { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
	| { type: "toolResult"; toolCallId: string; content: string; isError: boolean }
	| { type: "image"; data: string; mimeType: string };

/**
 * Convert an agent-core message (which may have content as string or array)
 * into a normalized array of MessageBlocks.
 */
export function normalizeMessageContent(msg: unknown): MessageBlock[] {
	if (!msg || typeof msg !== "object") return [];

	const message = msg as Record<string, unknown>;
	let content = message.content;

	// Handle case where content is a JSON string (serialization artifact)
	if (typeof content === "string") {
		const parsed = tryParseJsonBlocks(content);
		if (parsed) {
			content = parsed;
		} else {
			// Plain text string
			return content.trim() ? [{ type: "text", text: content }] : [];
		}
	}

	// Array of content blocks (assistant messages from providers)
	if (Array.isArray(content)) {
		const blocks: MessageBlock[] = [];
		for (const item of content) {
			if (!item || typeof item !== "object") continue;
			const block = item as Record<string, unknown>;
			const blockType = block.type;

			switch (blockType) {
				case "text": {
					const text = block.text;
					if (typeof text === "string" && text.trim()) {
						blocks.push({ type: "text", text });
					}
					break;
				}
				case "thinking": {
					const thinking = block.thinking;
					if (typeof thinking === "string") {
						blocks.push({
							type: "thinking",
							thinking,
							signature: typeof block.thinkingSignature === "string" ? block.thinkingSignature : undefined,
							redacted: block.redacted === true,
						});
					}
					break;
				}
				case "toolCall": {
					const id = block.id;
					const name = block.name;
					if (typeof id === "string" && typeof name === "string") {
						blocks.push({
							type: "toolCall",
							id,
							name,
							arguments: (block.arguments as Record<string, unknown>) ?? {},
						});
					}
					break;
				}
				case "image": {
					const data = block.data;
					const mimeType = block.mimeType;
					if (typeof data === "string" && typeof mimeType === "string") {
						blocks.push({ type: "image", data, mimeType });
					}
					break;
				}
			}
		}
		return blocks;
	}

	return [];
}

/**
 * Extract plain text from blocks for display purposes (e.g. sidebar preview).
 */
export function blocksToPlainText(blocks: MessageBlock[]): string {
	const parts: string[] = [];
	for (const block of blocks) {
		switch (block.type) {
			case "text":
				parts.push(block.text);
				break;
			case "thinking":
				parts.push(`[Thinking: ${block.thinking.slice(0, 80)}...]`);
				break;
			case "toolCall":
				parts.push(`[Tool: ${block.name}]`);
				break;
			case "toolResult":
				parts.push(`[Result: ${block.content.slice(0, 80)}...]`);
				break;
			case "image":
				parts.push("[Image]");
				break;
		}
	}
	return parts.join(" ");
}

/**
 * Check if a string looks like a JSON-serialized message block or array of blocks.
 * This handles the case where SSE serialization converts arrays to strings.
 */
function tryParseJsonBlocks(value: string): unknown[] | null {
	const trimmed = value.trim();
	if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
	try {
		const parsed = JSON.parse(trimmed);
		if (Array.isArray(parsed)) return parsed;
		if (parsed && typeof parsed === "object") return [parsed];
		return null;
	} catch {
		return null;
	}
}

/**
 * Merge a delta into existing blocks. Used for streaming updates.
 * Returns a new array (immutable update).
 */
export function mergeBlockDelta(
	blocks: MessageBlock[],
	delta:
		| { type: "thinking_delta"; contentIndex: number; delta: string }
		| { type: "text_delta"; contentIndex: number; delta: string }
		| { type: "toolcall_delta"; contentIndex: number; delta: string },
): MessageBlock[] {
	const newBlocks = [...blocks];
	const idx = delta.contentIndex;

	if (delta.type === "text_delta") {
		const existing = newBlocks[idx];
		if (existing && existing.type === "text") {
			newBlocks[idx] = { ...existing, text: existing.text + delta.delta };
		} else {
			// Insert or append text block
			newBlocks[idx] = { type: "text", text: delta.delta };
		}
	} else if (delta.type === "thinking_delta") {
		const existing = newBlocks[idx];
		if (existing && existing.type === "thinking") {
			newBlocks[idx] = { ...existing, thinking: existing.thinking + delta.delta };
		} else {
			newBlocks[idx] = { type: "thinking", thinking: delta.delta };
		}
	} else if (delta.type === "toolcall_delta") {
		const existing = newBlocks[idx];
		if (existing && existing.type === "toolCall") {
			// Accumulate JSON arguments incrementally
			const currentArgs = JSON.stringify(existing.arguments);
			const updatedArgs = tryParseJsonObject(currentArgs + delta.delta) ?? existing.arguments;
			newBlocks[idx] = { ...existing, arguments: updatedArgs };
		} else {
			newBlocks[idx] = { type: "toolCall", id: "", name: "", arguments: tryParseJsonObject(delta.delta) ?? {} };
		}
	}

	return newBlocks;
}

/**
 * Try to parse a JSON object from a string. Returns null if invalid.
 */
function tryParseJsonObject(value: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(value);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
		return null;
	} catch {
		return null;
	}
}

/**
 * Finalize a thinking block when thinking_end arrives.
 */
export function finalizeThinkingBlock(
	blocks: MessageBlock[],
	contentIndex: number,
	content: string,
	signature?: string,
): MessageBlock[] {
	const newBlocks = [...blocks];
	const existing = newBlocks[contentIndex];
	if (existing && existing.type === "thinking") {
		newBlocks[contentIndex] = { ...existing, thinking: content || existing.thinking, signature };
	} else {
		newBlocks[contentIndex] = { type: "thinking", thinking: content, signature };
	}
	return newBlocks;
}
