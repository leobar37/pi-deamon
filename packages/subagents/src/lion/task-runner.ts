import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TaskExecutionResult } from "../task-executor.js";
import { TaskExecutor } from "../task-executor.js";
import type { ExecutionPlan, SubAgentCapabilities } from "../types.js";
import { LionEvents } from "./events/defs.js";
import { classifyLionTaskResult } from "./evidence.js";
import { loadLionPlan } from "./plans/index.js";
import type { LionRuntime } from "./runtime.js";
import type { LionToolResponse } from "./tools.js";
import type { LionTask, LionTaskResult, LionTaskStrategy, LionTasksResult } from "./types.js";
import { renderLionSubagentWidget } from "./ui/subagents-widget.js";
import { createRunId } from "./utils.js";

export interface RunTasksParams {
	tasks: Array<{
		definition: string;
		title: string;
		prompt: string;
		capabilities?: Partial<SubAgentCapabilities>;
		skillPaths?: string[];
	}>;
	strategy?: LionTaskStrategy;
	concurrency?: number;
	chainOptions?: {
		passOutputToNext?: boolean;
		outputMode?: "append" | "replace" | "template";
		template?: string;
		stopOnFailure?: boolean;
	};
}

export interface RunTasksParent {
	threadId: string;
	toolCallId?: string;
}

export class TaskRunner {
	constructor(private runtime: LionRuntime) {}

	async run(ctx: ExtensionContext, params: RunTasksParams, parent: RunTasksParent): Promise<LionToolResponse> {
		if (!params.tasks || params.tasks.length === 0) {
			throw new Error(
				"lion_tasks requires at least one task. Provide tasks array with definitions, titles, and prompts.",
			);
		}

		const { runtime } = this;
		const activePlanPath = runtime.state.activePlanPath;
		const plan = activePlanPath ? loadLionPlan(activePlanPath) : null;
		runtime.rememberUiContext(ctx);

		const runId = createRunId();
		const bus = runtime.events;
		const taskConfigs = params.tasks.map((task) => this.withPlanContext(task, plan));
		const strategy = params.strategy ?? "sequential";

		const batchTask: LionTask = {
			id: `tasks-${runId}`,
			title: `Batch ${strategy}: ${taskConfigs.length} tasks`,
			file: "",
			status: "pending",
			dependencies: [],
			requirements: [],
		};

		const controller = runtime.ensureController(ctx);

		for (let i = 0; i < taskConfigs.length; i++) {
			const taskId = `${runId}-task-${i}`;
			runtime.startJob({ runId, taskId, role: "executor", title: taskConfigs[i].title });
			runtime.startSubagentUi({ runId, taskId, role: "executor", title: taskConfigs[i].title });
		}
		renderLionSubagentWidget(runtime, ctx);

		const executor = new TaskExecutor({
			controller,
			onEvent: (event) => {
				runtime.recordSubagentUiEvent(event);
				if (!plan) return;
				bus.emit(
					LionEvents.subagentEvent({
						runId,
						planSlug: plan.slug,
						planPath: plan.rootPath,
						taskId: batchTask.id,
						subagentEvent: event,
					}),
				);
			},
		});

		const executionPlan: ExecutionPlan = {
			strategy,
			tasks: taskConfigs.map((t, i) => ({
				id: `${runId}-task-${i}`,
				definition: t.definition,
				parentThreadId: parent.threadId,
				parentToolCallId: parent.toolCallId,
				runId,
				runIndex: i,
				description: t.title,
				prompt: t.prompt,
				capabilities: t.capabilities,
				skillPaths: t.skillPaths,
			})),
			concurrency: params.concurrency,
			chainOptions: params.chainOptions,
		};

		this.publishStartEvents(bus, plan, runId, strategy, taskConfigs, params.concurrency);

		let result: TaskExecutionResult;
		try {
			result = await executor.execute(executionPlan);
		} catch (err: unknown) {
			const error = err instanceof Error ? err.message : String(err);
			this.handleExecutionError(runId, taskConfigs, plan, error);
			renderLionSubagentWidget(runtime, ctx);
			return { run: runtime.core.activeRun };
		}

		this.publishEndEvents(runtime, plan, runId, taskConfigs, result);
		renderLionSubagentWidget(runtime, ctx);

		return {
			run: runtime.core.activeRun,
			tasks: this.buildTaskResults(result, taskConfigs),
		};
	}

	private withPlanContext(
		taskConfig: RunTasksParams["tasks"][number],
		plan: NonNullable<ReturnType<typeof loadLionPlan>> | null,
	): RunTasksParams["tasks"][number] {
		if (!plan || taskConfig.prompt.includes("<lion_context>")) return taskConfig;

		const taskId = inferPlanTaskId(taskConfig.title, taskConfig.prompt);
		const planTask = taskId ? plan.tasks.find((task) => task.id === taskId) : undefined;
		const taskFile = planTask?.file ? joinPlanPath(plan.rootPath, planTask.file) : undefined;
		const context = [
			"<lion_context>",
			`  <plan slug="${escapeXml(plan.slug)}" path="${escapeXml(plan.rootPath)}" />`,
			taskId
				? `  <task id="${escapeXml(taskId)}"${taskFile ? ` file="${escapeXml(taskFile)}"` : ""}${planTask?.title ? ` title="${escapeXml(planTask.title)}"` : ""} />`
				: '  <task unknown="true" />',
			"  <instructions>",
			"    <must>Use the referenced plan and task file as source of truth before changing code.</must>",
			"    <must>Use any relevant loaded skill for this domain or package before implementing.</must>",
			"    <must_not>Treat this brief as complete if it conflicts with the plan task file.</must_not>",
			"  </instructions>",
			"</lion_context>",
		].join("\n");

		return {
			...taskConfig,
			prompt: `${context}\n\n${taskConfig.prompt}`,
		};
	}

	private publishStartEvents(
		bus: LionRuntime["events"],
		plan: NonNullable<ReturnType<typeof loadLionPlan>> | null,
		runId: string,
		strategy: LionTaskStrategy,
		taskConfigs: RunTasksParams["tasks"],
		concurrency?: number,
	): void {
		if (!plan) return;
		bus.emit(
			LionEvents.tasksStart({
				runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				strategy,
				taskCount: taskConfigs.length,
				concurrency,
			}),
		);
		for (let i = 0; i < taskConfigs.length; i++) {
			bus.emit(
				LionEvents.tasksTaskStart({
					runId,
					planSlug: plan.slug,
					planPath: plan.rootPath,
					index: i,
					title: taskConfigs[i].title,
					definition: taskConfigs[i].definition,
				}),
			);
		}
	}

	private handleExecutionError(
		runId: string,
		taskConfigs: RunTasksParams["tasks"],
		plan: NonNullable<ReturnType<typeof loadLionPlan>> | null,
		error: string,
	): void {
		for (let i = 0; i < taskConfigs.length; i++) {
			const taskId = `${runId}-task-${i}`;
			this.runtime.finishJob(taskId, null, error);
			if (!plan) continue;
			this.runtime.events.emit(
				LionEvents.tasksTaskEnd({
					runId,
					planSlug: plan.slug,
					planPath: plan.rootPath,
					index: i,
					title: taskConfigs[i].title,
					definition: taskConfigs[i].definition,
					status: "failed",
					summary: error,
				}),
			);
		}
	}

	private publishEndEvents(
		runtime: LionRuntime,
		plan: NonNullable<ReturnType<typeof loadLionPlan>> | null,
		runId: string,
		taskConfigs: RunTasksParams["tasks"],
		result: TaskExecutionResult,
	): void {
		for (let i = 0; i < result.results.length; i++) {
			const taskResult = result.results[i];
			runtime.finishJob(taskResult.taskId, taskResult, taskResult.error);
			if (!plan) continue;
			runtime.events.emit(
				LionEvents.tasksTaskEnd({
					runId,
					planSlug: plan.slug,
					planPath: plan.rootPath,
					index: i,
					title: taskConfigs[i].title,
					definition: taskConfigs[i].definition,
					status: taskResult.status,
					summary: taskResult.summary,
				}),
			);
		}
		if (!plan) return;
		const lionResult = this.buildLionResult(runId, paramsStrategy(result), result, taskConfigs);
		runtime.events.emit(
			LionEvents.tasksComplete({
				runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				result: lionResult,
			}),
		);
	}

	private buildTaskResults(result: TaskExecutionResult, taskConfigs: RunTasksParams["tasks"]): LionTaskResult[] {
		return result.results.map((r, i) => {
			const classification = classifyLionTaskResult(r);
			return {
				taskId: r.taskId,
				title: taskConfigs[i].title,
				definition: taskConfigs[i].definition,
				status: r.status,
				verificationStatus: classification.verificationStatus,
				evidence: classification.evidence,
				summary: r.summary,
				duration: r.duration,
				turnCount: r.turnCount,
				error: r.error,
			};
		});
	}

	private buildLionResult(
		runId: string,
		strategy: LionTaskStrategy,
		result: TaskExecutionResult,
		taskConfigs: RunTasksParams["tasks"],
	): LionTasksResult {
		return {
			runId,
			strategy,
			tasks: this.buildTaskResults(result, taskConfigs),
			completedCount: result.results.filter((r) => r.status === "completed").length,
			failedCount: result.results.filter((r) => r.status === "failed").length,
			completedAt: result.completedAt,
		};
	}
}

function paramsStrategy(result: TaskExecutionResult): LionTaskStrategy {
	return result.plan.strategy as LionTaskStrategy;
}

function inferPlanTaskId(...values: string[]): string | null {
	for (const value of values) {
		const match = /\bT-\d{3,}\b/.exec(value);
		if (match) return match[0];
	}
	return null;
}

function joinPlanPath(rootPath: string, taskFile: string): string {
	if (taskFile.startsWith("/") || taskFile.startsWith(".")) return taskFile;
	return `${rootPath.replace(/\/$/, "")}/${taskFile}`;
}

function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
