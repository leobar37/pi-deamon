import { createEvent } from "./event-core.js";
import type { DelegationResult } from "./types.js";

// =============================================================================
// SubAgent Event Creators
// =============================================================================

export const SubAgentEvents = {
	lifecycleChange: createEvent<"lifecycle.change", { instanceId: string; previous: string; current: string }>(
		"lifecycle.change",
	),

	taskStart: createEvent<
		"task.start",
		{ instanceId: string; taskId: string; definitionName: string; description?: string }
	>("task.start"),

	taskEnd: createEvent<"task.end", { instanceId: string; taskId: string; result: DelegationResult }>("task.end"),

	turnComplete: createEvent<
		"turn.complete",
		{ instanceId: string; taskId: string; turnIndex: number; toolCount: number; hadError: boolean }
	>("turn.complete"),

	toolExecute: createEvent<
		"tool.execute",
		{ instanceId: string; taskId: string; toolName: string; toolCallId: string; isError: boolean }
	>("tool.execute"),

	progressUpdate: createEvent<"progress.update", { instanceId: string; taskId: string; message: string }>(
		"progress.update",
	),

	queryResponse: createEvent<
		"query.response",
		{ instanceId: string; taskId: string; queryId: string; question: string; answer: string }
	>("query.response"),

	summaryAvailable: createEvent<
		"summary.available",
		{ instanceId: string; taskId: string; summary: string; messageCount: number }
	>("summary.available"),

	error: createEvent<"error", { instanceId: string; taskId: string; error: string; fatal: boolean }>("error"),
} as const;

// =============================================================================
// Re-export types for convenience
// =============================================================================

export type SubAgentEventCreators = typeof SubAgentEvents;
