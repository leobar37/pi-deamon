import type { DelegationResult } from "../types.js";
import type { LionReviewVerdict } from "./types.js";

export type LionRunStatus =
	| "idle"
	| "executing"
	| "awaiting_orchestrator"
	| "reviewing"
	| "correcting"
	| "approved"
	| "rejected"
	| "failed";

export type LionSubagentRole = "analyzer" | "planner" | "executor" | "reviewer" | "validator";

export interface LionRunSubagent {
	role: LionSubagentRole;
	taskId: string;
	instanceId: string;
	status: DelegationResult["status"];
	summary: string;
	updatedAt: number;
}

export interface LionRun {
	runId: string;
	planSlug: string;
	planPath: string;
	taskId: string;
	taskTitle: string;
	status: LionRunStatus;
	attempts: number;
	maxAttempts: number;
	executorTaskId: string | null;
	reviewerTaskId: string | null;
	executorSummary: string;
	reviewerSummary: string;
	verdict: LionReviewVerdict | null;
	error: string | null;
	subagents: LionRunSubagent[];
	createdAt: number;
	updatedAt: number;
}

export interface LionCore {
	activeRun: LionRun | null;
	runHistory: LionRun[];
}

export function createLionCore(): LionCore {
	return { activeRun: null, runHistory: [] };
}

export function addSyntheticRun(core: LionCore, run: LionRun): void {
	core.runHistory = [...core.runHistory, run].slice(-20);
}
