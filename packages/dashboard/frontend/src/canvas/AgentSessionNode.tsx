import { memo, useCallback } from "react";
import { Handle, NodeResizeControl, Position, type NodeProps, type ResizeParams } from "@xyflow/react";
import { ExternalLink, Square } from "lucide-react";
import type { AgentCanvasNode } from "./types.js";

const MIN_NODE_SIZE = { width: 520, height: 360 };

export const AgentSessionNode = memo(function AgentSessionNode({ data }: NodeProps<AgentCanvasNode>) {
	const { session, backendUrl, focused, onFocus, onOpen, runtime, onAbort } = data;
	const title = session.name || `Session ${session.id.slice(0, 8)}`;
	const threadId = session.threadId ?? session.id;
	const iframeUrl = buildThreadUrl(backendUrl, threadId, "canvas");
	const standaloneUrl = buildThreadUrl(backendUrl, threadId, "full");
	const runtimeLabel = runtime?.state === "idle" ? "Idle" : runtime?.state ? runtime.state.charAt(0).toUpperCase() + runtime.state.slice(1) : "Unknown";

	const handleResizeStart = useCallback(() => {
		document.body.classList.add("agent-node-resizing");
	}, []);

	const handleResizeEnd = useCallback(
		(_: unknown, params: ResizeParams) => {
			document.body.classList.remove("agent-node-resizing");
			// Layout persistence is handled by the AgentCanvas component
			// via the dashboard API on node position/size changes.
			void params;
		},
		[],
	);

	return (
		<div
			className={`relative overflow-visible rounded-lg bg-bg-base shadow-md transition ${
				focused ? "ring-2 ring-accent/25" : "ring-1 ring-border-subtle hover:ring-border-hover"
			}`}
			style={{ width: "100%", height: "100%" }}
			onDoubleClick={() => onOpen(session.id)}
		>
			<NodeResizeControl
				position="bottom-right"
				minWidth={MIN_NODE_SIZE.width}
				minHeight={MIN_NODE_SIZE.height}
				className="agent-node-resize-grip"
				onResizeStart={handleResizeStart}
				onResizeEnd={handleResizeEnd}
			>
				<div className="agent-node-resize-grip-inner" aria-hidden="true" />
			</NodeResizeControl>
			<Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-border-default !bg-bg-hover" />
			<div className="agent-node-drag-handle flex cursor-grab items-center justify-between gap-3 bg-bg-elevated/55 px-3 py-2 active:cursor-grabbing">
				<button type="button" onClick={() => onFocus(session.id)} className="min-w-0 flex-1 text-left">
					<div className="truncate text-sm font-medium text-text-primary">{title}</div>
				</button>
				<div
					className={`flex shrink-0 items-center gap-1.5 text-[11px] ${
						runtime?.isRunning ? "text-success" : "text-text-tertiary"
					}`}
				>
					<span className={`h-1.5 w-1.5 rounded-full ${runtime?.isRunning ? "bg-success" : "bg-text-muted"}`} />
					{runtimeLabel}
				</div>
				{runtime?.canAbort ? (
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onAbort?.(session.id);
						}}
						title="Abort session"
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-warning/10 hover:text-warning"
					>
						<Square size={12} aria-hidden="true" />
					</button>
				) : null}
				<a
					href={standaloneUrl}
					target="_blank"
					rel="noreferrer"
					title="Open in standalone tab"
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-bg-hover hover:text-text-primary"
				>
					<ExternalLink size={13} aria-hidden="true" />
				</a>
			</div>

			<div className="h-[calc(100%-42px)] bg-bg-base">
				<iframe
					src={iframeUrl}
					title={`Agent session ${session.id}`}
					className="h-full w-full border-0"
					allow="clipboard-read; clipboard-write"
				/>
			</div>
			<Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-border-default !bg-bg-hover" />
		</div>
	);
});

function buildThreadUrl(backendUrl: string, threadId: string, variant: "full" | "canvas"): string {
	const url = new URL(`/thread/${encodeURIComponent(threadId)}`, backendUrl);
	if (variant === "canvas") {
		url.searchParams.set("canvas", "1");
	}
	if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1") {
		url.searchParams.set("mock", "1");
	}
	return url.toString();
}
