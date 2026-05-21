import type { LionPlan } from "../types.js";

export function buildPlanValidationPrompt(plan: LionPlan, focus?: string): string {
	const tasks = plan.tasks
		.map((task) => {
			const deps = task.dependencies.length ? ` deps=${task.dependencies.join(",")}` : "";
			const reqs = task.requirements.length ? ` reqs=${task.requirements.join(",")}` : "";
			return `- ${task.id} [${task.status}] ${task.title} (${task.file})${deps}${reqs}`;
		})
		.join("\n");

	return `Validate the active Lion plan. This is a read-only planning validation task.

Plan:
- slug: ${plan.slug}
- kind: ${plan.kind}
- path: ${plan.rootPath}
- context file: ${plan.contextFile ?? "missing"}
- requirements file: ${plan.requirementsFile ?? "missing"}
- index file: ${plan.indexFile}
- checklist file: ${plan.checklistFile ?? "missing"}

${focus ? `Focus: ${focus}\n\n` : ""}Tasks:
${tasks || "(no tasks)"}

Inspect the plan files and task briefs as needed. Do not edit files.

Validate:
- context, requirements, task index, checklist, and task briefs are coherent
- tasks have clear acceptance criteria and actionable scope
- tasks are agent-sized rather than microtasks; recommend consolidating tiny tasks before build
- dependencies are reasonable
- missing files or incomplete briefs are called out
- risks before implementation are explicit

Start with findings. End with exactly one of these lines:

<LION-PLAN-VALID>
<LION-PLAN-NEEDS-WORK>`;
}
