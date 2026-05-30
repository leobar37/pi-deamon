import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TaskExecutionResult } from "../task-executor.js";
import { TaskExecutor } from "../task-executor.js";
import type { ExecutionPlan, SubAgentCapabilities } from "../types.js";
import { LionEvents } from "./events/defs.js";
import { classifyLionTaskResult } from "./evidence.js";
import { loadLionPlan } from "./plans/index.js";
import type { LionRuntime } from "./runtime.js";
import { getLionStrategy } from "./strategies/index.js";
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
		const taskConfigs = params.tasks.map((task) =>
			getLionStrategy(runtime.state.strategy).decorateTaskPrompt(task, { plan }),
		);
		const strategy = params.strategy ?? "sequential";

		// Initialize structured run logger for this batch
		const cwd = ctx.cwd ?? ctx.sessionManager.getCwd();
		const runLogger = runtime.initRunLogger(cwd, runId);
		runLogger.startRun({
			planSlug: plan?.slug ?? runtime.state.activePlanSlug,
			planPath: plan?.rootPath ?? runtime.state.activePlanPath,
			tasksTotal: taskConfigs.length,
		});

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
				// Log full subagent events to structured run logger (per-task file)
				if ("taskId" in event) {
					runtime.runLogger?.logSubagent(event.taskId, {
						type: "event",
						source: "subagent",
						data: event,
					});
				}
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
				orchestration: {
					strategy: runtime.state.strategy,
					...(plan ? { planSlug: plan.slug, planPath: plan.rootPath } : {}),
				},
			})),
			concurrency: params.concurrency,
			chainOptions: params.chainOptions,
		};

		this.publishStartEvents(bus, plan, runId, strategy, taskConfigs, params.concurrency);

		let result: TaskExecutionResult;
		try {
			const guardResult = runtime.delegationGuard.handleToolCall({
				toolName: "lion_tasks",
				toolCallId: `guard-${runId}`,
				input: {},
			} as unknown as import("@earendil-works/pi-coding-agent").ToolCallEvent);
			if (guardResult?.block) {
				throw new Error(guardResult.reason ?? "Delegation blocked by guard");
			}
			result = await executor.execute(executionPlan);
		} catch (err: unknown) {
			const error = err instanceof Error ? err.message : String(err);
			this.handleExecutionError(runId, taskConfigs, plan, error);
			renderLionSubagentWidget(runtime, ctx);
			runtime.completeRun("failed", error);
			const failedResult: TaskExecutionResult = {
				plan: executionPlan,
				results: taskConfigs.map((t, i) => ({
					taskId: `${runId}-task-${i}`,
					agent: t.definition,
					status: "failed" as const,
					summary: error,
					duration: 0,
					turnCount: 0,
					finalState: {
						instanceId: `subagent-${runId}-task-${i}-failed`,
						taskId: `${runId}-task-${i}`,
						definitionName: t.definition,
						state: "failed" as const,
						startTime: null,
						endTime: Date.now(),
						turnCount: 0,
						lastActivityAt: Date.now(),
						currentTool: null,
						error,
						toolCount: 0,
						currentToolStartedAt: null,
						durationMs: 0,
					},
				})),
				completedAt: Date.now(),
			};
			const run =
				runtime.core.activeRun ?? this.buildSyntheticRun(runId, strategy, batchTask, failedResult, taskConfigs);
			return { run, tasks: this.buildTaskResults(failedResult, taskConfigs) };
		} finally {
			runtime.delegationGuard.releaseDepth("main");
		}

		this.publishEndEvents(runtime, plan, runId, strategy, taskConfigs, result);
		renderLionSubagentWidget(runtime, ctx);

		// Mark run as completed in structured logger
		const allCompleted = result.results.every((r) => r.status === "completed");
		const anyFailed = result.results.some((r) => r.status === "failed");
		if (allCompleted) {
			runtime.completeRun("completed");
		} else if (anyFailed) {
			runtime.completeRun("failed", `${result.results.filter((r) => r.status === "failed").length} task(s) failed`);
		} else {
			runtime.completeRun("completed");
		}

		const run = runtime.core.activeRun ?? this.buildSyntheticRun(runId, strategy, batchTask, result, taskConfigs);

		// Persist synthetic run to core history for simple mode
		if (!runtime.core.activeRun) {
			const { addSyntheticRun } = await import("./core.js");
			addSyntheticRun(runtime.core, run);
		}

		return {
			run,
			tasks: this.buildTaskResults(result, taskConfigs),
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
		bus.emit(
			LionEvents.tasksStart({
				runId,
				planSlug: plan?.slug ?? "",
				planPath: plan?.rootPath ?? "",
				strategy,
				taskCount: taskConfigs.length,
				concurrency,
			}),
		);
		for (let i = 0; i < taskConfigs.length; i++) {
			bus.emit(
				LionEvents.tasksTaskStart({
					runId,
					planSlug: plan?.slug ?? "",
					planPath: plan?.rootPath ?? "",
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
			this.runtime.subagentUi.delete(taskId);
			this.runtime.events.emit(
				LionEvents.tasksTaskEnd({
					runId,
					planSlug: plan?.slug ?? "",
					planPath: plan?.rootPath ?? "",
					index: i,
					title: taskConfigs[i].title,
					definition: taskConfigs[i].definition,
					status: "failed",
					summary: error,
				}),
			);
		}
		this.runtime.cleanupSubagentUi(Date.now(), 5000);
		renderLionSubagentWidget(this.runtime, this.runtime.lastUiContext ?? undefined);
	}

	private publishEndEvents(
		runtime: LionRuntime,
		plan: NonNullable<ReturnType<typeof loadLionPlan>> | null,
		runId: string,
		strategy: LionTaskStrategy,
		taskConfigs: RunTasksParams["tasks"],
		result: TaskExecutionResult,
	): void {
		for (let i = 0; i < result.results.length; i++) {
			const taskResult = result.results[i];
			runtime.finishJob(taskResult.taskId, taskResult, taskResult.error);
			runtime.events.emit(
				LionEvents.tasksTaskEnd({
					runId,
					planSlug: plan?.slug ?? "",
					planPath: plan?.rootPath ?? "",
					index: i,
					title: taskConfigs[i].title,
					definition: taskConfigs[i].definition,
					status: taskResult.status,
					summary: taskResult.summary,
				}),
			);
		}
		const lionResult = this.buildLionResult(runId, strategy, result, taskConfigs);
		runtime.events.emit(
			LionEvents.tasksComplete({
				runId,
				planSlug: plan?.slug ?? "",
				planPath: plan?.rootPath ?? "",
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

	private buildSyntheticRun(
		runId: string,
		_strategy: LionTaskStrategy,
		batchTask: LionTask,
		result: TaskExecutionResult,
		taskConfigs?: RunTasksParams["tasks"],
	): import("./core.js").LionRun {
		const allCompleted = result.results.every((r) => r.status === "completed");
		const anyFailed = result.results.some((r) => r.status === "failed");
		const now = Date.now();
		return {
			runId,
			planSlug: "",
			planPath: "",
			taskId: batchTask.id,
			taskTitle: batchTask.title,
			status: allCompleted ? "approved" : anyFailed ? "failed" : "awaiting_orchestrator",
			attempts: 1,
			maxAttempts: 1,
			executorTaskId: null,
			reviewerTaskId: null,
			executorSummary: "",
			reviewerSummary: "",
			verdict: null,
			error: anyFailed ? `${result.results.filter((r) => r.status === "failed").length} task(s) failed` : null,
			subagents: result.results.map((r, i) => {
				const definition = taskConfigs?.[i]?.definition ?? "";
				const role = this.inferRoleFromDefinition(definition);
				return {
					role,
					taskId: r.taskId,
					instanceId: r.finalState.instanceId,
					status: r.status,
					summary: r.summary,
					updatedAt: now,
				};
			}),
			createdAt: now,
			updatedAt: now,
		};
	}

	private inferRoleFromDefinition(definition: string): import("./core.js").LionSubagentRole {
		switch (definition) {
			case "reviewer":
				return "reviewer";
			case "validator":
				return "validator";
			default:
				return "executor";
		}
	}
}
