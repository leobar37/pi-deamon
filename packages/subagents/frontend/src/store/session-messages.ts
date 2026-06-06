import { create } from "zustand";
import type { ChatMessage, MessageBlock } from "../types.ts";
import { dashboardDebugLedger } from "../dev/debug-ledger.ts";

interface SessionMessagesState {
	messagesByInstance: Map<string, ChatMessage[]>;
	streamingByInstance: Map<string, boolean>;

	/** Hydrate messages for an instance while preserving pending optimistic sends */
	setMessages: (instanceId: string, messages: ChatMessage[]) => void;
	/** Append a new message or update by message.id */
	addMessage: (instanceId: string, message: ChatMessage) => void;
	/** Remove a message by message.id */
	removeMessage: (instanceId: string, messageId: string) => void;
	/** Mark a message as partial+streaming (start of SSE stream) */
	startMessage: (instanceId: string, message: ChatMessage) => void;
	/** Update a partial streaming message in-place */
	updatePartialMessage: (instanceId: string, message: ChatMessage) => void;
	/** Mark a partial message as complete */
	finishMessage: (instanceId: string, message: ChatMessage) => void;
	/** Update blocks on an existing message by messageId */
	updateMessageBlocks: (instanceId: string, messageId: string, blocks: MessageBlock[]) => void;
	/** Set streaming state for an instance */
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
			const existing = next.get(instanceId) ?? [];
			const merged = mergeHydratedMessages(existing, messages);
			next.set(instanceId, merged);
			dashboardDebugLedger.recordMessages(instanceId, merged, "hydrate");
			return { messagesByInstance: next };
		}),

	addMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			next.set(instanceId, upsertMessage(existing, message));
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "add");
			return { messagesByInstance: next };
		}),

	removeMessage: (instanceId, messageId) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			next.set(
				instanceId,
				existing.filter((message) => message.id !== messageId),
			);
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "remove");
			return { messagesByInstance: next };
		}),

	startMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			const partialMessage = { ...message, partial: true, streaming: message.role === "assistant" };
			next.set(instanceId, upsertMessage(existing, partialMessage));
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "start");
			return { messagesByInstance: next };
		}),

	updatePartialMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			const partialMessage = { ...message, partial: true, streaming: message.role === "assistant" };
			next.set(instanceId, upsertMessage(existing, partialMessage));
			dashboardDebugLedger.recordMessages(instanceId, next.get(instanceId) ?? [], "update-partial");
			return { messagesByInstance: next };
		}),

	finishMessage: (instanceId, message) =>
		set((state) => {
			const next = new Map(state.messagesByInstance);
			const existing = next.get(instanceId) ?? [];
			const finalMessage = { ...message, partial: false, streaming: false };
			next.set(instanceId, upsertMessage(existing, finalMessage));
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

export function mergeHydratedMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
	const preserved = existing.filter(
		(message) => isOptimisticUserMessage(message) && !incoming.some((candidate) => messagesMatch(candidate, message)),
	);
	return [...incoming, ...preserved].sort(compareMessages);
}

function upsertMessage(existing: ChatMessage[], message: ChatMessage): ChatMessage[] {
	const byId = existing.findIndex((candidate) => candidate.id === message.id);
	if (byId >= 0) {
		return existing.map((candidate, index) => (index === byId ? message : candidate)).sort(compareMessages);
	}

	if (!isOptimisticUserMessage(message)) {
		const optimisticMatch = existing.findIndex(
			(candidate) => isOptimisticUserMessage(candidate) && messagesMatch(message, candidate),
		);
		if (optimisticMatch >= 0) {
			return existing.map((candidate, index) => (index === optimisticMatch ? message : candidate)).sort(compareMessages);
		}
	}

	return [...existing, message].sort(compareMessages);
}

function isOptimisticUserMessage(message: ChatMessage): boolean {
	return message.role === "user" && (message.optimistic === true || message.id.startsWith("optimistic-"));
}

function messagesMatch(realMessage: ChatMessage, optimisticMessage: ChatMessage): boolean {
	if (realMessage.id === optimisticMessage.id) return true;
	if (realMessage.instanceId !== optimisticMessage.instanceId) return false;
	if (realMessage.role !== optimisticMessage.role) return false;
	if (normalizedText(realMessage) !== normalizedText(optimisticMessage)) return false;
	return Math.abs(realMessage.timestamp - optimisticMessage.timestamp) <= 60000;
}

function normalizedText(message: ChatMessage): string {
	return message.blocks
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n")
		.trim()
		.replace(/\s+/g, " ");
}

function compareMessages(left: ChatMessage, right: ChatMessage): number {
	if (left.timestamp !== right.timestamp) return left.timestamp - right.timestamp;
	return left.id.localeCompare(right.id);
}
