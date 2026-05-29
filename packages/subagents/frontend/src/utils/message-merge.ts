import type { ChatMessage } from "../types.ts";

export function mergeHydratedMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
	let result = [...existing];
	for (const message of incoming) {
		result = upsertMessage(result, { ...message, partial: message.partial ?? false, streaming: message.streaming ?? false });
	}
	return result.sort((a, b) => a.timestamp - b.timestamp);
}

export function upsertMessage(existing: ChatMessage[], message: ChatMessage): ChatMessage[] {
	const index = findMessageIndex(existing, message);
	if (index >= 0) {
		return existing.map((item, itemIndex) => (itemIndex === index ? mergeMessage(item, message) : item));
	}
	return [...existing, message];
}

export function findMessageIndex(messages: ChatMessage[], message: ChatMessage): number {
	const byId = messages.findIndex((item) => item.id === message.id);
	if (byId >= 0) return byId;
	const key = messageKey(message);
	return messages.findIndex((item) => messageKey(item) === key);
}

export function findPartialMessageIndex(messages: ChatMessage[], message: ChatMessage): number | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const item = messages[i];
		if (!item.partial) continue;
		if (item.role === message.role) return i;
	}
	return undefined;
}

export function messageKey(message: ChatMessage): string {
	return [message.instanceId, message.role, message.timestamp, blocksSignature(message)].join(":");
}

function mergeMessage(existing: ChatMessage, incoming: ChatMessage): ChatMessage {
	return {
		...existing,
		...incoming,
		partial: incoming.partial ?? existing.partial,
		streaming: incoming.streaming ?? existing.streaming,
	};
}

function blocksSignature(message: ChatMessage): string {
	return message.blocks
		.map((block) => {
			switch (block.type) {
				case "text":
					return `text:${block.text}`;
				case "thinking":
					return `thinking:${block.thinking}`;
				case "toolCall":
					return `tool:${block.id}:${block.name}`;
				case "toolResult":
					return `result:${block.toolCallId}:${block.content}`;
				case "image":
					return `image:${block.mimeType}:${block.data.length}`;
			}
		})
		.join("|");
}
