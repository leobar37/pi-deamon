import type { ToolCallEvent, ToolCallEventResult, ToolResultEvent } from "@earendil-works/pi-coding-agent";

const MAX_DELEGATION_DEPTH = 3;

export class LionDelegationGuard {
	#depthMap = new Map<string, number>();
	#activeToolCalls = new Map<string, string>();

	startTurn(): void {
		// Compatibility hook for builds that still notify the guard per turn.
	}

	endTurn(): void {
		// Compatibility hook for builds that still notify the guard per turn.
	}

	handleToolCall(event: ToolCallEvent): ToolCallEventResult | undefined {
		if (event.toolName !== "lion_tasks") return undefined;

		const threadId = "main";
		const currentDepth = this.#depthMap.get(threadId) ?? 0;

		if (currentDepth >= MAX_DELEGATION_DEPTH) {
			return {
				block: true,
				reason: `Delegation depth limit (${MAX_DELEGATION_DEPTH}) reached. Cannot nest lion_tasks further.`,
			};
		}

		this.#depthMap.set(threadId, currentDepth + 1);
		this.#activeToolCalls.set(event.toolCallId, threadId);
		return undefined;
	}

	handleToolResult(event: ToolResultEvent): void {
		if (event.toolName !== "lion_tasks") return;
		const threadId = this.#activeToolCalls.get(event.toolCallId);
		if (!threadId) return;
		this.#activeToolCalls.delete(event.toolCallId);
		this.releaseDepth(threadId);
	}

	releaseDepth(threadId: string): void {
		const current = this.#depthMap.get(threadId) ?? 0;
		if (current > 0) {
			this.#depthMap.set(threadId, current - 1);
		}
	}

	getDepth(threadId: string): number {
		return this.#depthMap.get(threadId) ?? 0;
	}

	reset(): void {
		this.#depthMap.clear();
		this.#activeToolCalls.clear();
	}
}
