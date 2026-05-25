import type { BlockRendererStrategy } from "../types.js";
import type { MessageBlock } from "../../store/index.js";
import { TextBlock } from "../../components/blocks/TextBlock.js";

export const textBlockRenderer: BlockRendererStrategy = {
	type: "text",
	canRender: (block): block is Extract<MessageBlock, { type: "text" }> => block.type === "text",
	render: (block) => <TextBlock text={(block as Extract<MessageBlock, { type: "text" }>).text} />,
};
