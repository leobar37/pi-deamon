import type { DelegationResult, DelegationTask, SubAgentController } from "@local/pi-subagents";
import type { LionEventBus } from "../events/bus.js";
import { LionEvents } from "../events/defs.js";
import type { LionDelegationRunResult, LionPlan } from "../types.js";

export async function runPlanValidatorDelegation(options: {
	controller: SubAgentController;
	bus: LionEventBus;
	runId: string;
	plan: LionPlan;
	prompt: string;
}): Promise<LionDelegationRunResult> {
	const taskId = `${options.plan.slug}-validator-${options.runId}`;
	const task: DelegationTask = {
		id: taskId,
		definition: "analyzer",
		description: `Validate Lion plan ${options.plan.slug}`,
		prompt: options.prompt,
		systemPromptMode: "append",
		capabilities: { canEdit: false, canWrite: false, canExecute: false, canResearch: true },
		disabledTools: ["edit", "write", "multi-edit"],
	};
	options.bus.publish(LionEvents.delegationStart, {
		runId: options.runId,
		planSlug: options.plan.slug,
		planPath: options.plan.rootPath,
		taskId,
		attempt: 1,
		agent: "validator",
	});
	const result: DelegationResult = await options.controller.executeTask(task);
	options.bus.publish(LionEvents.delegationEnd, {
		runId: options.runId,
		planSlug: options.plan.slug,
		planPath: options.plan.rootPath,
		taskId,
		attempt: 1,
		agent: "validator",
		status: result.status,
		summary: result.summary,
	});
	return { result, summary: result.summary, status: result.status };
}
