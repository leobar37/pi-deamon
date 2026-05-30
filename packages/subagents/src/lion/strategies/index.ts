import { PlanLionStrategy } from "./plan.js";
import { SimpleLionStrategy } from "./simple.js";
import type { LionStrategy } from "./types.js";

const PLAN_STRATEGY = new PlanLionStrategy();
const SIMPLE_STRATEGY = new SimpleLionStrategy();

export function getLionStrategy(name: LionStrategy["name"]): LionStrategy {
	return name === "simple" ? SIMPLE_STRATEGY : PLAN_STRATEGY;
}

export type { LionStrategy } from "./types.js";
