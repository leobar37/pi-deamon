import type { LionPhase, LionState, LionStrategyName } from "./types.js";

/**
 * Match helper for Lion strategy + phase combinations.
 * Centralizes strategy/phase branching to eliminate scattered if-chains.
 */
export function matchStrategy<T>(
	state: Pick<LionState, "strategy" | "phase">,
	patterns: {
		plan?: (phase: LionPhase) => T;
		simple?: (phase: LionPhase) => T;
		review?: (phase: LionPhase) => T;
		none?: (phase: LionPhase) => T;
		_default?: (strategy: LionStrategyName, phase: LionPhase) => T;
	},
): T {
	const { strategy, phase } = state;
	const handler = patterns[strategy];
	if (handler) return handler(phase);
	if (patterns._default) return patterns._default(strategy, phase);
	throw new Error(`Unhandled Lion strategy: ${strategy}`);
}

/**
 * Match helper for strategy only (ignores phase).
 */
export function matchStrategyOnly<T>(
	strategy: LionStrategyName,
	patterns: {
		plan?: () => T;
		simple?: () => T;
		review?: () => T;
		none?: () => T;
		_default?: () => T;
	},
): T {
	const handler = patterns[strategy];
	if (handler) return handler();
	if (patterns._default) return patterns._default();
	throw new Error(`Unhandled Lion strategy: ${strategy}`);
}

/**
 * Match helper for phase only.
 */
export function matchPhase<T>(
	phase: LionPhase,
	patterns: {
		planning: () => T;
		building: () => T;
	},
): T {
	return phase === "planning" ? patterns.planning() : patterns.building();
}

/**
 * Type guard: true for strategies that do not use durable plans.
 */
export function isNoPlanStrategy(strategy: LionStrategyName): boolean {
	return strategy === "simple" || strategy === "none";
}

/**
 * Type guard: true when the state has an active durable plan or review.
 */
export function hasActivePlan(state: LionState): boolean {
	return state.strategy === "plan" || state.strategy === "review";
}
