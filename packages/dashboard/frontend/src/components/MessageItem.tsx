/**
 * MessageItem — renders a single chat message.
 * Supports user, assistant, tool, and custom message types.
 * Uses the block-based rendering system for assistant messages.
 */

import type { ChatMessage } from "../store/index.js";
import { BlockRenderer } from "./blocks/BlockRenderer.js";

function formatTimestamp(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function UserMessage({ message }: { message: ChatMessage }) {
	const text = message.blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
	return (
		<div className="flex justify-end py-1">
			<div className="max-w-[85%] px-5 py-3 bg-bg-surface border border-border-subtle rounded-2xl rounded-tr-sm">
				<div className="text-sm text-text-primary whitespace-pre-wrap leading-normal">{text}</div>
				<div className="flex items-center justify-end gap-2 mt-1.5">
					{message.optimistic && (
						<span className="text-[10px] text-text-muted">Sending...</span>
					)}
					<span className="text-[10px] text-text-muted">{formatTimestamp(message.timestamp)}</span>
				</div>
			</div>
		</div>
	);
}

function AssistantMessage({ message }: { message: ChatMessage }) {
	const hasContent = message.blocks.length > 0;

	return (
		<div className="flex justify-start gap-3 py-1">
			{/* Avatar */}
			<div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center mt-0.5">
				<span className="text-xs font-semibold text-accent">P</span>
			</div>
			<div className="max-w-[85%] min-w-0">
				{hasContent ? (
					<div className="text-sm text-text-primary leading-normal">
						{message.blocks.map((block, i) => (
							<BlockRenderer key={`${message.id}-block-${i}`} block={block} />
						))}
					</div>
				) : message.streaming ? (
					<div className="flex items-center gap-2 text-text-muted">
						<div className="w-1 h-4 bg-accent rounded-full animate-pulse" />
						<span className="text-sm">Thinking</span>
						<span className="flex gap-0.5">
							<span className="w-1 h-1 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
							<span className="w-1 h-1 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
							<span className="w-1 h-1 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
						</span>
					</div>
				) : (
					<div className="text-sm text-text-muted italic">Empty response</div>
				)}
				{message.streaming && (
					<span className="inline-block w-0.5 h-4 bg-accent rounded-full animate-pulse ml-0.5 mt-1" />
				)}
				<div className="mt-1.5">
					<span className="text-[10px] text-text-muted">{formatTimestamp(message.timestamp)}</span>
				</div>
			</div>
		</div>
	);
}

function ToolMessage({ message }: { message: ChatMessage }) {
	// Tool messages render their blocks (toolCall + toolResult)
	return (
		<div className="flex justify-start gap-3 py-1">
			{/* Avatar placeholder for alignment */}
			<div className="flex-shrink-0 w-7 h-7 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center mt-0.5">
				<svg className="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</div>
			<div className="max-w-[85%] w-full min-w-0">
				<div className="border border-border-subtle rounded-xl bg-bg-elevated p-4">
					{message.blocks.map((block, i) => (
						<BlockRenderer key={`${message.id}-block-${i}`} block={block} />
					))}
					{message.streaming && (
						<div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
							<div className="w-3.5 h-3.5 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
							<span className="text-xs text-text-secondary">Executing...</span>
						</div>
					)}
				</div>
				<div className="mt-1.5">
					<span className="text-[10px] text-text-muted">{formatTimestamp(message.timestamp)}</span>
				</div>
			</div>
		</div>
	);
}

function CustomMessage({ message }: { message: ChatMessage }) {
	const text = message.blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
	return (
		<div className="flex justify-center py-1">
			<div className="text-xs text-text-muted px-3 py-1.5 bg-bg-elevated border border-border-subtle rounded-lg">
				{text || "(custom)"}
			</div>
		</div>
	);
}

export function MessageItem({ message }: { message: ChatMessage }) {
	switch (message.role) {
		case "user":
			return <UserMessage message={message} />;
		case "assistant":
			return <AssistantMessage message={message} />;
		case "tool":
			return <ToolMessage message={message} />;
		case "custom":
			return <CustomMessage message={message} />;
		default:
			return <CustomMessage message={message} />;
	}
}
