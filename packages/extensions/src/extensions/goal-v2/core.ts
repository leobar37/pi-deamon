/**
 * Core algorithm for goal-v2 extension.
 * Pure state management — no prompts, no UI, no ExtensionAPI.
 */

import { randomUUID } from "node:crypto";
import type { Goal, GoalStatus, PersistedGoalState } from "./types.js";
import { cloneGoal, nowSeconds, validateObjective } from "./utils.js";

export interface GoalCore {
	goal: Goal | null;
	activeSinceMs: number | null;
	continuationQueued: boolean;
}

export function createCore(): GoalCore {
	return {
		goal: null,
		activeSinceMs: null,
		continuationQueued: false,
	};
}

export function currentGoalSnapshot(core: GoalCore): Goal | null {
	if (!core.goal) return null;
	const snapshot = cloneGoal(core.goal);
	if (snapshot.status === "active" && core.activeSinceMs !== null) {
		snapshot.timeUsedSeconds += Math.max(0, Math.floor((Date.now() - core.activeSinceMs) / 1000));
	}
	return snapshot;
}

export function accountElapsed(core: GoalCore): boolean {
	if (!core.goal || core.goal.status !== "active" || core.activeSinceMs === null) return false;
	const seconds = Math.max(0, Math.floor((Date.now() - core.activeSinceMs) / 1000));
	if (seconds <= 0) return false;
	core.goal.timeUsedSeconds += seconds;
	core.goal.updatedAt = nowSeconds();
	core.activeSinceMs += seconds * 1000;
	return true;
}

export function setGoal(core: GoalCore, objectiveInput: string): Goal {
	const objective = validateObjective(objectiveInput);
	const ts = nowSeconds();
	core.goal = {
		id: randomUUID(),
		objective,
		status: "active",
		phase: "context_gathering",
		timeUsedSeconds: 0,
		createdAt: ts,
		updatedAt: ts,
	};
	core.activeSinceMs = Date.now();
	core.continuationQueued = false;
	return core.goal;
}

export function setGoalStatus(core: GoalCore, status: GoalStatus): Goal {
	if (!core.goal) {
		throw new Error("cannot update goal because no goal exists");
	}
	if (core.goal.status === "active" && status !== "active") {
		accountElapsed(core);
		core.activeSinceMs = null;
	}
	if (status === "active" && core.goal.status !== "active") {
		core.activeSinceMs = Date.now();
		core.continuationQueued = false;
	}
	core.goal.status = status;
	if (status === "active" && core.goal.phase === "blocked") {
		core.goal.phase = "executing";
		core.goal.blockerReason = undefined;
	}
	if (status === "blocked") {
		core.goal.phase = "blocked";
	}
	if (status === "complete") {
		core.goal.phase = "complete";
	}
	core.goal.updatedAt = nowSeconds();
	return core.goal;
}

export function setGoalPhase(core: GoalCore, phase: Goal["phase"], blockerReason?: string): Goal {
	if (!core.goal) {
		throw new Error("cannot update goal phase because no goal exists");
	}
	if (phase === "blocked") {
		setGoalStatus(core, "blocked");
		core.goal.blockerReason = blockerReason?.trim() || undefined;
	} else {
		core.goal.phase = phase;
		if (core.goal.status === "blocked") {
			core.goal.status = "active";
			core.activeSinceMs = Date.now();
			core.continuationQueued = false;
		}
		core.goal.blockerReason = undefined;
		core.goal.updatedAt = nowSeconds();
	}
	return core.goal;
}

export function clearGoal(core: GoalCore): boolean {
	if (!core.goal) return false;
	if (core.goal.status === "active") accountElapsed(core);
	core.goal = null;
	core.activeSinceMs = null;
	core.continuationQueued = false;
	return true;
}

export function buildPersistedState(core: GoalCore, action: PersistedGoalState["action"]): PersistedGoalState {
	return {
		version: 2,
		action,
		goal: core.goal ? cloneGoal(core.goal) : null,
	};
}

export function restoreFromState(core: GoalCore, state: PersistedGoalState | undefined): void {
	core.goal = state?.goal ? cloneGoal(state.goal) : null;
	core.activeSinceMs = core.goal?.status === "active" ? Date.now() : null;
	core.continuationQueued = false;
}
