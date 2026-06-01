import { create } from "zustand";
import type { ChatMessage, MessageBlock } from "../types.ts";
import { dashboardDebugLedger } from "../dev/debug-ledger.ts";
import { findMessageIndex, findPartialMessageIndex, mergeHydratedMessages, upsertMessage } from "../utils/message-merge.ts";

interface SessionMessagesState {
	messagesByInstance: Map<string, ChatMessage[]>;
	streamingByInstance: Map<string, boolean>;

	setMessages: (instanceId: string, messages: ChatMessage[]) => void;
	addMessage: (instanceId: string, message: ChatMessage) => void;
	startMessage: (instanceId: string, message: ChatMessage) => void;
	updatePartialMessage: (instanceId: string, message: ChatMessage) => void;
	finishMessage: (instanceId: string, message: ChatMessage) => void;
	updateMessageBlocks: (instanceId: string, messageId: string, blocks: MessageBlock[]) => void;
	setStreaming: (instanceId: string, streaming: boolean) => void;
	getMessages: (instanceId: string) => ChatMessage[];
	clearMessages: (instanceId: string) => void;
}

export const useSessionMessagesStore = create<SessionMessagesState>((set, get) => ({
	messagesByInstance: new Map(),
	streamingByInstance: new Map(),

	setMessages: (instanceId, messages) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const merged = mergeHydratedMessages(next.get(instanceId) ?? [], messages);
			next.set(instanceId, merged);
			dashboardDebugLedger.recordMessages(instanceId, merged, "hydrate");
			return { messagesByInstance: next };
		}),

	addMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			const duplicate = existing.some(
				(item) =>
					item.role === message.role &&
					item.timestamp === message.timestamp &&
					JSON.stringify(item.blocks) === JSON.stringify(message.blocks),
			);
			if (duplicate) return state;
			const merged = upsertMessage(existing, message);
			next.set(instanceId, merged);
			dashboardDebugLedger.recordMessages(instanceId, merged, "add");
			return { messagesByInstance: next };
		}),

	startMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			const partialMessage = { ...message, partial: true, streaming: message.role === "assistant" };
			const targetIndex = findPartialMessageIndex(existing, partialMessage);
			if (targetIndex >= 0) {
				next.set(instanceId, replaceAt(existing, targetIndex, partialMessage));
			} else {
				next.set(instanceId, [...existing, partialMessage]);
			}
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "start");
			return { messagesByInstance: next };
		}),

	updatePartialMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			let targetIndex = findPartialMessageIndex(existing, message);
			if (targetIndex === -1) {
				targetIndex = findMessageIndex(existing, message);
			}
			const partialMessage = { ...message, partial: true, streaming: message.role === "assistant" };
			if (targetIndex < 0) {
				next.set(instanceId, [...existing, partialMessage]);
			} else {
				next.set(instanceId, replaceAt(existing, targetIndex, partialMessage));
			}
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "update-partial");
			return { messagesByInstance: next };
		}),

	finishMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			let targetIndex = findPartialMessageIndex(existing, message);
			if (targetIndex === -1) {
				targetIndex = findMessageIndex(existing, message);
			}
			const finalMessage = { ...message, partial: false, streaming: false };
			if (targetIndex < 0) {
				next.set(instanceId, [...existing, finalMessage]);
			} else {
				next.set(instanceId, replaceAt(existing, targetIndex, finalMessage));
			}
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "finish");
			return { messagesByInstance: next };
		}),

	updateMessageBlocks: (instanceId, messageId, blocks) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			next.set(
				instanceId,
				existing.map((m) => (m.id === messageId ? { ...m, blocks } : m)),
			);
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "update-blocks");
			return { messagesByInstance: next };
		}),

	setStreaming: (instanceId, streaming) =>
		set((state) => {
			const next = new Map(state.streamingByInstance);
			next.set(instanceId, streaming);
			dashboardDebugLedger.log("debug", "messages", "streaming", { streaming }, instanceId);
			return { streamingByInstance: next };
		}),

	getMessages: (instanceId) => {
		return get().messagesByInstance.get(instanceId) ?? [];
	},

	clearMessages: (instanceId) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			next.delete(instanceId);
			const streamingNext = new Map(state.streamingByInstance);
			streamingNext.delete(instanceId);
			dashboardDebugLedger.log("debug", "messages", "clear", undefined, instanceId);
			return { messagesByInstance: next, streamingByInstance: streamingNext };
		}),
}));

function replaceAt(messages: ChatMessage[], index: number, message: ChatMessage): ChatMessage[] {
	return messages.map((item, itemIndex) => (itemIndex === index ? message : item));
}
