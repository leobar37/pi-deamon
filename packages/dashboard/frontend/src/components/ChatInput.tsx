/**
 * ChatInput — redesigned textarea for sending prompts.
 * Clean styling, subtle steer indicator, model controls placeholder.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSessionStreaming, useSessionRuntime } from "../store/index.js";
import { createOptimisticManager } from "../store/optimistic.js";
import { createActions } from "../store/actions.js";

interface ChatInputProps {
	sessionId: string;
}

export function ChatInput({ sessionId }: ChatInputProps) {
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { isStreaming, pendingSteering, pendingFollowUp } = useSessionStreaming(sessionId);
	const runtime = useSessionRuntime();

	// Stable actions instance
	const actions = useMemo(() => {
		const optimistic = createOptimisticManager(runtime);
		return createActions(runtime, optimistic);
	}, [runtime]);

	// Auto-resize textarea
	useEffect(() => {
		const ta = textareaRef.current;
		if (ta) {
			ta.style.height = "auto";
			ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
		}
	}, [text]);

	const handleSubmit = useCallback(async () => {
		const msg = text.trim();
		if (!msg || sending) return;

		setText("");
		setSending(true);

		const behavior = isStreaming ? "steer" as const : undefined;

		try {
			if (behavior === "steer") {
				await actions.steer(sessionId, msg);
			} else {
				await actions.prompt(sessionId, msg);
			}
		} catch (err) {
			console.error("Failed to send prompt:", err);
		} finally {
			setSending(false);
			textareaRef.current?.focus();
		}
	}, [text, sending, isStreaming, sessionId, actions]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleAbort = async () => {
		try {
			await actions.abort(sessionId);
		} catch (err) {
			console.error("Failed to abort:", err);
		}
	};

	const hasQueue = pendingSteering.length > 0 || pendingFollowUp.length > 0;
	const hasText = text.trim().length > 0;

	return (
		<div className="bg-bg-base border-t border-border-subtle px-4 py-4">
			{/* Steer mode indicator */}
			{isStreaming && (
				<div className="flex items-center gap-1.5 mb-2">
					<span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
					<span className="text-[11px] text-accent">Steer mode — your message will guide the current response</span>
				</div>
			)}

			{/* Queue chips */}
			{hasQueue && (
				<div className="flex flex-wrap gap-1 mb-2">
					{pendingSteering.map((msg, i) => (
						<span
							key={`steer-${i}`}
							className="px-2 py-0.5 text-[11px] text-accent truncate max-w-48"
						>
							{msg}
						</span>
					))}
					{pendingFollowUp.map((msg, i) => (
						<span
							key={`follow-${i}`}
							className="px-2 py-0.5 text-[11px] text-accent truncate max-w-48"
						>
							{msg}
						</span>
					))}
				</div>
			)}

			{/* Input area */}
			<div className="relative flex items-end gap-2 bg-bg-elevated border border-border-default rounded-xl px-3 py-2 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
				{/* Textarea */}
				<textarea
					ref={textareaRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Type a message..."
					rows={1}
					className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none resize-none py-1.5 min-h-[20px] max-h-[200px]"
					disabled={sending}
				/>

				{/* Right controls */}
				<div className="flex items-center gap-1 shrink-0 pb-0.5">
					{/* Abort during streaming */}
					{isStreaming && (
						<button
							onClick={handleAbort}
							className="p-1.5 text-error hover:text-error/80 transition-colors rounded-md hover:bg-bg-hover"
							title="Abort"
						>
							<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
								<rect x="6" y="6" width="12" height="12" rx="2" />
							</svg>
						</button>
					)}

					{/* Send button */}
					<button
						onClick={handleSubmit}
						disabled={!hasText || sending}
						className={`p-1.5 rounded-md transition-all ${
							hasText && !sending
								? "text-accent hover:bg-accent-muted"
								: "text-text-muted"
							}`}
						title="Send"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 10l7-7m0 0l7 7m-7-7v18"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
