import type { SessionRuntime, ChatMessage } from "./runtime.js";
import { generateMessageId } from "./utils.js";

export interface OptimisticManager {
	addPendingMessage(sessionId: string, content: string): string;
	confirmMessage(tempId: string): void;
	rollbackMessage(tempId: string): void;
	/**
	 * Find and remove an optimistic message that matches the given text.
	 * Returns the tempId if found, null otherwise.
	 */
	resolveByText(sessionId: string, text: string): string | null;
}

export function createOptimisticManager(runtime: SessionRuntime): OptimisticManager {
	const { store, maps } = runtime;
	const pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
	const OPTIMISTIC_TIMEOUT_MS = 30000; // 30s auto-rollback

	return {
		addPendingMessage(sessionId: string, content: string): string {
			const tempId = generateMessageId();
			const msg: ChatMessage = {
				id: tempId,
				sessionId,
				role: "user",
				blocks: [{ type: "text", text: content }],
				timestamp: Date.now(),
				streaming: false,
				optimistic: true,
			};
			store.set(maps.messages.mapAtom, { type: "set", key: tempId, value: msg });

			// Auto-rollback after timeout
			const timeout = setTimeout(() => {
				pendingTimeouts.delete(tempId);
				store.set(maps.messages.mapAtom, { type: "delete", key: tempId });
			}, OPTIMISTIC_TIMEOUT_MS);
			pendingTimeouts.set(tempId, timeout);

			return tempId;
		},

		confirmMessage(tempId: string): void {
			const timeout = pendingTimeouts.get(tempId);
			if (timeout) {
				clearTimeout(timeout);
				pendingTimeouts.delete(tempId);
			}
			const msg = store.get(maps.messages.atomFor(tempId));
			if (msg) {
				store.set(maps.messages.mapAtom, {
					type: "set",
					key: tempId,
					value: { ...msg, optimistic: false },
				});
			}
		},

		rollbackMessage(tempId: string): void {
			const timeout = pendingTimeouts.get(tempId);
			if (timeout) {
				clearTimeout(timeout);
				pendingTimeouts.delete(tempId);
			}
			store.set(maps.messages.mapAtom, { type: "delete", key: tempId });
		},

		resolveByText(sessionId: string, text: string): string | null {
			const msgIds = store.get(runtime.indexes.messagesBySession.atomFor(sessionId));
			for (const id of msgIds) {
				const msg = store.get(maps.messages.atomFor(id));
				if (msg?.optimistic && msg.role === "user") {
					const msgText = msg.blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
					if (msgText.trim() === text.trim()) {
						// Found matching optimistic message — clean up its timeout
						const timeout = pendingTimeouts.get(id);
						if (timeout) {
							clearTimeout(timeout);
							pendingTimeouts.delete(id);
						}
						store.set(maps.messages.mapAtom, { type: "delete", key: id });
						return id;
					}
				}
			}
			return null;
		},
	};
}
