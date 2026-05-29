import type { ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent";

const ALLOWED_TOOLS = new Set([
	"lion_list_plans",
	"lion_activate_plan",
	"lion_next_task",
	"lion_update_task_status",
	"lion_record_task_result",
	"lion_reconcile_plan",
]);
const BLOCKED_TOOLS = new Set(["edit", "write", "grep", "bash"]);

export class LionDelegationGuard {
	startTurn(): void {
		// Compatibility hook for builds that still notify the guard per turn.
	}

	endTurn(): void {
		// Compatibility hook for builds that still notify the guard per turn.
	}

	handleToolCall(event: ToolCallEvent): ToolCallEventResult | undefined {
		if (ALLOWED_TOOLS.has(event.toolName)) return undefined;
		if (isPlanPathToolCall(event)) return undefined;
		if (BLOCKED_TOOLS.has(event.toolName)) {
			return {
				block: true,
				reason:
					"Lion build mode blocks direct app-code tools in the main thread. Use lion_tasks for code analysis/implementation, or edit only .plans/* files in this thread.",
			};
		}
		return undefined;
	}
}

function isPlanPathToolCall(event: ToolCallEvent): boolean {
	return collectStringValues(event.input).some(isPlanPath);
}

function collectStringValues(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(collectStringValues);
	if (!value || typeof value !== "object") return [];

	const result: string[] = [];
	for (const [key, child] of Object.entries(value)) {
		if ((key === "path" || key === "reference") && typeof child === "string") {
			result.push(child);
			continue;
		}
		result.push(...collectStringValues(child));
	}
	return result;
}

function isPlanPath(value: string): boolean {
	return value.startsWith(".plans/") || value === ".plans";
}
