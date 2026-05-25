import type { ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
	DelegationResult,
	DelegationTask,
	ExecutionPlan,
	SubAgentCapabilities,
	SubAgentController,
	TaskExecutionResult,
} from "@local/pi-subagents";
import { TaskExecutor } from "@local/pi-subagents";
import { Type } from "typebox";
import type { LionRun } from "./core.js";
import { LionEvents } from "./events/defs.js";
import { loadLionPlan, resolvePlanReference, updateStructuredTaskStatus } from "./plans/index.js";
import { buildPlanValidationPrompt } from "./prompts/index.js";
import type { LionRuntime } from "./runtime.js";
import { createLionSubAgentController } from "./subagents/index.js";
import type {
	LionBuildResult,
	LionPlan,
	LionPlanValidationResult,
	LionTask,
	LionTaskStrategy,
	LionTasksResult,
} from "./types.js";
import { renderLionSubagentWidget } from "./ui/subagents-widget.js";
import { createRunId, formatPlanSummary, parsePlanValidationVerdict } from "./utils.js";

const LionTasksParams = Type.Object({
	tasks: Type.Array(
		Type.Object({
			definition: Type.String({
				description: "Subagent definition to use (e.g., 'analyzer', 'executor', 'reviewer')",
			}),
			title: Type.String({ description: "Short title identifying this task" }),
			prompt: Type.String({ description: "Full prompt/instructions for the subagent" }),
			capabilities: Type.Optional(
				Type.Object({
					canEdit: Type.Optional(Type.Boolean()),
					canWrite: Type.Optional(Type.Boolean()),
					canExecute: Type.Optional(Type.Boolean()),
					canResearch: Type.Optional(Type.Boolean()),
				}),
			),
		}),
		{ description: "Array of tasks to execute. Must provide at least one task." },
	),
	strategy: Type.Optional(
		Type.Union(
			[
				Type.Literal("parallel", { description: "Execute all tasks concurrently" }),
				Type.Literal("sequential", { description: "Execute tasks one after another" }),
				Type.Literal("chain", { description: "Execute sequentially, passing output to next task" }),
			],
			{ description: "Execution strategy. Default: sequential" },
		),
	),
	concurrency: Type.Optional(
		Type.Number({
			description: "Max concurrent tasks for parallel strategy. Default: 3",
			minimum: 1,
			maximum: 10,
		}),
	),
	chainOptions: Type.Optional(
		Type.Object({
			passOutputToNext: Type.Optional(
				Type.Boolean({ description: "Pass previous output to next task. Default: true" }),
			),
			outputMode: Type.Optional(
				Type.Union([Type.Literal("append"), Type.Literal("replace"), Type.Literal("template")]),
			),
			template: Type.Optional(Type.String()),
			stopOnFailure: Type.Optional(Type.Boolean({ description: "Stop chain on failure. Default: true" })),
		}),
	),
});

const _SubagentStatusParams = Type.Object({
	task_id: Type.Optional(
		Type.String({
			description: "Optional task ID for detailed status. If omitted, returns summary of all subagents.",
		}),
	),
});

const ActivatePlanParams = Type.Object({
	reference: Type.String({
		description:
			"Natural-language plan reference, slug, relative path, or absolute path. If ambiguous, the tool returns candidate plans for the orchestrator to choose from.",
	}),
});

const ValidatePlanParams = Type.Object({
	focus: Type.Optional(
		Type.String({ description: "Optional validation focus for a specific part of the active plan." }),
	),
});

const RetryTaskParams = Type.Object({
	task_id: Type.String({ description: "Task ID to retry/reset in the active plan." }),
	reset_dependencies: Type.Optional(
		Type.Boolean({
			description: "If true, also reset dependent tasks to pending so they can run again. Default: false.",
		}),
	),
});

export interface LionTaskResult {
	taskId: string;
	title: string;
	definition: string;
	status: string;
	summary: string;
	duration: number;
	turnCount: number;
	error?: string;
}

export interface LionToolResponse {
	message: string;
	run: LionRun | null;
	result?: LionBuildResult;
	validation?: LionPlanValidationResult;
	plan?: LionPlan;
	tasks?: LionTaskResult[];
	candidates?: Array<{
		slug: string;
		path: string;
		displayPath: string;
		kind: string;
		reason: string;
	}>;
}

export function registerLionTools(runtime: LionRuntime): void {
	// === Plan management ===
	runtime.pi.registerTool({
		name: "lion_activate_plan",
		label: "Lion Activate Plan",
		description:
			"Resolve a user plan reference, activate the matching Lion plan, or return candidate plans when the reference is ambiguous. Use this before lion_tasks when no plan is active or the user names a plan imprecisely.",
		promptSnippet: "Resolve the user's plan reference and activate the correct Lion plan before starting work",
		parameters: ActivatePlanParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const response = activatePlanReference(runtime, ctx, params.reference);
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_validate_plan",
		label: "Lion Validate Plan",
		description:
			"Validate the active Lion plan in planning mode using a read-only analyzer sub-agent. This does not enter build mode, mark tasks, or mutate checklist state.",
		promptSnippet: "Validate the active Lion plan with a read-only analyzer sub-agent",
		parameters: ValidatePlanParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const response = await validateActivePlan(runtime, ctx, params.focus);
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_reconcile_plan",
		label: "Lion Reconcile Plan",
		description:
			"Reset a failed or blocked task to retryable/pending status, optionally resetting its dependents too. Use this when a task failed but you want to retry it without abandoning the whole plan.",
		promptSnippet: "Reset a failed or blocked task for retry",
		parameters: RetryTaskParams,
		async execute(_toolCallId, params) {
			const response = retryTask(runtime, params.task_id, params.reset_dependencies ?? false);
			return toToolResult(response);
		},
	});

	// === Task execution ===
	runtime.pi.registerTool({
		name: "lion_tasks",
		label: "Lion Tasks",
		description:
			"Delegate one or more tasks to subagents with configurable execution strategy (parallel, sequential, or chain). The orchestrator must provide the tasks array explicitly. Subagent instances are retained for follow-up via lion_prompt_subagent.",
		promptSnippet: "Delegate tasks to subagents with explicit task definitions",
		parameters: LionTasksParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const response = await executeLionTasks(runtime, ctx, params);
			return toToolResult(response);
		},
	});
}

export async function executeLionTasks(
	runtime: LionRuntime,
	ctx: ExtensionContext,
	params: {
		tasks: Array<{
			definition: string;
			title: string;
			prompt: string;
			capabilities?: Partial<SubAgentCapabilities>;
		}>;
		strategy?: LionTaskStrategy;
		concurrency?: number;
		chainOptions?: {
			passOutputToNext?: boolean;
			outputMode?: "append" | "replace" | "template";
			template?: string;
			stopOnFailure?: boolean;
		};
	},
): Promise<LionToolResponse> {
	if (!params.tasks || params.tasks.length === 0) {
		throw new Error(
			"lion_tasks requires at least one task. Provide tasks array with definitions, titles, and prompts.",
		);
	}

	const activePlanPath = runtime.state.activePlanPath;
	const plan = activePlanPath ? loadLionPlan(activePlanPath) : null;
	runtime.rememberUiContext(ctx);

	const runId = createRunId();
	const bus = runtime.events;
	const taskConfigs = params.tasks;
	const strategy = params.strategy ?? "sequential";

	const batchTask: LionTask = {
		id: `tasks-${runId}`,
		title: `Batch ${strategy}: ${taskConfigs.length} tasks`,
		file: "",
		status: "pending",
		dependencies: [],
		requirements: [],
	};

	const controller = createController(
		runtime,
		ctx,
		runId,
		plan ?? { kind: "structured", slug: "batch", rootPath: ctx.cwd, tasks: [], indexFile: "" },
		batchTask,
	);

	for (let i = 0; i < taskConfigs.length; i++) {
		const taskId = `${runId}-task-${i}`;
		runtime.startJob({
			runId,
			taskId,
			role: "executor",
			title: taskConfigs[i].title,
		});
		runtime.startSubagentUi({
			runId,
			taskId,
			role: "executor",
			title: taskConfigs[i].title,
		});
	}
	renderLionSubagentWidget(runtime, ctx);

	const executor = new TaskExecutor({
		controller,
		onEvent: (event) => {
			if (!plan) return;
			bus.publish(LionEvents.subagentEvent, {
				runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				taskId: batchTask.id,
				subagentEvent: event,
			});
		},
	});

	const executionPlan: ExecutionPlan = {
		strategy,
		tasks: taskConfigs.map((t, i) => ({
			id: `${runId}-task-${i}`,
			definition: t.definition,
			description: t.title,
			prompt: t.prompt,
			capabilities: t.capabilities,
		})),
		concurrency: params.concurrency,
		chainOptions: params.chainOptions,
	};

	if (plan) {
		bus.publish(LionEvents.tasksStart, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			strategy,
			taskCount: taskConfigs.length,
			concurrency: params.concurrency,
		});
	}

	for (let i = 0; i < taskConfigs.length; i++) {
		if (!plan) continue;
		bus.publish(LionEvents.tasksTaskStart, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			index: i,
			title: taskConfigs[i].title,
			definition: taskConfigs[i].definition,
		});
	}

	let result: TaskExecutionResult;
	try {
		result = await executor.execute(executionPlan);
	} catch (err: unknown) {
		const error = err instanceof Error ? err.message : String(err);
		for (let i = 0; i < taskConfigs.length; i++) {
			const taskId = `${runId}-task-${i}`;
			runtime.finishJob(taskId, null, error);
			if (!plan) continue;
			bus.publish(LionEvents.tasksTaskEnd, {
				runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				index: i,
				title: taskConfigs[i].title,
				definition: taskConfigs[i].definition,
				status: "failed",
				summary: error,
			});
		}
		renderLionSubagentWidget(runtime, ctx);
		return {
			message: `Task execution failed: ${error}`,
			run: runtime.core.activeRun,
		};
	}

	for (let i = 0; i < result.results.length; i++) {
		const taskResult = result.results[i];
		const taskId = taskResult.taskId;

		runtime.finishJob(taskId, taskResult, taskResult.error);
		// Subagents are NOT retained. The orchestrator gets all information in the
		// lion_tasks response and decides the next step without follow-up.
		// If more work is needed, the orchestrator calls lion_tasks again.

		if (!plan) continue;
		bus.publish(LionEvents.tasksTaskEnd, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			index: i,
			title: taskConfigs[i].title,
			definition: taskConfigs[i].definition,
			status: taskResult.status,
			summary: taskResult.summary,
		});
	}
	renderLionSubagentWidget(runtime, ctx);

	const lionResult: LionTasksResult = {
		runId,
		strategy,
		tasks: result.results.map((r, i) => ({
			taskId: r.taskId,
			title: taskConfigs[i].title,
			definition: taskConfigs[i].definition,
			status: r.status,
			summary: r.summary,
			duration: r.duration,
			turnCount: r.turnCount,
			error: r.error,
		})),
		completedCount: result.results.filter((r) => r.status === "completed").length,
		failedCount: result.results.filter((r) => r.status === "failed").length,
		completedAt: result.completedAt,
	};

	if (plan) {
		bus.publish(LionEvents.tasksComplete, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			result: lionResult,
		});
	}

	const lines = [
		`Task execution complete (${strategy}).`,
		`Tasks: ${lionResult.tasks.length}`,
		`Completed: ${lionResult.completedCount}`,
		`Failed: ${lionResult.failedCount}`,
		"",
		"Results:",
		...lionResult.tasks.map(
			(t) => `  [${t.taskId}] ${t.title} (${t.definition}): ${t.status}${t.error ? ` — ${t.error}` : ""}`,
		),
		"",
		"If more work is needed, call lion_tasks again with a new task.",
	];

	return {
		message: lines.join("\n"),
		run: runtime.core.activeRun,
		tasks: lionResult.tasks.map((t) => ({
			taskId: t.taskId,
			title: t.title,
			definition: t.definition,
			status: t.status,
			summary: t.summary,
			duration: t.duration,
			turnCount: t.turnCount,
			error: t.error,
		})),
	};
}

export function activatePlanReference(
	runtime: LionRuntime,
	ctx: ExtensionContext,
	reference: string,
): LionToolResponse {
	const runId = createRunId();
	const bus = runtime.events;
	bus.publish(LionEvents.activateStart, { runId, input: reference });

	const resolution = resolvePlanReference(ctx.cwd, reference);
	if (resolution.status !== "resolved") {
		return {
			message:
				resolution.status === "ambiguous"
					? "Plan reference is ambiguous. The orchestrator should choose one candidate and call lion_activate_plan again with its path or slug."
					: "Plan reference did not match an existing Lion plan.",
			run: runtime.core.activeRun,
			candidates: resolution.candidates.map(toCandidateResponse),
		};
	}

	const plan = loadLionPlan(resolution.planPath);
	runtime.activatePlan(plan);
	runtime.persist("activate");
	bus.publish(LionEvents.planLoaded, {
		runId,
		planSlug: plan.slug,
		planPath: plan.rootPath,
		taskCount: plan.tasks.length,
		kind: plan.kind,
	});
	bus.publish(LionEvents.activateComplete, { runId, mode: runtime.state.mode });

	return {
		message: `Lion activated\n\n${formatPlanSummary(plan)}`,
		run: runtime.core.activeRun,
		plan,
		candidates: resolution.candidates.map(toCandidateResponse),
	};
}

export async function validateActivePlan(
	runtime: LionRuntime,
	ctx: ExtensionContext,
	focus?: string,
): Promise<LionToolResponse> {
	const activePlanPath = runtime.state.activePlanPath;
	if (!activePlanPath)
		throw new Error("Lion validate requires an active plan. Run /lion-activate or lion_activate_plan first.");
	runtime.rememberUiContext(ctx);

	const runId = createRunId();
	const bus = runtime.events;
	const plan = loadLionPlan(activePlanPath);
	const task = createPlanValidationTask(plan);
	const prompt = buildPlanValidationPrompt(plan, focus);
	const validatorTaskId = `${plan.slug}-validator-${runId}`;

	bus.publish(LionEvents.validationStart, {
		runId,
		planSlug: plan.slug,
		planPath: plan.rootPath,
		taskId: task.id,
		focus,
	});

	runtime.startJob({ runId, taskId: validatorTaskId, role: "validator", title: task.title });

	// Controller temporal para validacion read-only; NO se registra en runtime
	const controller = createLionSubAgentController({
		ctx: ctx as ExtensionCommandContext,
		runId,
		plan,
		task,
	});

	const delegationTask: DelegationTask = {
		id: validatorTaskId,
		definition: "analyzer",
		description: `Validate Lion plan ${plan.slug}`,
		prompt,
		systemPromptMode: "append",
		capabilities: { canEdit: false, canWrite: false, canExecute: false, canResearch: true },
		disabledTools: ["edit", "write", "multi-edit"],
	};

	try {
		const result = await controller.executeTask(delegationTask);
		runtime.finishJob(result.taskId, result);
		const verdict = parsePlanValidationVerdict(result.summary);

		bus.publish(LionEvents.validationEnd, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			taskId: result.taskId,
			status: result.status,
			summary: result.summary,
		});
		bus.publish(LionEvents.validationVerdict, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			taskId: result.taskId,
			verdict,
			summary: result.summary,
		});

		return {
			message: [`Lion validation: ${verdict}`, "", result.summary].join("\n"),
			run: runtime.core.activeRun,
			validation: {
				verdict,
				status: result.status,
				summary: result.summary,
				taskId: result.taskId,
			},
		};
	} catch (err: unknown) {
		const error = err instanceof Error ? err.message : String(err);
		runtime.finishJob(validatorTaskId, null, error);
		bus.publish(LionEvents.validationEnd, {
			runId,
			planSlug: plan.slug,
			planPath: plan.rootPath,
			taskId: validatorTaskId,
			status: "failed",
			summary: error,
		});
		throw new Error(`Lion validation failed: ${error}`);
	}
}

function createController(
	runtime: LionRuntime,
	ctx: ExtensionContext,
	runId: string,
	plan: LionPlan,
	task: LionTask,
	_attempt?: number,
): SubAgentController {
	const controller = createLionSubAgentController({
		ctx: ctx as ExtensionCommandContext,
		runId,
		plan,
		task,
	});
	runtime.controllers.set(runId, controller);
	runtime.activeController = controller;
	runtime.activeRunId = runId;
	return controller;
}

const LION_SUBAGENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function _waitForTaskEnd(
	controller: SubAgentController,
	taskId: string,
	timeoutMs = LION_SUBAGENT_TIMEOUT_MS,
): Promise<DelegationResult> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			unsubscribe();
			reject(new Error(`Timed out waiting for Lion sub-agent ${taskId} after ${timeoutMs}ms.`));
		}, timeoutMs);
		const unsubscribe = controller.getEventBus().on("task.end", (event) => {
			if (event.taskId !== taskId) return;
			clearTimeout(timer);
			unsubscribe();
			resolve(event.result);
		});
	});
}

function createPlanValidationTask(plan: LionPlan): LionTask {
	return {
		id: `validate-${plan.slug}`,
		title: `Validate plan ${plan.slug}`,
		file: "task-index.md",
		status: "pending",
		dependencies: [],
		requirements: [],
	};
}

function _findTask(plan: LionPlan, taskId: string): LionTask {
	const task = plan.tasks.find((candidate) => candidate.id === taskId);
	if (!task) throw new Error(`Task ${taskId} not found in plan ${plan.slug}`);
	return task;
}

function toCandidateResponse(candidate: {
	slug: string;
	path: string;
	displayPath: string;
	kind: string;
	reason: string;
}) {
	return {
		slug: candidate.slug,
		path: candidate.path,
		displayPath: candidate.displayPath,
		kind: candidate.kind,
		reason: candidate.reason,
	};
}

function toToolResult(response: LionToolResponse) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
		details: response,
	};
}

// =============================================================================
// Task retry
// =============================================================================

export function retryTask(runtime: LionRuntime, taskId: string, resetDependencies: boolean): LionToolResponse {
	const activePlanPath = runtime.state.activePlanPath;
	if (!activePlanPath) throw new Error("No active plan. Run lion_activate_plan first.");

	const plan = loadLionPlan(activePlanPath);
	const task = plan.tasks.find((t) => t.id === taskId);
	if (!task) throw new Error(`Task ${taskId} not found in plan ${plan.slug}`);

	if (task.status !== "blocked" && task.status !== "retryable") {
		throw new Error(`Task ${taskId} is ${task.status}. Only blocked or retryable tasks can be retried.`);
	}

	updateStructuredTaskStatus(plan, taskId, "retryable");

	const resetIds: string[] = [];
	if (resetDependencies) {
		for (const t of plan.tasks) {
			if (t.dependencies.includes(taskId) && t.status === "blocked") {
				updateStructuredTaskStatus(plan, t.id, "pending");
				resetIds.push(t.id);
			}
		}
	}

	const lines = [`Task ${taskId} reset to retryable.`];
	if (resetIds.length > 0) {
		lines.push(`Reset ${resetIds.length} dependent tasks to pending: ${resetIds.join(", ")}`);
	}
	lines.push("", "You can now call lion_tasks to retry this task.");

	return {
		message: lines.join("\n"),
		run: runtime.core.activeRun,
		plan,
	};
}
