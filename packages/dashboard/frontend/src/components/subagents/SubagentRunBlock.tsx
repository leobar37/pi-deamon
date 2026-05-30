import { AnimatePresence, motion } from "framer-motion";
import type { SubAgentInstanceState } from "../../store/message-blocks.js";
import { navigateToSession } from "../../App.js";
import { StatusBadge } from "./StatusBadge.js";

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
	const sorted = [...threads].sort(
		(a, b) =>
			(a.runIndex ?? 0) - (b.runIndex ?? 0) || b.lastActivityAt - a.lastActivityAt,
	);

	return (
		<motion.div
			className="my-3 border border-border-default bg-bg-elevated rounded-lg overflow-hidden"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			layout
		>
			<div className="px-4 py-3 border-b border-border-subtle">
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm font-medium text-text-primary">Lion subagents</div>
					<div className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[11px] uppercase tracking-normal text-text-secondary">
						{strategy}
					</div>
				</div>
				<div className="text-xs text-text-muted mt-0.5">
					{sorted.length} delegated task{sorted.length === 1 ? "" : "s"}
				</div>
			</div>
			<div className="divide-y divide-border-subtle">
				<AnimatePresence initial={false}>
					{sorted.map((thread) => (
						<motion.button
							key={thread.instanceId}
							type="button"
							onClick={() => navigateToSession(thread.instanceId)}
							className="w-full px-4 py-3 text-left hover:bg-bg-hover transition-colors"
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ duration: 0.16, ease: "easeOut" }}
							layout
						>
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2 min-w-0">
									<StatusBadge
										state={thread.state}
										pulse={thread.state === "running"}
									/>
									<span className="text-sm font-medium text-text-primary truncate">
										{thread.description || thread.definitionName}
									</span>
								</div>
								<span className="text-xs text-text-muted shrink-0">
									{thread.definitionName}
								</span>
							</div>
							<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
								<span>{thread.turnCount} turns</span>
								<span>{thread.toolCount} tools</span>
								{thread.startTime ? <span>{elapsed(thread.durationMs)}</span> : null}
								{thread.currentTool ? (
									<span className="text-accent">Running: {thread.currentTool}</span>
								) : null}
							</div>
							{thread.error ? (
								<div className="mt-1.5 text-xs text-error truncate">{thread.error}</div>
							) : null}
						</motion.button>
					))}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
