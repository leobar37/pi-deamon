import { useState, useCallback } from "react";
import { ChevronDown, Link, Sparkles } from "lucide-react";

interface ThinkingBlockProps {
	thinking: string;
	signature?: string;
	redacted?: boolean;
	isStreaming?: boolean;
}

export function ThinkingBlock({ thinking, redacted, isStreaming }: ThinkingBlockProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const toggle = useCallback(() => setIsExpanded((v) => !v), []);

	if (redacted) {
		return (
			<div className="my-3 px-4 py-3 bg-bg-elevated border border-border-subtle rounded-lg">
				<div className="flex items-center gap-2 text-xs text-text-muted italic">
					<Link className="h-3.5 w-3.5" aria-hidden="true" />
					Thinking content redacted
				</div>
			</div>
		);
	}

	if (!thinking.trim()) return null;

	return (
		<div className="my-3 bg-bg-elevated border border-border-subtle rounded-lg overflow-hidden">
			<button
				onClick={toggle}
				className={`w-full flex items-center justify-between px-4 py-3 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer select-none ${isStreaming ? "animate-pulse-opacity" : ""}`}
			>
				<div className="flex items-center gap-2">
					<Sparkles className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
					<span className="font-medium">Thinking</span>
					{isStreaming && <span className="text-text-muted">...</span>}
				</div>
				<ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{isExpanded && (
				<div className="px-4 pb-3 text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
					{thinking}
				</div>
			)}
		</div>
	);
}
