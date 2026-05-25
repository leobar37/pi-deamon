import type { ReactNode } from "react";
import type { MessageBlock } from "../store/index.js";

export interface BlockRendererStrategy {
	readonly type: string;
	canRender(block: MessageBlock): boolean;
	render(block: MessageBlock): ReactNode;
}
