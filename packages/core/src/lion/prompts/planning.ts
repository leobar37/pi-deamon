import { getLionStrategy } from "../strategies/index.js";
import type { LionState } from "../types.js";

export function buildPlanningSystemPrompt(state: LionState): string {
	return getLionStrategy(state.strategy).buildMainPrompt(state);
}
