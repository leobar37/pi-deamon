/**
 * ChatView — main chat area with message history and streaming.
 */

import { useEffect, useRef, useState } from "react";
import { useSessionMessages, useSession, useSessionStreaming, useSessionEvents, useSessionRuntime } from "../store/index.js";
import { createOptimisticManager } from "../store/optimistic.js";
import { createActions } from "../store/actions.js";
import { ChatInput } from "./ChatInput.js";
import { MessageItem } from "./MessageItem.js";
import { ChatHeader } from "./ChatHeader.js";

interface ChatViewProps {
	sessionId: string | null;
}

export function ChatView({ sessionId }: ChatViewProps) {
	const session = useSession(sessionId);
	const messages = useSessionMessages(sessionId);
	const streaming = useSessionStreaming(sessionId);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const runtime = useSessionRuntime();

	// Subscribe to SSE events for this session
	useSessionEvents(sessionId);

	// Load messages when session changes (only if empty)
	useEffect(() => {
		if (!sessionId) return;
		const currentIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor(sessionId));
		if (currentIds.length === 0) {
			const optimistic = createOptimisticManager(runtime);
			const actions = createActions(runtime, optimistic);
			actions.loadMessages(sessionId).catch(() => {});
		}
	}, [sessionId, runtime]);

	// Auto-scroll
	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, autoScroll]);

	const handleScroll = () => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
	};

	if (!sessionId) {
		return (
			<div className="flex-1 flex items-center justify-center bg-bg-base">
				<div className="text-center px-6">
					<div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center">
						<span className="text-3xl font-bold text-accent">P</span>
					</div>
					<div className="text-xl font-semibold text-text-primary mb-2">Pi Dashboard</div>
					<div className="text-sm text-text-secondary leading-normal max-w-xs mx-auto">
						Select a session from the sidebar or start a new chat to begin.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-bg-base">
			{/* Chat header */}
			{session && <ChatHeader sessionId={sessionId} />}

			{/* Messages area */}
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
			>
				{messages.length === 0 && (
					<div className="flex items-center justify-center h-full">
						<div className="text-center px-6">
							<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center">
								<svg className="w-6 h-6 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
								</svg>
							</div>
							<div className="text-sm text-text-secondary leading-normal">
								No messages yet. Type something to start a conversation.
							</div>
						</div>
					</div>
				)}

				{messages.map((msg) => (
					<MessageItem key={msg.id} message={msg} />
				))}
			</div>

			{/* Input area */}
			<ChatInput sessionId={sessionId} />
		</div>
	);
}
