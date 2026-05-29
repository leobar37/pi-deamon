import { Type } from "typebox";
import type { LionRun } from "./core.js";
import { PlanActivator } from "./plan-activator.js";
import {
	getNextExecutableTask,
	listPlans,
	loadLionPlan,
	recordStructuredTaskResult,
	updateStructuredTaskStatus,
} from "./plans/index.js";
import type { LionRuntime } from "./runtime.js";
import { TaskReconciler } from "./task-reconciler.js";
import { TaskRunner } from "./task-runner.js";
import type {
	LionBuildResult,
	LionPlan,
	LionPlanValidationResult,
	LionTask,
	LionTaskResult,
	LionTaskStatus,
} from "./types.js";

// =============================================================================
// Shared types
// =============================================================================

export interface LionToolResponse {
	run: LionRun | null;
	result?: LionBuildResult;
	validation?: LionPlanValidationResult;
	plan?: LionPlan;
	tasks?: LionTaskResult[];
	nextTask?: LionTask | null;
	candidates?: Array<{
		slug: string;
		path: string;
		displayPath: string;
		kind: string;
		reason: string;
	}>;
}

// =============================================================================
// Parameter schemas
// =============================================================================

const LionTasksParams = Type.Object({
	tasks: Type.Array(
		Type.Object({
			definition: Type.String({
				description: "Subagent definition to use (e.g., 'analyzer', 'executor', 'reviewer')",
			}),
			title: Type.String({ description: "Short title identifying this task" }),
			prompt: Type.String({
				description:
					"Compact XML delegation brief for the subagent. Include role, plan path, task id, task file path, scope, objective, constraints, output contract, and validation. Prefer references to files over pasted plan content or long command lists.",
			}),
			capabilities: Type.Optional(
				Type.Object({
					canEdit: Type.Optional(Type.Boolean()),
					canWrite: Type.Optional(Type.Boolean()),
					canExecute: Type.Optional(Type.Boolean()),
					canResearch: Type.Optional(Type.Boolean()),
				}),
			),
			skillPaths: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Optional skill file or directory paths to force-load for this subagent. Use when a task needs a specific domain workflow skill.",
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
		Type.Number({ description: "Max concurrent tasks for parallel strategy. Default: 3", minimum: 1, maximum: 10 }),
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

const ActivatePlanParams = Type.Object({
	reference: Type.String({
		description: "Natural-language plan reference, slug, relative path, or absolute path.",
	}),
});

const RetryTaskParams = Type.Object({
	task_id: Type.String({ description: "Task ID to retry/reset in the active plan." }),
	reset_dependencies: Type.Optional(
		Type.Boolean({ description: "If true, also reset dependent tasks to pending. Default: false." }),
	),
});

const TaskStatusSchema = Type.Union([
	Type.Literal("pending"),
	Type.Literal("in_progress"),
	Type.Literal("complete"),
	Type.Literal("blocked"),
	Type.Literal("retryable"),
]);

const TaskStatusParams = Type.Object({
	task_id: Type.String({ description: "Task ID to update in the active plan." }),
	status: TaskStatusSchema,
	summary: Type.Optional(Type.String({ description: "Short result summary, evidence, or blocker reason." })),
});

// =============================================================================
// Tool registration
// =============================================================================

export function registerLionTools(runtime: LionRuntime): void {
	const activator = new PlanActivator(runtime);
	const reconciler = new TaskReconciler(runtime);
	const runner = new TaskRunner(runtime);

	runtime.pi.registerTool({
		name: "lion_activate_plan",
		label: "Lion Activate Plan",
		description:
			"Resolve a user plan reference, activate the matching Lion plan, or return candidate plans when the reference is ambiguous.",
		promptSnippet: "Resolve the user's plan reference and activate the correct Lion plan before starting work",
		parameters: ActivatePlanParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = activator.activate(ctx, params.reference);
			runtime.logTool("lion_activate_plan", { reference: params.reference }, result);
			return toToolResult(result);
		},
	});

	runtime.pi.registerTool({
		name: "lion_reconcile_plan",
		label: "Lion Reconcile Plan",
		description: "Reset a failed or blocked task to retryable/pending status.",
		promptSnippet: "Reset a failed or blocked task for retry",
		parameters: RetryTaskParams,
		async execute(_toolCallId, params) {
			const result = reconciler.reconcile(params.task_id, params.reset_dependencies ?? false);
			runtime.logTool(
				"lion_reconcile_plan",
				{ task_id: params.task_id, reset_dependencies: params.reset_dependencies },
				result,
			);
			return toToolResult(result);
		},
	});

	runtime.pi.registerTool({
		name: "lion_next_task",
		label: "Lion Next Task",
		description: "Return the next pending or retryable task whose dependencies are complete.",
		promptSnippet: "Find the next executable task in the active Lion plan",
		parameters: Type.Object({}),
		async execute() {
			const activePlanPath = runtime.state.activePlanPath;
			if (!activePlanPath) throw new Error("No active plan. Run lion_activate_plan first.");
			const plan = loadLionPlan(activePlanPath);
			const nextTask = getNextExecutableTask(plan);
			runtime.logTool("lion_next_task", {}, { taskId: nextTask?.id ?? null });
			return toToolResult({ run: runtime.core.activeRun, plan, nextTask });
		},
	});

	runtime.pi.registerTool({
		name: "lion_update_task_status",
		label: "Lion Update Task Status",
		description: "Persistently update a task status in the active Lion plan checklist.",
		promptSnippet: "Mark a Lion plan task pending, in progress, complete, blocked, or retryable",
		parameters: TaskStatusParams,
		async execute(_toolCallId, params) {
			const activePlanPath = runtime.state.activePlanPath;
			if (!activePlanPath) throw new Error("No active plan. Run lion_activate_plan first.");
			const plan = loadLionPlan(activePlanPath);
			updateStructuredTaskStatus(plan, params.task_id, params.status as LionTaskStatus);
			const updatedPlan = loadLionPlan(activePlanPath);
			runtime.logTool("lion_update_task_status", params, { taskId: params.task_id, status: params.status });
			return toToolResult({ run: runtime.core.activeRun, plan: updatedPlan });
		},
	});

	runtime.pi.registerTool({
		name: "lion_record_task_result",
		label: "Lion Record Task Result",
		description: "Persist task status and a short result summary after subagent execution.",
		promptSnippet: "Record Lion task execution result and evidence summary",
		parameters: TaskStatusParams,
		async execute(_toolCallId, params) {
			const activePlanPath = runtime.state.activePlanPath;
			if (!activePlanPath) throw new Error("No active plan. Run lion_activate_plan first.");
			const plan = loadLionPlan(activePlanPath);
			recordStructuredTaskResult(plan, params.task_id, params.status as LionTaskStatus, params.summary);
			const updatedPlan = loadLionPlan(activePlanPath);
			runtime.logTool("lion_record_task_result", params, { taskId: params.task_id, status: params.status });
			return toToolResult({ run: runtime.core.activeRun, plan: updatedPlan });
		},
	});

	runtime.pi.registerTool({
		name: "lion_list_plans",
		label: "Lion List Plans",
		description: "List all available Lion plans in the project. Returns plans sorted by most recently modified.",
		promptSnippet: "List available plans to find one to activate",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const plans = listPlans(ctx.cwd);
			runtime.logTool("lion_list_plans", {}, { count: plans.length });
			return {
				content: [
					{
						type: "text" as const,
						text:
							plans.length === 0
								? "No plans found. Create a plan in the `plans/` or `.plans/` directory."
								: [
										`Found ${plans.length} plan(s):`,
										...plans.map((p, i) => `${i + 1}. ${p.slug} (${p.taskCount} tasks) - ${p.displayPath}`),
										"",
										"Activate a plan with: lion_activate_plan({ reference: '<slug-or-path>' })",
									].join("\n"),
					},
				],
				details: { plans },
			};
		},
	});

	runtime.pi.registerTool({
		name: "lion_tasks",
		label: "Lion Tasks",
		description:
			"Delegate one or more tasks to subagents with configurable execution strategy. Prompts must be compact XML briefs with plan/task/file references, not pasted plan content.",
		promptSnippet: "Delegate tasks to subagents with compact XML plan-aware briefs",
		parameters: LionTasksParams,
		async execute(toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await runner.run(ctx, params, {
				threadId: runtime.mainSession.getThread()?.instanceId ?? `main:${ctx.sessionManager.getSessionId()}`,
				toolCallId,
			});
			runtime.logTool("lion_tasks", { strategy: params.strategy, taskCount: params.tasks.length }, result);
			return toToolResult(result);
		},
	});
}

// =============================================================================
// Utilities
// =============================================================================

function toToolResult(response: LionToolResponse) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
		details: response,
	};
}
