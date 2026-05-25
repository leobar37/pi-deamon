/**
 * BlockRenderer — dispatches to the correct block component via the strategy registry.
 * Single responsibility: routing. Each block type has its own strategy renderer.
 */

import type { MessageBlock } from "../../store/index.js";
import { blockRegistry } from "../../strategies/index.js";

interface BlockRendererProps {
	block: MessageBlock;
}

export function BlockRenderer({ block }: BlockRendererProps) {
	return <>{blockRegistry.render(block)}</>;
}
