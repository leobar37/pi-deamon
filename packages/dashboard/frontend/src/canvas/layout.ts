import type { AgentCanvasNode } from "./types.js";
import type { SessionEntry } from "../store/index.js";

const NODE_WIDTH = 760;
const NODE_HEIGHT = 560;
const GAP_X = 120;
const GAP_Y = 90;
const COLUMNS = 2;

export function createSessionNodes(
	sessions: SessionEntry[],
	activeSessionId: string | null,
	focusedSessionId: string | null,
	onFocus: (sessionId: string) => void,
	onOpen: (sessionId: string) => void,
): AgentCanvasNode[] {
	return sessions.map((session, index) => {
		const column = index % COLUMNS;
		const row = Math.floor(index / COLUMNS);
		const id = session.info.id;

		return {
			id,
			type: "agentSession",
			position: {
				x: column * (NODE_WIDTH + GAP_X),
				y: row * (NODE_HEIGHT + GAP_Y),
			},
			data: {
				session,
				focused: id === focusedSessionId || id === activeSessionId,
				onFocus,
				onOpen,
			},
			dragHandle: ".agent-node-drag-handle",
		};
	});
}
