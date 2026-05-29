import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SubAgentEvent, SubAgentInstanceState } from "../types.js";

export type DashboardThreadKind = "main" | "subagent";

export interface DashboardThreadState extends SubAgentInstanceState {
	kind: DashboardThreadKind;
	parentThreadId?: string;
	parentToolCallId?: string;
	runId?: string;
	runIndex?: number;
	isLive?: boolean;
	sessionFile?: string;
	sessionId?: string;
}

export interface DashboardSessionSource {
	getThread(): DashboardThreadState | null;
	getMessages(threadId: string): AgentMessage[] | null;
	getEvents(threadId: string): SubAgentEvent[];
	subscribe(listener: (event: SubAgentEvent) => void): () => void;
}

export interface SubAgentTransport {
	readonly id: string;
	start(): Promise<void>;
	stop(): Promise<void>;
	emit(event: SubAgentTransportEvent): void;
}

export type SubAgentTransportEvent = SubAgentEvent;
