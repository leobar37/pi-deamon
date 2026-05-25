import type { BlockRendererStrategy } from "../types.js";
import type { MessageBlock } from "../../store/index.js";
import { ImageBlock } from "../../components/blocks/ImageBlock.js";

export const imageBlockRenderer: BlockRendererStrategy = {
	type: "image",
	canRender: (block): block is Extract<MessageBlock, { type: "image" }> => block.type === "image",
	render: (block) => (
		<ImageBlock
			data={(block as Extract<MessageBlock, { type: "image" }>).data}
			mimeType={(block as Extract<MessageBlock, { type: "image" }>).mimeType}
		/>
	),
};
