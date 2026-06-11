import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, ExternalLink, Folder, Play, Radio, Square } from "lucide-react";
import type { AgentCanvasNode } from "./types.js";

const STATUS_STYLES = {
	created: "border-text-muted/40 bg-bg-surface text-text-secondary",
	starting: "border-warning/50 bg-bg-surface text-warning",
	idle: "border-success/45 bg-bg-surface text-success",
	streaming: "border-accent/60 bg-accent-muted text-accent-hover",
	error: "border-error/55 bg-bg-surface text-error",
	stopped: "border-border-default bg-bg-surface text-text-tertiary",
};

function formatCwd(cwd: string): string {
	const parts = cwd.split("/").filter(Boolean);
	return parts.at(-1) ?? cwd;
}

function formatUpdated(value: number): string {
	const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	return `${hours}h ago`;
}

export const AgentSessionNode = memo(function AgentSessionNode({ data }: NodeProps<AgentCanvasNode>) {
	const { session, focused, onFocus, onOpen } = data;
	const info = session.info;
	const statusStyle = STATUS_STYLES[info.status];
	const title = info.name || `Session ${info.id.slice(0, 8)}`;
	const isStreaming = info.status === "streaming" || session.streaming;

	return (
		<div
			className={`w-[760px] overflow-hidden rounded-lg border bg-bg-elevated shadow-md transition ${
				focused ? "border-accent/80 ring-2 ring-accent/25" : "border-border-default hover:border-border-hover"
			}`}
			onDoubleClick={() => onOpen(info.id)}
		>
			<Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-border-default !bg-bg-hover" />
			<div className="agent-node-drag-handle flex cursor-grab items-start justify-between gap-3 border-b border-border-subtle px-3 py-3 active:cursor-grabbing">
				<button type="button" onClick={() => onFocus(info.id)} className="min-w-0 flex-1 text-left">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-surface text-accent">
							<Bot size={15} aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="truncate text-sm font-semibold text-text-primary">{title}</div>
							<div className="mt-0.5 truncate text-xs text-text-tertiary">{info.id}</div>
						</div>
					</div>
				</button>
				<div className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${statusStyle}`}>
					{isStreaming ? <Radio size={11} aria-hidden="true" /> : info.isActive ? <Play size={11} aria-hidden="true" /> : <Square size={10} aria-hidden="true" />}
					<span>{info.status}</span>
				</div>
				<div className="shrink-0 rounded-md border border-border-subtle bg-bg px-2 py-1 text-[11px] text-text-tertiary">
					{info.processId ? `PID ${info.processId}` : "not started"}
				</div>
			</div>

			{info.uiUrl ? (
				<div className="h-[500px] bg-bg-base">
					<iframe
						src={info.uiUrl}
						title={`Agent session ${info.id}`}
						className="h-full w-full border-0"
						allow="clipboard-read; clipboard-write"
					/>
				</div>
			) : (
				<div className="flex h-[500px] items-center justify-center bg-bg-base px-8 text-center">
					<div>
						<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-accent">
							<ExternalLink size={16} aria-hidden="true" />
						</div>
						<div className="mt-3 text-sm font-semibold text-text-primary">Embedded UI is starting</div>
						<div className="mt-2 text-xs leading-normal text-text-secondary">
							The same subagents interface will appear here when the session process is ready.
						</div>
						<div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-tertiary">
							<Folder size={13} aria-hidden="true" />
							<span>{formatCwd(info.cwd)}</span>
							<span>·</span>
							<span>{formatUpdated(info.lastActivityAt)}</span>
							<span>·</span>
							<span>{info.processId ? `PID ${info.processId}` : "not started"}</span>
						</div>
					</div>
				</div>
			)}
			<Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-border-default !bg-bg-hover" />
		</div>
	);
});
