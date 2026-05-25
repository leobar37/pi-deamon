import type { BlockRendererStrategy } from "../types.js";
import type { MessageBlock } from "../../store/index.js";
import { ThinkingBlock } from "../../components/blocks/ThinkingBlock.js";

export const thinkingBlockRenderer: BlockRendererStrategy = {
	type: "thinking",
	canRender: (block): block is Extract<MessageBlock, { type: "thinking" }> => block.type === "thinking",
	render: (block) => (
		<ThinkingBlock
			thinking={(block as Extract<MessageBlock, { type: "thinking" }>).thinking}
			signature={(block as Extract<MessageBlock, { type: "thinking" }>).signature}
			redacted={(block as Extract<MessageBlock, { type: "thinking" }>).redacted}
		/>
	),
};
