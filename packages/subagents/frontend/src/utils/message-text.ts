import type { ChatMessage, MessageBlock } from "../types.ts";

export function blockToText(block: MessageBlock): string {
	switch (block.type) {
		case "text":
			return block.text;
		case "thinking":
			return block.thinking;
		case "toolCall":
			return `${block.name}\n${JSON.stringify(block.arguments, null, 2)}`;
		case "toolResult":
			return block.content;
		case "image":
			return `[image:${block.mimeType}]`;
	}
}

export function messageToText(message: ChatMessage): string {
	return message.blocks.map(blockToText).filter(Boolean).join("\n\n");
}
