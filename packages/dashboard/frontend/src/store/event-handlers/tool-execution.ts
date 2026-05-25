import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime, ChatMessage } from "../runtime.js";
import { generateMessageId } from "../utils.js";

export function handleToolExecutionStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "tool_execution_start") return;
	const chatMsg: ChatMessage = {
		id: generateMessageId(),
		sessionId: event.sessionId,
		role: "tool",
		blocks: [],
		timestamp: event.timestamp,
		streaming: true,
		toolCallId: event.toolCallId,
		toolName: event.toolName,
		toolArgs: event.args,
		partial: true,
	};
	runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: chatMsg.id, value: chatMsg });
}

export function handleToolExecutionUpdate(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "tool_execution_update") return;
	const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor(event.sessionId));
	for (let i = msgIds.length - 1; i >= 0; i--) {
		const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[i]));
		if (msg && msg.toolCallId === event.toolCallId && msg.partial) {
			const partialText =
				typeof event.partialResult === "string"
					? event.partialResult
					: JSON.stringify(event.partialResult, null, 2);
			const blocks: ChatMessage["blocks"] = [
				{ type: "toolResult", toolCallId: event.toolCallId, content: partialText, isError: false },
			];
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgIds[i],
				value: {
					...msg,
					blocks,
					streaming: true,
				},
			});
			break;
		}
	}
}

export function handleToolExecutionEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "tool_execution_end") return;
	const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor(event.sessionId));
	for (let i = msgIds.length - 1; i >= 0; i--) {
		const msg = runtime.store.get(runtime.maps.messages.atomFor(msgIds[i]));
		if (msg && msg.toolCallId === event.toolCallId && msg.partial) {
			const resultText =
				typeof event.result === "string"
					? event.result
					: JSON.stringify(event.result, null, 2);
			const blocks: ChatMessage["blocks"] = [
				{ type: "toolResult", toolCallId: event.toolCallId, content: resultText, isError: event.isError },
			];
			runtime.store.set(runtime.maps.messages.mapAtom, {
				type: "set",
				key: msgIds[i],
				value: {
					...msg,
					blocks,
					streaming: false,
					partial: false,
					toolResult: event.result,
					toolIsError: event.isError,
				},
			});
			break;
		}
	}
}
