import type { ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DelegationResult, SubAgentController } from "@local/pi-subagents";
import { Type } from "typebox";
import { finishRun, type LionRun, recordReviewVerdict, recordSubagentResult, setRunStatus, startRun } from "./core.js";
import type { LionEventBus } from "./events/bus.js";
import { LionEvents } from "./events/defs.js";
import {
	getNextPendingTask,
	loadLionPlan,
	markStructuredTaskComplete,
	readPlanContent,
	resolvePlanReference,
	updateStructuredTaskStatus,
} from "./plans/index.js";
import { buildExecutorPrompt, buildPlanValidationPrompt, buildReviewerPrompt } from "./prompts/index.js";
import {
	finishLionSubagentJob,
	getLionSubagentHealth,
	type LionRuntime,
	queueOrchestratorFeedback,
	releaseRun,
	rememberLionUiContext,
	retainSubagent,
	startLionSubagentJob,
	startLionSubagentUi,
} from "./runtime.js";
import { activatePlan, applyBuildResult, setActiveTask, setLastRun, setMode } from "./state.js";
import { parsePlanValidationVerdict, parseReviewVerdict } from "./strategies/index.js";
import {
	createLionSubAgentController,
	runExecutorDelegation,
	runPlanValidatorDelegation,
	runReviewerDelegation,
} from "./subagents/index.js";
import type { LionBuildResult, LionDelegationAgent, LionPlan, LionPlanValidationResult, LionTask } from "./types.js";
import { renderLionSubagentWidget } from "./ui/subagents-widget.js";
import { createRunId, formatBuildResult, formatPlanSummary } from "./utils.js";

const ActivatePlanParams = Type.Object({
	reference: Type.String({
		description:
			"Natural-language plan reference, slug, relative path, or absolute path. If ambiguous, the tool returns candidate plans for the orchestrator to choose from.",
	}),
});

const PromptSubagentParams = Type.Object({
	task_id: Type.String({
		description: "Retained sub-agent task id returned by lion_start_next_task or lion_start_review.",
	}),
	message: Type.String({ description: "Prompt or follow-up to send to that retained sub-agent." }),
	mode: Type.Optional(
		Type.Union([Type.Literal("prompt"), Type.Literal("follow_up")], {
			description: "Delivery mode. Use follow_up when the sub-agent is still busy; prompt is the default.",
		}),
	),
});

const ValidatePlanParams = Type.Object({
	focus: Type.Optional(
		Type.String({ description: "Optional validation focus for a specific part of the active plan." }),
	),
});

const FinishCurrentTaskParams = Type.Object({
	status: Type.Union([Type.Literal("approved"), Type.Literal("rejected"), Type.Literal("failed")], {
		description: "Final status for the current Lion task run.",
	}),
});

const ReleaseSubagentParams = Type.Object({
	task_id: Type.String({ description: "Retained sub-agent task id to release." }),
});

const SubagentHealthParams = Type.Object({
	task_id: Type.Optional(Type.String({ description: "Optional retained sub-agent task id to inspect." })),
});

const CancelSubagentParams = Type.Object({
	task_id: Type.String({ description: "Running or retained Lion sub-agent task id to cancel." }),
});

export interface LionToolResponse {
	message: string;
	run: LionRun | null;
	result?: LionBuildResult;
	validation?: LionPlanValidationResult;
	plan?: LionPlan;
	subagents?: ReturnType<typeof getLionSubagentHealth>;
	candidates?: Array<{
		slug: string;
		path: string;
		displayPath: string;
		kind: string;
		reason: string;
	}>;
}

export function registerLionTools(runtime: LionRuntime): void {
	runtime.pi.registerTool({
		name: "lion_activate_plan",
		label: "Lion Activate Plan",
		description:
			"Resolve a user plan reference, activate the matching Lion plan, or return candidate plans when the reference is ambiguous. Use this before lion_start_next_task when no plan is active or the user names a plan imprecisely.",
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
		name: "lion_start_next_task",
		label: "Lion Start Next Task",
		description:
			"Start the next pending task from the active Lion plan by launching an executor sub-agent. Returns the executor result to the orchestrator; do not mark the task complete from this tool.",
		promptSnippet: "Start the next Lion plan task through an executor sub-agent and inspect the returned feedback",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const response = await startNextTask(runtime, ctx);
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_prompt_subagent",
		label: "Lion Prompt Sub-agent",
		description:
			"Send another prompt or follow-up to a retained Lion sub-agent before releasing it. Use this when the orchestrator has doubts or needs clarification.",
		promptSnippet: "Prompt a retained Lion sub-agent again before deciding the next delegation",
		parameters: PromptSubagentParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const response = await promptSubagent(runtime, ctx, params.task_id, params.message, params.mode ?? "prompt");
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_start_review",
		label: "Lion Start Review",
		description:
			"Launch a reviewer sub-agent for the active Lion run. The reviewer checks the executor output and returns findings with a Lion approval/rejection tag.",
		promptSnippet: "Review the active Lion task with a reviewer sub-agent",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const response = await startReview(runtime, ctx);
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_get_run",
		label: "Lion Get Run",
		description: "Get the current live Lion run, retained sub-agents, summaries, status, and review verdict.",
		promptSnippet: "Inspect the current Lion run and retained sub-agents",
		parameters: Type.Object({}),
		async execute() {
			return toToolResult({
				message: runtime.core.activeRun ? "Active Lion run." : "No active Lion run.",
				run: runtime.core.activeRun,
				subagents: getLionSubagentHealth(runtime),
			});
		},
	});

	runtime.pi.registerTool({
		name: "lion_subagent_health",
		label: "Lion Sub-agent Health",
		description:
			"Inspect running and recent Lion sub-agents, including status, latest events, current result, and errors.",
		promptSnippet: "Inspect Lion sub-agent health before deciding the next orchestration step",
		parameters: SubagentHealthParams,
		async execute(_toolCallId, params) {
			return toToolResult(getSubagentHealth(runtime, params.task_id));
		},
	});

	runtime.pi.registerTool({
		name: "lion_cancel_subagent",
		label: "Lion Cancel Sub-agent",
		description: "Cancel a running Lion sub-agent by task id.",
		promptSnippet: "Cancel a running Lion sub-agent if it is stuck or no longer needed",
		parameters: CancelSubagentParams,
		async execute(_toolCallId, params) {
			const response = await cancelSubagent(runtime, params.task_id);
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_finish_current_task",
		label: "Lion Finish Current Task",
		description:
			"Finalize only the current Lion task run after the orchestrator decides it is approved, rejected, or failed. This marks checklist state for that task and releases retained sub-agents for that run. Call lion_start_next_task again for the next task.",
		promptSnippet: "Finish the current Lion task run and release retained sub-agents",
		parameters: FinishCurrentTaskParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const response = finishCurrentTaskRun(runtime, ctx, params.status);
			return toToolResult(response);
		},
	});

	runtime.pi.registerTool({
		name: "lion_release_subagent",
		label: "Lion Release Sub-agent",
		description:
			"Release a retained Lion sub-agent when the orchestrator no longer needs to ask it follow-up questions.",
		promptSnippet: "Release a retained Lion sub-agent after its feedback is no longer needed",
		parameters: ReleaseSubagentParams,
		async execute(_toolCallId, params) {
			const retained = runtime.retainedInstances.get(params.task_id);
			if (!retained) throw new Error(`Lion sub-agent ${params.task_id} is not retained.`);
			runtime.retainedInstances.delete(params.task_id);
			const response = {
				message: `Released Lion sub-agent ${params.task_id}.`,
				run: runtime.core.activeRun,
			};
			return toToolResult(response);
		},
	});
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
	runtime.state = activatePlan(runtime.state, plan);
	runtime.persistence.saveState(runtime.state, "activate");
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
	assertNoRunningSubagents(runtime);
	rememberLionUiContext(runtime, ctx);

	const runId = createRunId();
	const bus = runtime.events;
	const plan = loadLionPlan(activePlanPath);
	const task = createPlanValidationTask(plan);
	const prompt = buildPlanValidationPrompt(plan, focus);
	bus.publish(LionEvents.validationStart, {
		runId,
		planSlug: plan.slug,
		planPath: plan.rootPath,
		taskId: task.id,
		focus,
	});
	emitPromptCreated(bus, runId, plan, task, "validator", 1, prompt.length);

	const controller = createController(runtime, ctx, runId, plan, task);
	startLionSubagentUi(runtime, {
		runId,
		taskId: `${plan.slug}-validator-${runId}`,
		role: "validator",
		title: task.title,
	});
	renderLionSubagentWidget(runtime, ctx);
	const validatorTaskId = `${plan.slug}-validator-${runId}`;
	startLionSubagentJob(runtime, { runId, taskId: validatorTaskId, role: "validator", title: task.title });
	void runPlanValidatorDelegation({ controller, bus, runId, plan, prompt })
		.then((delegation) => {
			finishLionSubagentJob(runtime, delegation.result.taskId, delegation.result);
			const verdict = parsePlanValidationVerdict(delegation.summary);
			const validation: LionPlanValidationResult = {
				verdict,
				status: delegation.status,
				summary: delegation.summary,
				taskId: delegation.result.taskId,
			};
			retainSubagent(runtime, { runId, role: "validator", taskId: delegation.result.taskId });
			bus.publish(LionEvents.validationEnd, {
				runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				taskId: delegation.result.taskId,
				status: delegation.status,
				summary: delegation.summary,
			});
			bus.publish(LionEvents.validationVerdict, {
				runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				taskId: delegation.result.taskId,
				verdict,
				summary: delegation.summary,
			});
			renderLionSubagentWidget(runtime, ctx);
			queueValidationFeedback(runtime, ctx, validation);
		})
		.catch((err: unknown) => {
			const error = err instanceof Error ? err.message : String(err);
			finishLionSubagentJob(runtime, validatorTaskId, null, error);
			renderLionSubagentWidget(runtime, ctx);
		});
	renderLionSubagentWidget(runtime, ctx);

	return {
		message: `Lion plan validation started for ${plan.slug}. Use lion_subagent_health to inspect progress.`,
		run: runtime.core.activeRun,
		subagents: getLionSubagentHealth(runtime, validatorTaskId),
	};
}

function queueValidationFeedback(
	runtime: LionRuntime,
	ctx: ExtensionContext,
	validation: LionPlanValidationResult,
): void {
	queueOrchestratorFeedback(
		runtime,
		ctx,
		[
			"Lion validator returned.",
			`Verdict: ${validation.verdict}`,
			`Task id: ${validation.taskId}`,
			"Inspect the summary and decide whether to refine the plan, ask the validator a follow-up, or proceed.",
			"",
			validation.summary,
		].join("\n"),
		{ validation, nextTools: ["lion_prompt_subagent", "lion_validate_plan", "lion_start_next_task"] },
	);
}

export function getSubagentHealth(runtime: LionRuntime, taskId?: string): LionToolResponse {
	const subagents = getLionSubagentHealth(runtime, taskId);
	return {
		message: subagents.length ? "Lion sub-agent health." : "No Lion sub-agents found.",
		run: runtime.core.activeRun,
		subagents,
	};
}

export async function cancelSubagent(runtime: LionRuntime, taskId: string): Promise<LionToolResponse> {
	const job = runtime.subagentJobs.get(taskId);
	if (!job) throw new Error(`Lion sub-agent ${taskId} was not found.`);
	const controller = runtime.controllers.get(job.runId);
	if (!controller) throw new Error(`Lion run ${job.runId} no longer has a live controller.`);
	await controller.cancelInstance(taskId);
	return {
		message: `Cancelled Lion sub-agent ${taskId}.`,
		run: runtime.core.activeRun,
		subagents: getLionSubagentHealth(runtime, taskId),
	};
}

export async function startNextTask(runtime: LionRuntime, ctx: ExtensionContext): Promise<LionToolResponse> {
	const activePlanPath = runtime.state.activePlanPath;
	if (!activePlanPath)
		throw new Error("Lion requires an active plan. Run /lion-activate or lion_activate_plan first.");
	assertNoRunningSubagents(runtime);
	if (runtime.core.activeRun) {
		throw new Error(
			`Lion already has an active task run for ${runtime.core.activeRun.taskId}. Inspect it with lion_get_run, then call lion_start_review or lion_finish_current_task before starting the next task.`,
		);
	}
	rememberLionUiContext(runtime, ctx);

	const runId = createRunId();
	const bus = runtime.events;
	const plan = loadLionPlan(activePlanPath);
	const task = getNextPendingTask(plan);
	if (!task) {
		return { message: `No pending unblocked tasks in ${plan.slug}.`, run: runtime.core.activeRun };
	}

	runtime.state = setLastRun(setMode(setActiveTask(runtime.state, task.id), "building"), runId);
	runtime.persistence.saveState(runtime.state, "build");
	updateStructuredTaskStatus(plan, task.id, "in_progress");

	const startedRun = startRun(runtime.core, { runId, plan, task, maxAttempts: runtime.state.maxAttempts });
	runtime.persistence.saveCore(runtime.core, "start");
	emitBuildStart(bus, runId, plan, task);

	const content = readPlanContent(plan, task);
	const controller = createController(runtime, ctx, runId, plan, task);
	const prompt = buildExecutorPrompt(plan, task, content);
	emitPromptCreated(bus, runId, plan, task, "executor", startedRun.attempts || 1, prompt.length);
	const executorTaskId = `${task.id}-executor-1`;
	startLionSubagentJob(runtime, { runId, taskId: executorTaskId, role: "executor", title: task.title });
	startLionSubagentUi(runtime, { runId, taskId: executorTaskId, role: "executor", title: task.title });
	renderLionSubagentWidget(runtime, ctx);
	void runExecutorDelegation({
		controller,
		emit: (event) => bus.emit(event),
		runId,
		plan,
		task,
		attempt: 1,
		prompt,
	})
		.then((delegation) => {
			finishLionSubagentJob(runtime, delegation.result.taskId, delegation.result);
			const run = recordSubagentResult(runtime.core, "executor", delegation.result);
			retainSubagent(runtime, { runId, role: "executor", taskId: delegation.result.taskId });
			runtime.persistence.saveCore(runtime.core, "record");
			renderLionSubagentWidget(runtime, ctx);
			queueOrchestratorFeedback(
				runtime,
				ctx,
				[
					"Lion executor returned.",
					`Task: ${task.id}`,
					`Sub-agent task id: ${delegation.result.taskId}`,
					"Inspect the result and decide whether to prompt the same sub-agent again, start review, or fail the task.",
					"",
					delegation.summary,
				].join("\n"),
				{
					run,
					result: delegation.result,
					nextTools: ["lion_prompt_subagent", "lion_start_review", "lion_get_run"],
				},
			);
		})
		.catch((err: unknown) => {
			const error = err instanceof Error ? err.message : String(err);
			finishLionSubagentJob(runtime, executorTaskId, null, error);
			setRunStatus(runtime.core, "failed");
			runtime.persistence.saveCore(runtime.core, "record");
			renderLionSubagentWidget(runtime, ctx);
			queueOrchestratorFeedback(runtime, ctx, `Lion executor failed for ${task.id}.\n\n${error}`, {
				runId,
				taskId: task.id,
				error,
				nextTools: ["lion_get_run", "lion_finish_current_task"],
			});
		});

	return {
		message: `Executor started for ${task.id}. Use lion_subagent_health or lion_get_run to inspect progress.`,
		run: startedRun,
		subagents: getLionSubagentHealth(runtime, executorTaskId),
	};
}

export async function promptSubagent(
	runtime: LionRuntime,
	_ctx: ExtensionContext,
	taskId: string,
	message: string,
	mode: "prompt" | "follow_up",
): Promise<LionToolResponse> {
	const retained = runtime.retainedInstances.get(taskId);
	if (!retained) throw new Error(`Lion sub-agent ${taskId} is not retained or has already been released.`);
	const controller = runtime.controllers.get(retained.runId);
	if (!controller) throw new Error(`Lion run ${retained.runId} no longer has a live controller.`);

	const resultPromise = waitForTaskEnd(controller, taskId);
	if (mode === "follow_up") {
		await controller.instanceFollowUp(taskId, message);
	} else {
		await controller.promptInstance(taskId, message);
	}
	const result = await resultPromise;
	if (retained.role === "validator") {
		return {
			message: `Validator sub-agent ${taskId} returned feedback.\n\n${result.summary}`,
			run: runtime.core.activeRun,
		};
	}
	const run = recordSubagentResult(runtime.core, retained.role, result);
	runtime.persistence.saveCore(runtime.core, "record");

	return { message: `Sub-agent ${taskId} returned feedback.`, run };
}

export async function startReview(runtime: LionRuntime, ctx: ExtensionContext): Promise<LionToolResponse> {
	const activeRun = runtime.core.activeRun;
	if (!activeRun) throw new Error("Lion has no active run to review.");
	assertNoRunningSubagents(runtime);
	const controller = runtime.controllers.get(activeRun.runId);
	if (!controller) throw new Error(`Lion run ${activeRun.runId} no longer has a live controller.`);
	const plan = loadLionPlan(activeRun.planPath);
	const task = findTask(plan, activeRun.taskId);
	const content = readPlanContent(plan, task);
	const bus = runtime.events;
	rememberLionUiContext(runtime, ctx);
	setRunStatus(runtime.core, "reviewing");
	runtime.persistence.saveCore(runtime.core, "record");

	const prompt = buildReviewerPrompt(plan, task, content, activeRun.executorSummary);
	emitPromptCreated(bus, activeRun.runId, plan, task, "reviewer", activeRun.attempts, prompt.length);
	const reviewerTaskId = `${task.id}-reviewer-${Math.max(activeRun.attempts, 1)}`;
	startLionSubagentJob(runtime, {
		runId: activeRun.runId,
		taskId: reviewerTaskId,
		role: "reviewer",
		title: task.title,
	});
	startLionSubagentUi(runtime, {
		runId: activeRun.runId,
		taskId: reviewerTaskId,
		role: "reviewer",
		title: task.title,
	});
	renderLionSubagentWidget(runtime, ctx);
	void runReviewerDelegation({
		controller,
		emit: (event) => bus.emit(event),
		runId: activeRun.runId,
		plan,
		task,
		attempt: Math.max(activeRun.attempts, 1),
		prompt,
	})
		.then((delegation) => {
			finishLionSubagentJob(runtime, delegation.result.taskId, delegation.result);
			recordSubagentResult(runtime.core, "reviewer", delegation.result);
			const verdict = parseReviewVerdict(delegation.summary);
			const run = recordReviewVerdict(runtime.core, verdict, delegation.summary);
			retainSubagent(runtime, { runId: activeRun.runId, role: "reviewer", taskId: delegation.result.taskId });
			runtime.persistence.saveCore(runtime.core, "record");
			renderLionSubagentWidget(runtime, ctx);
			bus.publish(LionEvents.reviewVerdict, {
				runId: activeRun.runId,
				planSlug: plan.slug,
				planPath: plan.rootPath,
				taskId: task.id,
				attempt: activeRun.attempts,
				verdict,
				summary: delegation.summary,
			});
			queueOrchestratorFeedback(
				runtime,
				ctx,
				[
					"Lion reviewer returned.",
					`Task: ${task.id}`,
					`Verdict: ${verdict}`,
					`Sub-agent task id: ${delegation.result.taskId}`,
					"Decide whether to finish the current task, ask follow-up questions, or prompt the executor again.",
					"",
					delegation.summary,
				].join("\n"),
				{
					run,
					result: delegation.result,
					verdict,
					nextTools: ["lion_finish_current_task", "lion_prompt_subagent", "lion_get_run"],
				},
			);
		})
		.catch((err: unknown) => {
			const error = err instanceof Error ? err.message : String(err);
			finishLionSubagentJob(runtime, reviewerTaskId, null, error);
			setRunStatus(runtime.core, "failed");
			runtime.persistence.saveCore(runtime.core, "record");
			renderLionSubagentWidget(runtime, ctx);
			queueOrchestratorFeedback(runtime, ctx, `Lion reviewer failed for ${task.id}.\n\n${error}`, {
				runId: activeRun.runId,
				taskId: task.id,
				error,
				nextTools: ["lion_get_run", "lion_finish_current_task"],
			});
		});

	return {
		message: `Reviewer started for ${task.id}. Use lion_subagent_health or lion_get_run to inspect progress.`,
		run: runtime.core.activeRun,
		subagents: getLionSubagentHealth(runtime, reviewerTaskId),
	};
}

export function finishCurrentTaskRun(
	runtime: LionRuntime,
	ctx: ExtensionCommandContext | ExtensionContext,
	status: "approved" | "rejected" | "failed",
): LionToolResponse {
	const activeRun = runtime.core.activeRun;
	if (!activeRun) throw new Error("Lion has no active task run to finish.");
	if (status === "approved" && activeRun.verdict !== "approved") {
		throw new Error("Lion cannot approve the current task before lion_start_review returns <LION-APPROVE>.");
	}
	const plan = loadLionPlan(activeRun.planPath);
	const bus = runtime.events;
	if (status === "approved") {
		bus.publish(LionEvents.taskApproved, {
			runId: activeRun.runId,
			planSlug: activeRun.planSlug,
			planPath: activeRun.planPath,
			taskId: activeRun.taskId,
		});
		markStructuredTaskComplete(plan, activeRun.taskId);
		bus.publish(LionEvents.taskMarkedComplete, {
			runId: activeRun.runId,
			planSlug: activeRun.planSlug,
			planPath: activeRun.planPath,
			taskId: activeRun.taskId,
		});
	} else {
		updateStructuredTaskStatus(plan, activeRun.taskId, "blocked");
		bus.publish(LionEvents.taskRejected, {
			runId: activeRun.runId,
			planSlug: activeRun.planSlug,
			planPath: activeRun.planPath,
			taskId: activeRun.taskId,
			reason: activeRun.error ?? `Task finished with ${status}.`,
		});
	}
	const result = finishRun(runtime.core, status);
	if (status === "failed") {
		bus.publish(LionEvents.buildFailed, {
			runId: activeRun.runId,
			planSlug: activeRun.planSlug,
			planPath: activeRun.planPath,
			taskId: activeRun.taskId,
			error: result.error ?? "Lion task run failed.",
		});
	} else {
		bus.publish(LionEvents.buildComplete, {
			runId: activeRun.runId,
			planSlug: activeRun.planSlug,
			planPath: activeRun.planPath,
			taskId: activeRun.taskId,
			attempt: activeRun.attempts,
			result,
		});
	}
	runtime.state = applyBuildResult(runtime.state, result);
	runtime.persistence.saveState(runtime.state, "build");
	runtime.persistence.saveCore(runtime.core, "finish");
	releaseRun(runtime, activeRun.runId);
	if ("ui" in ctx) {
		ctx.ui.setStatus("lion", undefined);
	}
	return {
		message: `Lion current task run finished.\n\n${formatBuildResult(result)}`,
		run: runtime.core.activeRun,
		result,
	};
}
function createController(
	runtime: LionRuntime,
	ctx: ExtensionContext,
	runId: string,
	plan: LionPlan,
	task: LionTask,
): SubAgentController {
	const controller = createLionSubAgentController({
		ctx: ctx as import("@earendil-works/pi-coding-agent").ExtensionCommandContext,
		emit: (event) => runtime.events.emit(event),
		runId,
		plan,
		task,
	});
	runtime.controllers.set(runId, controller);
	runtime.activeController = controller;
	runtime.activeRunId = runId;
	if (runtime.dashboard) {
		runtime.dashboard.bridge(controller.getEventBus(), "subagent");
	}
	return controller;
}

function assertNoRunningSubagents(runtime: LionRuntime): void {
	const running = getLionSubagentHealth(runtime).filter(
		(subagent) => subagent.status === "queued" || subagent.status === "running",
	);
	if (!running.length) return;
	const summary = running.map((subagent) => `${subagent.taskId} (${subagent.role}, ${subagent.status})`).join(", ");
	throw new Error(
		`Lion already has a running sub-agent: ${summary}. Wait for it to finish, inspect it with lion_subagent_health, or cancel it with lion_cancel_subagent before launching another delegation.`,
	);
}

function waitForTaskEnd(controller: SubAgentController, taskId: string): Promise<DelegationResult> {
	return new Promise((resolve) => {
		const unsubscribe = controller.getEventBus().on("task.end", (event) => {
			if (event.taskId !== taskId) return;
			unsubscribe();
			resolve(event.result);
		});
	});
}

function emitBuildStart(bus: LionEventBus, runId: string, plan: LionPlan, task: LionTask): void {
	bus.publish(LionEvents.buildStart, { runId, planSlug: plan.slug, planPath: plan.rootPath });
	bus.publish(LionEvents.taskSelected, {
		runId,
		planSlug: plan.slug,
		planPath: plan.rootPath,
		taskId: task.id,
		title: task.title,
	});
}

function emitPromptCreated(
	bus: LionEventBus,
	runId: string,
	plan: LionPlan,
	task: LionTask,
	agent: LionDelegationAgent,
	attempt: number,
	promptLength: number,
): void {
	bus.publish(LionEvents.delegationPromptCreated, {
		runId,
		planSlug: plan.slug,
		planPath: plan.rootPath,
		taskId: task.id,
		attempt,
		agent,
		promptLength,
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

function findTask(plan: LionPlan, taskId: string): LionTask {
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
