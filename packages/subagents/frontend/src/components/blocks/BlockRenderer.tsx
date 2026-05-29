import type { MessageBlock } from "../../types.ts";
import { TextBlock } from "./TextBlock.js";
import { ThinkingBlock } from "./ThinkingBlock.js";
import { ToolCallBlock } from "./ToolCallBlock.js";
import { ToolResultBlock } from "./ToolResultBlock.js";
import { ImageBlock } from "./ImageBlock.js";

interface BlockRendererProps {
	block: MessageBlock;
	currentThreadId: string;
}

export function BlockRenderer({ block, currentThreadId }: BlockRendererProps) {
	switch (block.type) {
		case "text":
			return <TextBlock text={block.text} />;
		case "thinking":
			return <ThinkingBlock thinking={block.thinking} signature={block.signature} redacted={block.redacted} />;
		case "toolCall":
			return <ToolCallBlock id={block.id} name={block.name} arguments={block.arguments} currentThreadId={currentThreadId} />;
		case "toolResult":
			return <ToolResultBlock toolCallId={block.toolCallId} content={block.content} isError={block.isError} />;
		case "image":
			return <ImageBlock data={block.data} mimeType={block.mimeType} />;
		default:
			return null;
	}
}
