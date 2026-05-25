import type { ReactNode } from "react";
import type { MessageBlock } from "../store/index.js";
import type { BlockRendererStrategy } from "./types.js";

export class BlockRendererRegistry {
	private strategies = new Map<string, BlockRendererStrategy>();

	register(strategy: BlockRendererStrategy): void {
		this.strategies.set(strategy.type, strategy);
	}

	render(block: MessageBlock): ReactNode {
		const strategy = this.strategies.get(block.type);
		if (!strategy) {
			console.warn(`[BlockRendererRegistry] No renderer for block type: ${block.type}`);
			return null;
		}
		return strategy.render(block);
	}

	hasRenderer(type: string): boolean {
		return this.strategies.has(type);
	}
}

export const blockRegistry = new BlockRendererRegistry();
