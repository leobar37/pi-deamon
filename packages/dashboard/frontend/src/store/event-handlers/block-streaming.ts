import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime } from "../runtime.js";
import { mergeBlockDelta, finalizeThinkingBlock } from "../message-blocks.js";
import { findPartialMessageId } from "./types.js";

export function handleThinkingStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "thinking_start") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const blocks = [...msg.blocks];
	const idx = event.contentIndex;
	if (!blocks[idx] || blocks[idx].type !== "thinking") {
		blocks[idx] = { type: "thinking", thinking: "" };
	}
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks },
	});
}

export function handleThinkingDelta(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "thinking_delta") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const newBlocks = mergeBlockDelta(msg.blocks, {
		type: "thinking_delta",
		contentIndex: event.contentIndex,
		delta: event.delta,
	});
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks: newBlocks },
	});
}

export function handleThinkingEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "thinking_end") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const newBlocks = finalizeThinkingBlock(msg.blocks, event.contentIndex, event.content);
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks: newBlocks },
	});
}

export function handleTextDelta(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "text_delta") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const newBlocks = mergeBlockDelta(msg.blocks, {
		type: "text_delta",
		contentIndex: event.contentIndex,
		delta: event.delta,
	});
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks: newBlocks },
	});
}

// ---------------------------------------------------------------------------
// Tool call block streaming (toolcall_start/delta/end)
// ---------------------------------------------------------------------------

export function handleToolcallStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "toolcall_start") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const blocks = [...msg.blocks];
	const idx = event.contentIndex;
	if (!blocks[idx] || blocks[idx].type !== "toolCall") {
		blocks[idx] = { type: "toolCall", id: "", name: "", arguments: {} };
	}
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks },
	});
}

export function handleToolcallDelta(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "toolcall_delta") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const newBlocks = mergeBlockDelta(msg.blocks, {
		type: "toolcall_delta",
		contentIndex: event.contentIndex,
		delta: event.delta,
	});
	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks: newBlocks },
	});
}

export function handleToolcallEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "toolcall_end") return;
	const targetMsgId = findPartialMessageId(runtime, event.sessionId);
	if (!targetMsgId) return;

	const msg = runtime.store.get(runtime.maps.messages.atomFor(targetMsgId));
	if (!msg) return;

	const toolCall = event.toolCall as Record<string, unknown> | null;
	const newBlocks = [...msg.blocks];
	const idx = event.contentIndex;
	const existing = newBlocks[idx];

	if (toolCall && typeof toolCall.id === "string" && typeof toolCall.name === "string") {
		newBlocks[idx] = {
			type: "toolCall",
			id: toolCall.id,
			name: toolCall.name,
			arguments: (toolCall.arguments as Record<string, unknown>) ?? {},
		};
	} else if (existing && existing.type === "toolCall") {
		// Keep existing partial state
		newBlocks[idx] = { ...existing };
	} else {
		newBlocks[idx] = { type: "toolCall", id: "", name: "", arguments: {} };
	}

	runtime.store.set(runtime.maps.messages.mapAtom, {
		type: "set",
		key: targetMsgId,
		value: { ...msg, blocks: newBlocks },
	});
}
