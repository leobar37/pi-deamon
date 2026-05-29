import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardDebugLedger } from "../dev/debug-ledger.ts";

interface AutoScrollOptions {
	dependencyKey: string;
	enabled?: boolean;
	threadId?: string;
}

const BOTTOM_THRESHOLD = 64;

export function useAutoScroll<T extends HTMLElement>({ dependencyKey, enabled = true, threadId }: AutoScrollOptions) {
	const scrollRef = useRef<T>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const [isSticky, setIsSticky] = useState(true);
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);

	const isNearBottom = useCallback((element: HTMLElement): boolean => {
		return element.scrollHeight - element.clientHeight - element.scrollTop <= BOTTOM_THRESHOLD;
	}, []);

	const scrollToBottom = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		requestAnimationFrame(() => {
			element.scrollTop = element.scrollHeight;
			setIsSticky(true);
			setShowJumpToLatest(false);
			dashboardDebugLedger.recordScroll(threadId ?? "unknown", {
				sticky: true,
				showJumpToLatest: false,
				scrollTop: element.scrollTop,
				scrollHeight: element.scrollHeight,
				clientHeight: element.clientHeight,
			});
		});
	}, [threadId]);

	useEffect(() => {
		if (!enabled || !isSticky) {
			setShowJumpToLatest(!isSticky);
			return;
		}
		scrollToBottom();
	}, [dependencyKey, enabled, isSticky, scrollToBottom]);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element || !enabled) return;

		const handleScroll = () => {
			const nearBottom = isNearBottom(element);
			setIsSticky(nearBottom);
			setShowJumpToLatest(!nearBottom);
			dashboardDebugLedger.recordScroll(threadId ?? "unknown", {
				sticky: nearBottom,
				showJumpToLatest: !nearBottom,
				scrollTop: element.scrollTop,
				scrollHeight: element.scrollHeight,
				clientHeight: element.clientHeight,
			});
		};
		const maybeScroll = () => {
			if (isSticky) scrollToBottom();
		};
		const observer = new ResizeObserver(maybeScroll);
		const mutationObserver = new MutationObserver(maybeScroll);

		element.addEventListener("scroll", handleScroll, { passive: true });
		observer.observe(element);
		mutationObserver.observe(element, { childList: true, characterData: true, subtree: true });

		return () => {
			element.removeEventListener("scroll", handleScroll);
			observer.disconnect();
			mutationObserver.disconnect();
		};
	}, [enabled, isNearBottom, isSticky, scrollToBottom, threadId]);

	return { scrollRef, bottomRef, showJumpToLatest, scrollToBottom };
}
