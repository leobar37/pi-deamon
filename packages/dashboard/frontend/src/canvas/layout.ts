import type { AgentCanvasNode, CanvasSession } from "./types.js";

const NODE_WIDTH = 760;
const NODE_HEIGHT = 560;
const GAP_X = 120;
const GAP_Y = 90;
const COLUMNS = 2;

export function createSessionNodes(
	sessions: CanvasSession[],
	activeSessionId: string | null,
	focusedSessionId: string | null,
	backendUrl: string,
	onFocus: (sessionId: string) => void,
	onOpen: (sessionId: string) => void,
	onAbort?: (sessionId: string) => void,
	layoutMap?: Record<string, { x: number; y: number; width: number; height: number }>,
): AgentCanvasNode[] {
	return sessions.map((session, index) => {
		const column = index % COLUMNS;
		const row = Math.floor(index / COLUMNS);
		const id = session.id;
		const layout = layoutMap?.[id];

		return {
			id,
			type: "agentSession",
			width: layout?.width ?? NODE_WIDTH,
			height: layout?.height ?? NODE_HEIGHT,
			style: {
				width: layout?.width ?? NODE_WIDTH,
				height: layout?.height ?? NODE_HEIGHT,
			},
			position: layout
				? { x: layout.x, y: layout.y }
				: {
						x: column * (NODE_WIDTH + GAP_X),
						y: row * (NODE_HEIGHT + GAP_Y),
					},
			data: {
				session,
				backendUrl,
				focused: id === focusedSessionId || id === activeSessionId,
				runtime: session.runtime,
				onFocus,
				onOpen,
				onAbort,
			},
			dragHandle: ".agent-node-drag-handle",
		};
	});
}
