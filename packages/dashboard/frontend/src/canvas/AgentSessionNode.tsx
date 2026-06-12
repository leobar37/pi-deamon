import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, ExternalLink } from "lucide-react";
import type { AgentCanvasNode } from "./types.js";

export const AgentSessionNode = memo(function AgentSessionNode({ data }: NodeProps<AgentCanvasNode>) {
	const { session, backendUrl, focused, onFocus, onOpen } = data;
	const title = session.name || `Session ${session.id.slice(0, 8)}`;

	return (
		<div
			className={`w-[760px] overflow-hidden rounded-lg border bg-bg-elevated shadow-md transition ${
				focused ? "border-accent/80 ring-2 ring-accent/25" : "border-border-default hover:border-border-hover"
			}`}
			onDoubleClick={() => onOpen(session.id)}
		>
			<Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-border-default !bg-bg-hover" />
			<div className="agent-node-drag-handle flex cursor-grab items-start justify-between gap-3 border-b border-border-subtle px-3 py-3 active:cursor-grabbing">
				<button type="button" onClick={() => onFocus(session.id)} className="min-w-0 flex-1 text-left">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-surface text-accent">
							<Bot size={15} aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="truncate text-sm font-semibold text-text-primary">{title}</div>
							<div className="mt-0.5 truncate text-xs text-text-tertiary">{session.id}</div>
						</div>
					</div>
				</button>
				<a
					href={backendUrl}
					target="_blank"
					rel="noreferrer"
					title="Open in standalone tab"
					className="flex shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg px-2 py-1 text-[11px] text-text-tertiary transition hover:border-border-hover hover:text-text-primary"
				>
					<ExternalLink size={11} aria-hidden="true" />
				</a>
			</div>

			<div className="h-[500px] bg-bg-base">
				<iframe
					src={backendUrl}
					title={`Agent session ${session.id}`}
					className="h-full w-full border-0"
					allow="clipboard-read; clipboard-write"
				/>
			</div>
			<Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-border-default !bg-bg-hover" />
		</div>
	);
});
