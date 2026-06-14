import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Background,
	Controls,
	MiniMap,
	ReactFlow,
	ReactFlowProvider,
	type NodeMouseHandler,
	type NodeChange,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { LoadingSpinner } from "../components/LoadingSpinner.js";
import { AgentSessionNode } from "./AgentSessionNode.js";
import { createSessionNodes } from "./layout.js";
import { createDashboardClient } from "../api/dashboard-client.ts";
import type { AgentCanvasNode, CanvasSession, CanvasSessionRuntime } from "./types.js";

interface AgentCanvasProps {
	sessions: CanvasSession[];
	backendUrl: string;
	dashboardUrl: string;
	focusedSessionId: string | null;
	onFocusSession: (sessionId: string) => void;
	onOpenSession: (sessionId: string) => void;
	onCreateSession: () => void;
	canCreateSession: boolean;
	isCreatingSession?: boolean;
	onRemoveSession: (sessionId: string) => void;
	sessionRuntimes: Record<string, CanvasSessionRuntime>;
	onAbortSession: (sessionId: string) => void;
}

const nodeTypes = {
	agentSession: AgentSessionNode,
};

interface FlowCanvasProps {
	sessions: CanvasSession[];
	backendUrl: string;
	dashboardUrl: string;
	focusedSessionId: string | null;
	onFocusSession: (sessionId: string) => void;
	sessionRuntimes: Record<string, CanvasSessionRuntime>;
	onAbortSession: (sessionId: string) => void;
}

function FlowCanvas({
	sessions,
	backendUrl,
	dashboardUrl,
	focusedSessionId,
	onFocusSession,
	sessionRuntimes,
	onAbortSession,
}: FlowCanvasProps) {
	const { fitView } = useReactFlow<AgentCanvasNode>();
	const dashboardClient = useMemo(() => createDashboardClient(dashboardUrl), [dashboardUrl]);
	const [layoutMap, setLayoutMap] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});

	// Load layout from backend on mount
	useEffect(() => {
		let cancelled = false;
		async function load() {
			const map: Record<string, { x: number; y: number; width: number; height: number }> = {};
			for (const session of sessions) {
				try {
					const node = await dashboardClient.layout.get({ sessionId: session.id });
					if (node) {
						map[session.id] = { x: node.x, y: node.y, width: node.width, height: node.height };
					}
				} catch {
					// ignore missing layout
				}
			}
			if (!cancelled) {
				setLayoutMap(map);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [dashboardClient, sessions]);

	const handleOpenNode = useCallback(
		(nodeId: string) => {
			onFocusSession(nodeId);
			void fitView({
				nodes: [{ id: nodeId }],
				duration: 350,
				padding: 0.22,
				includeHiddenNodes: false,
			});
		},
		[onFocusSession, fitView],
	);

	const initialNodes = useMemo(() => {
		const sessionsWithRuntime = sessions.map((session) => ({ ...session, runtime: sessionRuntimes[session.id] }));
		return createSessionNodes(
			sessionsWithRuntime,
			focusedSessionId,
			focusedSessionId,
			backendUrl,
			onFocusSession,
			handleOpenNode,
			onAbortSession,
			layoutMap,
		);
	}, [sessions, sessionRuntimes, focusedSessionId, backendUrl, onFocusSession, handleOpenNode, onAbortSession, layoutMap]);
	const [nodes, setNodes, onNodesChange] = useNodesState<AgentCanvasNode>(initialNodes);
	const [edges, , onEdgesChange] = useEdgesState([]);

	useEffect(() => {
		setNodes((currentNodes) => {
			const currentById = new Map(currentNodes.map((node) => [node.id, node]));
			return initialNodes.map((node) => ({
				...node,
				position: currentById.get(node.id)?.position ?? node.position,
			}));
		});
	}, [initialNodes, setNodes]);

	const handleNodesChange = useCallback(
		(changes: NodeChange<AgentCanvasNode>[]) => {
			onNodesChange(changes);
			if (!changes.some((change) => change.type === "position" && change.dragging === false)) return;
			setNodes((currentNodes) => {
				for (const node of currentNodes) {
					void dashboardClient.layout.update({
						sessionId: node.id,
						x: node.position.x,
						y: node.position.y,
						width: node.width ?? 760,
						height: node.height ?? 560,
					});
				}
				return currentNodes;
			});
		},
		[onNodesChange, setNodes, dashboardClient],
	);

	const handleNodeClick = useCallback<NodeMouseHandler<AgentCanvasNode>>(
		(_, node) => {
			onFocusSession(node.id);
		},
		[onFocusSession],
	);

	const handleNodeDoubleClick = useCallback<NodeMouseHandler<AgentCanvasNode>>(
		(_, node) => {
			handleOpenNode(node.id);
		},
		[handleOpenNode],
	);

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			onNodesChange={handleNodesChange}
			onEdgesChange={onEdgesChange}
			onNodeClick={handleNodeClick}
			onNodeDoubleClick={handleNodeDoubleClick}
			fitView
			fitViewOptions={{ padding: 0.24 }}
			minZoom={0.35}
			maxZoom={1.5}
			className="agent-canvas"
		>
			<Background color="rgba(255,255,255,0.08)" gap={24} />
			<MiniMap pannable zoomable nodeStrokeWidth={2} className="!bg-bg-elevated !border !border-border-default" />
			<Controls className="!border !border-border-default !bg-bg-elevated !shadow-md" />
		</ReactFlow>
	);
}

export function AgentCanvas({
	sessions,
	backendUrl,
	dashboardUrl,
	focusedSessionId,
	onFocusSession,
	onCreateSession,
	canCreateSession,
	isCreatingSession,
	sessionRuntimes,
	onAbortSession,
}: AgentCanvasProps) {
	const handleCreateSession = () => {
		if (!canCreateSession || isCreatingSession) return;
		onCreateSession();
	};

	return (
		<div className="relative h-full min-w-0 flex-1 bg-bg-base">
			{sessions.length === 0 ? (
				<div className="absolute inset-0 z-10 flex items-center justify-center">
					<button
						type="button"
						onClick={handleCreateSession}
						disabled={isCreatingSession || !canCreateSession}
						title={canCreateSession ? (isCreatingSession ? "Creating session..." : "Add session") : "Select a project first"}
						className="group max-w-sm text-center disabled:cursor-not-allowed disabled:opacity-60"
					>
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border-default bg-bg-elevated text-accent transition group-hover:border-accent/70 group-hover:bg-bg-hover">
							{isCreatingSession ? (
								<LoadingSpinner size="md" />
							) : (
								<Plus size={20} aria-hidden="true" />
							)}
						</div>
						<div className="mt-4 text-base font-semibold text-text-primary">
							{isCreatingSession ? "Creating session..." : "No sessions yet"}
						</div>
						<div className="mt-2 text-sm leading-normal text-text-secondary">
							{canCreateSession ? "Create a session to place a new agent view on the canvas." : "Select a project before creating sessions."}
						</div>
					</button>
				</div>
			) : null}

			<ReactFlowProvider>
				<FlowCanvas
					sessions={sessions}
					backendUrl={backendUrl}
						dashboardUrl={dashboardUrl}
						focusedSessionId={focusedSessionId}
						onFocusSession={onFocusSession}
						sessionRuntimes={sessionRuntimes}
						onAbortSession={onAbortSession}
					/>
			</ReactFlowProvider>
		</div>
	);
}
