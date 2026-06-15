import type { SubAgentEvent } from "../types.js";
import type { TaskRecord, TaskStatus } from "./types.js";

type TaskChangedEvent = Extract<SubAgentEvent, { type: "task.changed" }>;
type TaskChangeAction = TaskChangedEvent["action"];

const TASK_TOOL_NAMES = new Set(["task_create", "task_update", "task_complete", "task_block", "task_delete", "todo"]);

const TASK_STATUSES = new Set<TaskStatus>(["pending", "in_progress", "blocked", "completed", "deleted"]);

const ACTIONS: Record<string, TaskChangeAction | null> = {
	create: "created",
	update: "updated",
	complete: "completed",
	block: "blocked",
	delete: "deleted",
	get: null,
	list: null,
};

export interface ToolResultEventLike {
	type: "tool_execution_end";
	toolName: string;
	result: unknown;
	isError: boolean;
}

export function taskChangedEventFromToolResult(
	event: ToolResultEventLike,
	timestamp = Date.now(),
): TaskChangedEvent | null {
	if (event.isError || !TASK_TOOL_NAMES.has(event.toolName)) return null;
	const details = readDetails(event.result);
	const actionName = readStringProperty(details, "action");
	if (!actionName) return null;
	const action = ACTIONS[actionName];
	if (!action) return null;
	if (!details) return null;
	const task = readTaskProperty(details, "task");
	if (!task) return null;
	return {
		type: "task.changed",
		action: readTaskStatusAction(task, action),
		taskId: task.id,
		task,
		timestamp,
	};
}

function readDetails(result: unknown): Record<string, unknown> | null {
	if (!isRecord(result)) return null;
	const details = result.details;
	return isRecord(details) ? details : null;
}

function readTaskProperty(record: Record<string, unknown>, key: string): TaskRecord | null {
	const value = record[key];
	return isTaskRecord(value) ? value : null;
}

function readStringProperty(record: Record<string, unknown> | null, key: string): string | null {
	if (!record) return null;
	const value = record[key];
	return typeof value === "string" ? value : null;
}

function readTaskStatusAction(task: TaskRecord, fallback: TaskChangeAction): TaskChangeAction {
	if (task.status === "completed") return "completed";
	if (task.status === "blocked") return "blocked";
	if (task.status === "deleted") return "deleted";
	return fallback;
}

function isTaskRecord(value: unknown): value is TaskRecord {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === "string" &&
		typeof value.title === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		typeof value.revision === "number" &&
		typeof value.status === "string" &&
		TASK_STATUSES.has(value.status as TaskStatus)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
