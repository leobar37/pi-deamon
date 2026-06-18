import type { ChatMessage, SubAgentEvent, SubAgentInstanceState, TaskRecord, TaskStatus } from "../types.ts";

const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

export const MOCK_TODO_TASKS: TaskRecord[] = [
	{
		id: "a11ce001",
		title: "Review README task flow",
		status: "in_progress",
		createdAt: minutesAgo(48),
		updatedAt: minutesAgo(4),
		revision: 3,
		assignedToSession: "mock-session",
		context: {
			notes: "Current session is checking how task_list renders local todos.",
			files: ["README.md"],
			doneWhen: ["The session can explain one README improvement without editing files."],
		},
	},
	{
		id: "b0b00002",
		title: "Add browser-visible smoke notes",
		status: "pending",
		createdAt: minutesAgo(42),
		updatedAt: minutesAgo(42),
		revision: 1,
		context: {
			notes: "Capture what the user should see in the session workspace.",
		},
	},
	{
		id: "c0ffee03",
		title: "Verify task actions",
		status: "pending",
		createdAt: minutesAgo(36),
		updatedAt: minutesAgo(30),
		revision: 2,
		context: {
			notes: "Start, complete, block, reopen, and delete controls should be visible.",
		},
	},
	{
		id: "d15ea5ed",
		title: "Confirm plain session task rendering",
		status: "blocked",
		createdAt: minutesAgo(28),
		updatedAt: minutesAgo(18),
		revision: 2,
		context: {
			notes: "Blocked until the mock route is inspected separately from plan checklist output.",
		},
	},
	{
		id: "decaf004",
		title: "Load todos extension commands",
		status: "completed",
		createdAt: minutesAgo(64),
		updatedAt: minutesAgo(52),
		completedAt: minutesAgo(52),
		revision: 4,
		context: {
			notes: "task_create, task_list, task_get, task_update, task_complete, task_block, task_delete.",
		},
	},
];

let mockTodoTasks: TaskRecord[] = MOCK_TODO_TASKS.map(cloneTask);
let mockTodoStep = 0;

export interface MockTodoProgressEvents {
	sessionEvent: SubAgentEvent;
	taskEvent: SubAgentEvent;
}

export function listMockTodoTasks(includeDeleted = false): TaskRecord[] {
	return mockTodoTasks.filter((task) => includeDeleted || task.status !== "deleted").map(cloneTask);
}

export function getMockTodoTask(id: string | undefined): TaskRecord | null {
	const task = mockTodoTasks.find((item) => item.id === id);
	return task ? cloneTask(task) : null;
}

export function createMockTodoTask(input: {
	title: string;
	status?: TaskStatus;
	assignedToSession?: string;
	actorSessionId?: string;
	context?: TaskRecord["context"];
}): TaskRecord {
	const timestamp = new Date().toISOString();
	const task: TaskRecord = {
		id: `mock${Math.random().toString(16).slice(2, 8)}`,
		title: input.title.trim(),
		status: input.status ?? "pending",
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1,
		assignedToSession: input.assignedToSession ?? (input.status === "in_progress" ? input.actorSessionId : undefined),
		context: input.context,
	};
	mockTodoTasks = [task, ...mockTodoTasks];
	return cloneTask(task);
}

export function updateMockTodoTask(
	id: string | undefined,
	update: (task: TaskRecord) => TaskRecord,
): TaskRecord | null {
	if (!id) return null;
	let updatedTask: TaskRecord | null = null;
	mockTodoTasks = mockTodoTasks.map((task) => {
		if (task.id !== id) return task;
		updatedTask = {
			...update(task),
			updatedAt: new Date().toISOString(),
			revision: task.revision + 1,
		};
		return updatedTask;
	});
	return updatedTask ? cloneTask(updatedTask) : null;
}

export function advanceMockTodoProgress(): MockTodoProgressEvents {
	const activeTask = mockTodoTasks.find((task) => task.status === "in_progress");
	const nextPending = mockTodoTasks.find((task) => task.status === "pending");
	const timestamp = Date.now();

	if (mockTodoStep % 2 === 0 && activeTask) {
		const task = updateMockTodoTask(activeTask.id, (current) => ({
			...current,
			status: "completed",
			completedAt: new Date().toISOString(),
			assignedToSession: undefined,
		}))!;
		mockTodoStep++;
		return mockToolProgressEvents("task_complete", "complete", task, timestamp);
	}

	if (nextPending) {
		const task = updateMockTodoTask(nextPending.id, (current) => ({
			...current,
			status: "in_progress",
			assignedToSession: MOCK_TODO_AGENT.sessionId,
		}))!;
		mockTodoStep++;
		return mockToolProgressEvents("task_update", "update", task, timestamp);
	}

	const task = listMockTodoTasks().find((item) => item.status === "blocked") ?? listMockTodoTasks()[0];
	mockTodoStep++;
	return mockToolProgressEvents("task_block", "block", task, timestamp);
}

export const MOCK_TODO_AGENT: SubAgentInstanceState = {
	instanceId: "main:mock-session",
	taskId: "main",
	definitionName: "main-agent",
	cwd: "/mock/project",
	kind: "main",
	description: "Todos mock session",
	state: "paused",
	startTime: now.getTime() - 90_000,
	endTime: null,
	turnCount: 1,
	lastActivityAt: now.getTime() - 7_000,
	currentTool: null,
	error: null,
	toolCount: 1,
	currentToolStartedAt: null,
	durationMs: 90_000,
	isLive: true,
	sessionId: "mock-session",
	modelProvider: "openai-codex",
	modelId: "gpt-5.5",
};

export const MOCK_TODO_MESSAGES: ChatMessage[] = [
	{
		id: "mock-todos-user-1",
		instanceId: "main:mock-session",
		role: "user",
		blocks: [{ type: "text", text: "List all local todos for this session." }],
		timestamp: now.getTime() - 12_000,
	},
	{
		id: "mock-todos-assistant-1",
		instanceId: "main:mock-session",
		role: "assistant",
		blocks: [
			{ type: "text", text: "I'll inspect the local task list from the todos extension." },
			{ type: "toolCall", id: "mock-task-list-call", name: "task_list", arguments: { includeDeleted: false } },
			{
				type: "toolResult",
				toolCallId: "mock-task-list-call",
				toolName: "task_list",
				content: JSON.stringify(
					{
						in_progress: MOCK_TODO_TASKS.filter((task) => task.status === "in_progress"),
						pending: MOCK_TODO_TASKS.filter((task) => task.status === "pending"),
						blocked: MOCK_TODO_TASKS.filter((task) => task.status === "blocked"),
						completed: MOCK_TODO_TASKS.filter((task) => task.status === "completed"),
					},
					null,
					2,
				),
				isError: false,
			},
			{
				type: "text",
				text: "The local todos render as a simple checklist in the Tasks panel. These are TaskRecord items from the todos extension.",
			},
		],
		timestamp: now.getTime() - 7_000,
	},
];

function mockToolProgressEvents(
	toolName: "task_update" | "task_complete" | "task_block",
	action: "update" | "complete" | "block",
	task: TaskRecord,
	timestamp: number,
): MockTodoProgressEvents {
	const toolCallId = `mock-${toolName}-${timestamp}`;
	const details = { action, task };
	return {
		sessionEvent: {
			type: "session.event",
			instanceId: MOCK_TODO_AGENT.instanceId,
			taskId: MOCK_TODO_AGENT.taskId,
			sessionEvent: {
				type: "tool_execution_end",
				toolCallId,
				toolName,
				result: {
					content: [{ type: "text", text: JSON.stringify(task) }],
					details,
				},
				isError: false,
			},
			timestamp,
		},
		taskEvent: taskChangedEvent(taskActionFromToolDetails(action, task), task, timestamp),
	};
}

function taskChangedEvent(action: "created" | "updated" | "completed" | "blocked" | "deleted", task: TaskRecord, timestamp: number): SubAgentEvent {
	return {
		type: "task.changed",
		action,
		taskId: task.id,
		task,
		timestamp,
	};
}

function taskActionFromToolDetails(action: "update" | "complete" | "block", task: TaskRecord): "updated" | "completed" | "blocked" | "deleted" {
	if (task.status === "completed") return "completed";
	if (task.status === "blocked") return "blocked";
	if (task.status === "deleted") return "deleted";
	return action === "complete" ? "completed" : action === "block" ? "blocked" : "updated";
}

function cloneTask(task: TaskRecord): TaskRecord {
	return {
		...task,
		context: task.context
			? {
					...task.context,
					files: task.context.files ? [...task.context.files] : undefined,
					doneWhen: task.context.doneWhen ? [...task.context.doneWhen] : undefined,
				}
			: undefined,
	};
}
