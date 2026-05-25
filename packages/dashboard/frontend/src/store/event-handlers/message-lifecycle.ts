import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime, ChatMessage } from "../runtime.js";
import { generateMessageId } from "../utils.js";
import { normalizeMessageContent } from "../message-blocks.js";
import { findOptimisticUserMessage } from "../deduplication.js";
import { findPartialMessageId, updateMessage } from "./types.js";

export function handleMessageStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "message_start") return;
	const msg = event.message as Record<string, unknown> | undefined;
	const role = (msg?.role as string) ?? "assistant";
	const blocks = normalizeMessageContent(msg);

	// For user messages, check if there's an optimistic pending message
	// with the same content. If so, replace it with the server-echoed version
	// so the message lifecycle is driven by the backend.
	if (role === "user") {
		const optimisticId = findOptimisticUserMessage(runtime, event.sessionId, blocks);
		if (optimisticId) {
			// Replace the optimistic message with the canonical server version.
			// This preserves the user's visual while switching to backend-driven lifecycle.
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "delete",
				key: optimisticId,
			});
		}
		// After removing the optimistic message, fall through to create the
		// canonical message from the server event.
	}

	const chatMsg: ChatMessage = {
		id: generateMessageId(),
		sessionId: event.sessionId,
		role: role as ChatMessage["role"],
		blocks,
		timestamp: event.timestamp,
		streaming: role === "assistant",
		partial: true,
	};
	runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: chatMsg.id, value: chatMsg });
}

export function handleMessageUpdate(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "message_update") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = event.message as Record<string, unknown> | undefined;
	const blocks = normalizeMessageContent(msg);
	updateMessage(runtime, targetMsgId, { blocks, streaming: true });
}

export function handleMessageEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "message_end") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = event.message as Record<string, unknown> | undefined;
	const blocks = normalizeMessageContent(msg);
	updateMessage(runtime, targetMsgId, { blocks, streaming: false, partial: false });

	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: {
				...entry,
				info: {
					...entry.info,
					messageCount: entry.info.messageCount + 1,
					lastActivityAt: event.timestamp,
				},
			},
		});
	}
}
