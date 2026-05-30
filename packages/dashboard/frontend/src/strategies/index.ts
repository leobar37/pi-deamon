import { blockRegistry } from "./registry.js";
import { textBlockRenderer } from "./renderers/TextBlockRenderer.tsx";
import { thinkingBlockRenderer } from "./renderers/ThinkingBlockRenderer.tsx";
import { toolCallBlockRenderer } from "./renderers/ToolCallBlockRenderer.tsx";
import { toolResultBlockRenderer } from "./renderers/ToolResultBlockRenderer.tsx";
import { imageBlockRenderer } from "./renderers/ImageBlockRenderer.tsx";
import { subagentRunBlockRenderer } from "./renderers/SubagentRunBlockRenderer.tsx";

blockRegistry.register(textBlockRenderer);
blockRegistry.register(thinkingBlockRenderer);
blockRegistry.register(toolCallBlockRenderer);
blockRegistry.register(toolResultBlockRenderer);
blockRegistry.register(imageBlockRenderer);
blockRegistry.register(subagentRunBlockRenderer);

export { blockRegistry } from "./registry.js";
export type { BlockRendererStrategy } from "./types.js";
