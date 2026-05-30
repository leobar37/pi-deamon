import { useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import type { SubAgentInstanceState } from "../../store/message-blocks.js";
import { subagentInstancesAtom } from "./store.js";
import { StatusBadge } from "./StatusBadge.js";
import { navigateToSession } from "../../App.js";

interface TreeNodeProps {
	instance: SubAgentInstanceState;
	depth: number;
}

function getChildren(all: SubAgentInstanceState[], parentId: string): SubAgentInstanceState[] {
	return all.filter((inst) => inst.parentThreadId === parentId);
}

function TreeNode({ instance, depth }: TreeNodeProps) {
	const [expanded, setExpanded] = useState(true);
	const toggle = useCallback(() => setExpanded((v) => !v), []);
	const allInstances = useAtomValue(subagentInstancesAtom);
	const children = getChildren(allInstances, instance.instanceId);
	const hasChildren = children.length > 0;

	return (
		<div className="select-none">
			<div
				className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
				style={{ paddingLeft: `${12 + depth * 16}px` }}
				onClick={() => navigateToSession(instance.instanceId)}
			>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						toggle();
					}}
					className={`w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors ${hasChildren ? "" : "invisible"}`}
				>
					<svg
						className={`w-3 h-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				<StatusBadge state={instance.state} pulse={instance.state === "running"} />
				<span className="text-sm text-text-primary truncate flex-1">
					{instance.description || instance.definitionName}
				</span>
				<span className="text-xs text-text-muted shrink-0">{instance.definitionName}</span>
			</div>
			<AnimatePresence initial={false}>
				{expanded && hasChildren && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
						className="overflow-hidden"
					>
						{children.map((child) => (
							<TreeNode key={child.instanceId} instance={child} depth={depth + 1} />
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export function SubagentTree() {
	const allInstances = useAtomValue(subagentInstancesAtom);
	const roots = allInstances.filter((inst) => !inst.parentThreadId);

	if (roots.length === 0) {
		return (
			<div className="px-4 py-6 text-sm text-text-muted text-center">
				No subagent executions.
			</div>
		);
	}

	return (
		<div className="border border-border-default bg-bg-elevated rounded-lg overflow-hidden">
			<div className="px-4 py-3 border-b border-border-subtle">
				<div className="text-sm font-medium text-text-primary">Subagent execution tree</div>
				<div className="text-xs text-text-muted mt-0.5">{allInstances.length} instance{allInstances.length === 1 ? "" : "s"}</div>
			</div>
			<div className="py-1">
				{roots.map((root) => (
					<TreeNode key={root.instanceId} instance={root} depth={0} />
				))}
			</div>
		</div>
	);
}
