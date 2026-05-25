import type { BlockRendererStrategy } from "../types.js";
import type { MessageBlock } from "../../store/index.js";
import { ToolCallBlock } from "../../components/blocks/ToolCallBlock.js";

export const toolCallBlockRenderer: BlockRendererStrategy = {
	type: "toolCall",
	canRender: (block): block is Extract<MessageBlock, { type: "toolCall" }> => block.type === "toolCall",
	render: (block) => (
		<ToolCallBlock
			id={(block as Extract<MessageBlock, { type: "toolCall" }>).id}
			name={(block as Extract<MessageBlock, { type: "toolCall" }>).name}
			arguments={(block as Extract<MessageBlock, { type: "toolCall" }>).arguments}
		/>
	),
};
