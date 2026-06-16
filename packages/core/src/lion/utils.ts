import { randomUUID } from "node:crypto";
import type { LionPlan, LionReviewVerdict, LionState } from "./types.js";

export function parseReviewVerdict(summary: string): LionReviewVerdict {
	const lines = summary
		.split(/\r?\n/)
		.map((line) => line.trim().toLowerCase())
		.filter(Boolean);
	if (lines.includes("lion_review_status: approved")) return "approved";
	if (lines.includes("lion_review_status: rejected")) return "rejected";
	if (lines.some((line) => line.includes("<lion-approve>"))) return "approved";
	if (lines.some((line) => line.includes("<lion-rejected>"))) return "rejected";
	return "unknown";
}

export function formatPlanSummary(plan: LionPlan): string {
	const complete = plan.tasks.filter((task) => task.status === "complete").length;
	const pending = plan.tasks.filter((task) => task.status === "pending").length;
	const blocked = plan.tasks.filter((task) => task.status === "blocked").length;
	const retryable = plan.tasks.filter((task) => task.status === "retryable").length;
	return [
		`Plan: ${plan.slug}`,
		`Kind: ${plan.kind}`,
		`Path: ${plan.rootPath}`,
		`Tasks: ${complete}/${plan.tasks.length} complete, ${pending} pending, ${retryable} retryable, ${blocked} blocked`,
	].join("\n");
}

export function createRunId(): string {
	return `lion-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Normalizes a restored Lion state to ensure inactive sessions use strategy "none".
 * This handles migration from older states where inactive sessions defaulted to "plan".
 */
export function normalizeInactiveStrategy(state: LionState): LionState {
	if (!state.active && state.strategy !== "none") {
		return { ...state, strategy: "none" };
	}
	return state;
}
