import type { Node } from "@xyflow/react";
import type { SessionEntry } from "../store/index.js";

export interface AgentCanvasNodeData {
	session: SessionEntry;
	focused: boolean;
	onFocus: (sessionId: string) => void;
	onOpen: (sessionId: string) => void;
	[key: string]: unknown;
}

export type AgentCanvasNode = Node<AgentCanvasNodeData, "agentSession">;
