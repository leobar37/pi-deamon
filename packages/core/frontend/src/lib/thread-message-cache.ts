import type { QueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import type { ChatMessage, MessageBlock } from "../types.ts";

export function setThreadMessagesCache(queryClient: QueryClient, threadId: string, messages: ChatMessage[]): void {
	queryClient.setQueryData<Record<string, unknown>[]>(threadMessagesQueryKey(threadId), messages.map(chatMessageToRecord));
}

export function updateThreadMessagesCache(
	queryClient: QueryClient,
	threadId: string,
	updater: (messages: ChatMessage[] | undefined) => ChatMessage[],
): void {
	queryClient.setQueryData<Record<string, unknown>[]>(threadMessagesQueryKey(threadId), (current) =>
		updater(recordsToChatMessages(threadId, current)).map(chatMessageToRecord),
	);
}

export function invalidateThreadMessages(queryClient: QueryClient, threadId: string): void {
	void queryClient.invalidateQueries(threadMessagesQueryOptions(threadId));
}

export function threadMessagesQueryKey(threadId: string) {
	return threadMessagesQueryOptions(threadId).queryKey;
}

function threadMessagesQueryOptions(threadId: string) {
	return api.threads.messages.queryOptions({
		input: { threadId },
	});
}

function recordsToChatMessages(threadId: string, records: Record<string, unknown>[] | undefined): ChatMessage[] {
	return (records ?? []).map((record, index) => {
		const role = readRole(record.role);
		const timestamp = typeof record.timestamp === "number" ? record.timestamp : Date.now();
		const id = typeof record.id === "string" ? record.id : `${threadId}-${role}-${timestamp}-${index}`;
		return {
			id,
			instanceId: threadId,
			role,
			blocks: recordToBlocks(record),
			timestamp,
			optimistic: record.optimistic === true,
		};
	});
}

function chatMessageToRecord(message: ChatMessage): Record<string, unknown> {
	const toolResult = message.blocks.find((block) => block.type === "toolResult");
	if (toolResult) {
		return {
			id: message.id,
			role: "toolResult",
			toolCallId: toolResult.toolCallId,
			toolName: toolResult.toolName ?? "",
			content: [{ type: "text", text: toolResult.content }],
			isError: toolResult.isError,
			timestamp: message.timestamp,
		};
	}

	const content = message.blocks.map(blockToBackendContent).filter((block) => block !== null);
	return {
		id: message.id,
		role: message.role,
		content,
		timestamp: message.timestamp,
		optimistic: message.optimistic,
	};
}

function readRole(role: unknown): ChatMessage["role"] {
	if (role === "user" || role === "assistant" || role === "tool" || role === "system") return role;
	if (role === "toolResult") return "tool";
	return "system";
}

function recordToBlocks(record: Record<string, unknown>): MessageBlock[] {
	const content = record.content;
	if (typeof content === "string") return [{ type: "text", text: content }];
	if (!Array.isArray(content)) return [];
	const blocks: MessageBlock[] = [];
	for (const item of content) {
		if (typeof item !== "object" || item === null) continue;
		const block = item as Record<string, unknown>;
		if (block.type === "text") {
			blocks.push({ type: "text", text: String(block.text ?? "") });
			continue;
		}
		if (block.type === "thinking") {
			blocks.push({
				type: "thinking",
				thinking: String(block.thinking ?? ""),
				signature: typeof block.thinkingSignature === "string" ? block.thinkingSignature : undefined,
				redacted: typeof block.redacted === "boolean" ? block.redacted : undefined,
			});
			continue;
		}
		if (block.type === "toolCall") {
			blocks.push({
				type: "toolCall",
				id: String(block.id ?? ""),
				name: String(block.name ?? ""),
				arguments: readArguments(block.arguments),
			});
			continue;
		}
		if (block.type === "image") {
			blocks.push({
				type: "image",
				data: String(block.data ?? ""),
				mimeType: String(block.mimeType ?? "image/png"),
			});
		}
	}
	return blocks;
}

function blockToBackendContent(block: MessageBlock): Record<string, unknown> | null {
	if (block.type === "text") return { type: "text", text: block.text };
	if (block.type === "thinking") {
		return {
			type: "thinking",
			thinking: block.thinking,
			thinkingSignature: block.signature,
			redacted: block.redacted,
		};
	}
	if (block.type === "toolCall") return { type: "toolCall", id: block.id, name: block.name, arguments: block.arguments };
	if (block.type === "image") return { type: "image", data: block.data, mimeType: block.mimeType };
	if (block.type === "toolResult") return { type: "text", text: block.content };
	return null;
}

function readArguments(value: unknown): Record<string, unknown> {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
	return {};
}
