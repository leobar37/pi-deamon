import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime, ChatMessage, StreamingState } from "../runtime.js";

export type EventHandler = (runtime: SessionRuntime, event: ServerEvent) => void;

export function defaultStreamingState(): StreamingState {
	return {
		isStreaming: false,
		isCompacting: false,
		isRetrying: false,
		retryInfo: null,
		pendingSteering: [],
		pendingFollowUp: [],
	};
}

/** Find the most recent partial message for a session. */
export function findPartialMessageId(runtime: SessionRuntime, sessionId: string): string | undefined {
	const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor(sessionId));
	for (let i = msgIds.length - 1; i >= 0; i--) {
		const m = runtime.store.get(runtime.maps.messages.atomFor(msgIds[i]));
		if (m?.partial) return msgIds[i];
	}
	return undefined;
}

/** Update a message in the store immutably. */
export function updateMessage(runtime: SessionRuntime, id: string, patch: Partial<ChatMessage>): void {
	const msg = runtime.store.get(runtime.maps.messages.atomFor(id));
	if (!msg) return;
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: id,
		value: { ...msg, ...patch },
	});
}
