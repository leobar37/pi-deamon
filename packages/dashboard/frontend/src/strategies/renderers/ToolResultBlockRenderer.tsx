import type { BlockRendererStrategy } from "../types.js";
import type { MessageBlock } from "../../store/index.js";
import { ToolResultBlock } from "../../components/blocks/ToolResultBlock.js";

export const toolResultBlockRenderer: BlockRendererStrategy = {
	type: "toolResult",
	canRender: (block): block is Extract<MessageBlock, { type: "toolResult" }> => block.type === "toolResult",
	render: (block) => (
		<ToolResultBlock
			toolCallId={(block as Extract<MessageBlock, { type: "toolResult" }>).toolCallId}
			content={(block as Extract<MessageBlock, { type: "toolResult" }>).content}
			isError={(block as Extract<MessageBlock, { type: "toolResult" }>).isError}
		/>
	),
};
