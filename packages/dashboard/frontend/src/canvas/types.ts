import type { Node } from "@xyflow/react";

export type CanvasSessionRuntimeState =
	| "offline"
	| "idle"
	| "starting"
	| "running"
	| "blocked"
	| "completed"
	| "failed"
	| "timed_out"
	| "cancelled"
	| "unknown";

export interface CanvasSessionRuntime {
	id: string;
	threadId: string | null;
	state: CanvasSessionRuntimeState;
	isLive: boolean;
	isRunning: boolean;
	canPrompt: boolean;
	canFollowUp: boolean;
	canSteer: boolean;
	canAbort: boolean;
	canResume: boolean;
	canCancel: boolean;
	canKill: boolean;
	lastActivityAt: number | null;
	error: string | null;
	turnCount: number | null;
	toolCount: number | null;
	durationMs: number | null;
	modelProvider: string | null;
	modelId: string | null;
}

export interface CanvasSession {
	id: string;
	name: string;
	createdAt: number;
	projectId: string;
	cwd: string;
	/** Optional thread ID in the subagents backend. Falls back to the canvas session ID. */
	threadId: string | null;
	runtime?: CanvasSessionRuntime;
}

export interface AgentCanvasNodeData {
	session: CanvasSession;
	backendUrl: string;
	focused: boolean;
	onFocus: (sessionId: string) => void;
	onOpen: (sessionId: string) => void;
	runtime?: CanvasSessionRuntime;
	onAbort?: (sessionId: string) => void;
	[key: string]: unknown;
}

export type AgentCanvasNode = Node<AgentCanvasNodeData, "agentSession">;
