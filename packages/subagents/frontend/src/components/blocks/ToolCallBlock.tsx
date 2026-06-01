import { useState, useCallback, useMemo } from "react";
import { SubagentRunBlock } from "../SubagentRunBlock.tsx";
import { useSubAgentStore } from "../../store/use-subagent-store.ts";

interface ToolCallBlockProps {
	id: string;
	name: string;
	args: Record<string, unknown>;
	currentThreadId: string;
}

export function ToolCallBlock({ id, name, args, currentThreadId }: ToolCallBlockProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const toggle = useCallback(() => setIsExpanded((v) => !v), []);
	const agents = useSubAgentStore((s) => s.agents);
	const strategy = typeof args.strategy === "string" ? args.strategy : "sequential";
	const childThreads = useMemo(
		() => agents.filter((agent) => agent.parentThreadId === currentThreadId && agent.parentToolCallId === id),
		[agents, currentThreadId, id],
	);

	if (name === "lion_tasks" && childThreads.length > 0) {
		return <SubagentRunBlock threads={childThreads} strategy={strategy} />;
	}

	return (
		<div className="my-0.5">
			<button
				onClick={toggle}
				className="inline-flex max-w-full items-center gap-1.5 rounded border border-border-subtle bg-bg px-1.5 py-0.5 text-[11px] leading-4 text-text-tertiary transition hover:border-border-hover hover:text-text-secondary"
			>
				<svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				<span className="truncate font-mono">{name}</span>
			<svg
				className={`h-3 w-3 shrink-0 text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
			</svg>
		</button>
		{isExpanded && (
			<div className="mt-1 max-w-full rounded border border-border-subtle bg-bg px-2 py-1">
				<pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-snug text-text-secondary">
					{JSON.stringify(args, null, 2)}
				</pre>
			</div>
		)}
		</div>
	);
}
