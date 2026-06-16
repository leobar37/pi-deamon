import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LionPlan, LionTask, LionTaskStatus } from "../types.js";
import { LionChecklistFile } from "./checklist.js";
import { StructuredLionPlanFile } from "./structured.js";

export interface PlanResolution {
	status: "resolved" | "ambiguous" | "not_found";
	planPath: string;
	candidates: Array<{
		slug: string;
		path: string;
		displayPath: string;
		kind: string;
		reason: string;
	}>;
}

export function loadLionPlan(planPath: string): LionPlan {
	if (!existsSync(planPath)) {
		throw new Error(`Plan file not found: ${planPath}`);
	}

	const stats = statSync(planPath);
	if (stats.isDirectory()) {
		return new StructuredLionPlanFile(planPath).loadPlan();
	}
	if (planPath.endsWith("task-index.md")) {
		return new StructuredLionPlanFile(resolve(planPath, "..")).loadPlan();
	}

	const content = readFileSync(planPath, "utf-8");
	const lines = content.split("\n");

	// Simple parsing: first line as slug, rest as tasks
	const slug = lines[0]?.trim() || "unknown";
	const tasks: LionTask[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		const parts = line.split("|");
		tasks.push({
			id: `task-${i}`,
			title: parts[0] || line,
			file: parts[1] || "",
			status: "pending",
			dependencies: parts[2]
				? parts[2]
						.split(",")
						.map((d) => d.trim())
						.filter(Boolean)
				: [],
			requirements: [],
		});
	}

	return {
		kind: "structured",
		slug,
		rootPath: planPath,
		indexFile: planPath,
		tasks,
	};
}

export function resolvePlanPath(cwd: string, input: string): string | null {
	// Try direct path first
	const direct = resolve(cwd, input);
	if (existsSync(direct)) return direct;

	// Try with .md extension
	const withExt = resolve(cwd, `${input}.md`);
	if (existsSync(withExt)) return withExt;

	// Try in plans directory
	const inPlans = resolve(cwd, "plans", input);
	if (existsSync(inPlans)) return inPlans;

	const inPlansExt = resolve(cwd, "plans", `${input}.md`);
	if (existsSync(inPlansExt)) return inPlansExt;

	const inDotPlans = resolve(cwd, ".plans", input);
	if (existsSync(inDotPlans)) return inDotPlans;

	const inDotPlansExt = resolve(cwd, ".plans", `${input}.md`);
	if (existsSync(inDotPlansExt)) return inDotPlansExt;

	return null;
}

export function resolvePlanReference(cwd: string, reference: string): PlanResolution {
	const planPath = resolvePlanPath(cwd, reference);
	if (planPath) {
		return {
			status: "resolved",
			planPath,
			candidates: [],
		};
	}

	// Search for candidate plans
	const candidates = findCandidatePlans(cwd, reference);
	if (candidates.length === 1) {
		return {
			status: "resolved",
			planPath: candidates[0].path,
			candidates: [],
		};
	}

	if (candidates.length > 1) {
		return {
			status: "ambiguous",
			planPath: "",
			candidates,
		};
	}

	return {
		status: "not_found",
		planPath: "",
		candidates: [],
	};
}

function findCandidatePlans(cwd: string, _reference: string): PlanResolution["candidates"] {
	const candidates: PlanResolution["candidates"] = [];
	const plansDir = join(cwd, "plans");

	if (!existsSync(plansDir)) {
		return candidates;
	}

	// Simple matching: check if reference is substring of filename
	// In real implementation, this would scan directory
	return candidates;
}

function updateStructuredTaskStatus(plan: LionPlan, taskId: string, status: LionTaskStatus): void {
	const task = plan.tasks.find((t) => t.id === taskId);
	if (task) {
		task.status = status;
	}
	if (plan.checklistFile && existsSync(plan.checklistFile)) {
		new LionChecklistFile(plan.checklistFile).updateTaskStatus(taskId, status);
		return;
	}
	const checklistFile = join(plan.rootPath, "checklist.json");
	if (existsSync(checklistFile)) {
		new LionChecklistFile(checklistFile).updateTaskStatus(taskId, status);
		return;
	}
	if (plan.kind === "structured" && existsSync(plan.rootPath) && statSync(plan.rootPath).isDirectory()) {
		new StructuredLionPlanFile(plan.rootPath).updateTaskStatus(plan, taskId, status);
	}
}

export function recordStructuredTaskResult(
	plan: LionPlan,
	taskId: string,
	status: LionTaskStatus,
	summary?: string,
): void {
	const task = plan.tasks.find((t) => t.id === taskId);
	if (task) task.status = status;
	const checklistFile = plan.checklistFile ?? join(plan.rootPath, "checklist.json");
	if (existsSync(checklistFile)) {
		new LionChecklistFile(checklistFile).recordTaskResult(taskId, status, summary);
		return;
	}
	if (plan.kind === "structured" && existsSync(plan.rootPath) && statSync(plan.rootPath).isDirectory()) {
		new StructuredLionPlanFile(plan.rootPath).recordTaskResult(plan, taskId, status, summary);
		return;
	}
	updateStructuredTaskStatus(plan, taskId, status);
}

export function getNextExecutableTask(plan: LionPlan): LionTask | null {
	const complete = new Set(plan.tasks.filter((task) => task.status === "complete").map((task) => task.id));
	return (
		plan.tasks.find((task) => {
			if (task.status !== "pending" && task.status !== "retryable") return false;
			return task.dependencies.every((dependency) => complete.has(dependency));
		}) ?? null
	);
}
