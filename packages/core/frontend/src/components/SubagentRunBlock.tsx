import { AnimatePresence, motion } from "framer-motion";
import type { SubAgentInstanceState } from "../types.ts";
import { navigateToThread } from "../navigation.ts";
import { StatusBadge } from "./StatusBadge.tsx";

interface SubagentRunBlockProps {
	threads: SubAgentInstanceState[];
	strategy: string;
}

function elapsed(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
	const m = Math.floor(s / 60);
	return `${m}m${Math.floor(s % 60).toString().padStart(2, "0")}s`;
}

export function SubagentRunBlock({ threads, strategy }: SubagentRunBlockProps) {
	const sorted = [...threads].sort((a, b) => (a.runIndex ?? 0) - (b.runIndex ?? 0) || b.lastActivityAt - a.lastActivityAt);

	return (
		<motion.div
			className="my-2 overflow-hidden rounded-md bg-bg-elevated/45"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			layout
		>
			<div className="flex items-center justify-between gap-3 px-3 py-2">
				<div className="flex items-center justify-between gap-3">
					<div className="text-xs font-medium text-text-secondary">Lion subagents</div>
				</div>
				<div className="text-[11px] text-text-muted">
					{strategy} · {sorted.length} task{sorted.length === 1 ? "" : "s"}
				</div>
			</div>
			<div className="space-y-0.5 px-2 pb-2">
				<AnimatePresence initial={false}>
					{sorted.map((thread) => (
						<motion.button
							key={thread.instanceId}
							type="button"
							onClick={() => navigateToThread(thread.instanceId)}
							className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ duration: 0.16, ease: "easeOut" }}
							layout
						>
							<div className="flex min-w-0 items-center gap-2">
								<StatusBadge state={thread.state} pulse={thread.state === "running"} />
								<span className="truncate text-xs font-medium text-text-primary">
									{thread.description || thread.definitionName}
								</span>
							</div>
							<span className="text-[11px] text-text-muted">{thread.definitionName}</span>
							<div className="col-span-2 mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-text-muted">
								<span>{thread.turnCount} turns</span>
								<span>{thread.toolCount} tools</span>
								{thread.startTime ? <span>{elapsed(thread.durationMs)}</span> : null}
								{thread.currentTool ? <span className="text-accent">Running: {thread.currentTool}</span> : null}
								{thread.error ? <span className="truncate text-error">{thread.error}</span> : null}
							</div>
						</motion.button>
					))}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
