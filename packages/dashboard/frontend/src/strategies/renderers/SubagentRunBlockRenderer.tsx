import type { BlockRendererStrategy } from "../types.js";
import type { MessageBlock } from "../../store/index.js";
import { SubagentRunBlock } from "../../components/subagents/SubagentRunBlock.js";

export const subagentRunBlockRenderer: BlockRendererStrategy = {
	type: "subagentRun",
	canRender: (block): block is Extract<MessageBlock, { type: "subagentRun" }> =>
		block.type === "subagentRun",
	render: (block) => (
		<SubagentRunBlock
			threads={(block as Extract<MessageBlock, { type: "subagentRun" }>).threads}
			strategy={(block as Extract<MessageBlock, { type: "subagentRun" }>).strategy}
		/>
	),
};
