import { useCallback, useMemo, useState } from "react";
import type { ChatMessage } from "../types.ts";
import { messageToText } from "../utils/message-text.ts";
import { BlockRenderer } from "./blocks/BlockRenderer.js";

interface MessageItemProps {
	message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
	const [copied, setCopied] = useState(false);
	const isUser = message.role === "user";
	const isAssistant = message.role === "assistant";
	const copyText = useMemo(() => messageToText(message), [message]);
	const label = message.role === "assistant" ? "assistant" : message.role;

	const handleCopy = useCallback(() => {
		if (!copyText.trim()) return;
		copyToClipboard(copyText).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		});
	}, [copyText]);

	return (
		<div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[85%] min-w-0 select-text rounded-lg px-4 py-3 ${
					isUser ? "bg-accent-muted" : isAssistant ? "bg-bg-elevated" : "bg-bg-surface"
				}`}
			>
				<div className="mb-2 flex items-center justify-between gap-3">
					<span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
					<button
						type="button"
						onClick={handleCopy}
						disabled={!copyText.trim()}
						title="Copy message"
						className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle text-text-muted transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
					>
						{copied ? (
							<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
						) : (
							<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						)}
					</button>
				</div>
				<div className="min-w-0 space-y-2">
					{message.blocks.map((block, i) => (
						<BlockRenderer key={i} block={block} currentThreadId={message.instanceId} />
					))}
				</div>
			</div>
		</div>
	);
}

async function copyToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		return;
	} catch {
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.select();
		const success = document.execCommand("copy");
		document.body.removeChild(textarea);
		if (!success) {
			throw new Error("Clipboard fallback failed");
		}
	}
}
