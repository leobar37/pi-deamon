import type { LionDashboardState } from "../types.ts";

interface LionModeBadgeProps {
	state?: LionDashboardState;
}

export function formatLionModeLabel(state?: LionDashboardState): string | null {
	if (!state || !isLionUiActive(state)) return null;
	const activeState = state;
	const mode = activeState.strategy === "simple" ? "Simple mode" : activeState.strategy === "review" ? "Review mode" : "Plan mode";
	const phase = activeState.phase === "building" ? "Building" : "Planning";
	const detail = activeState.strategy === "simple" ? null : activeState.activeTaskId ?? activeState.activePlanSlug;
	return [mode, phase, detail].filter(Boolean).join(" · ");
}

export function isLionUiActive(state?: LionDashboardState): boolean {
	if (!state?.active) return false;
	if (state.strategy === "simple") return true;
	return Boolean(state.activePlanPath ?? state.activePlanSlug ?? state.activeTaskId ?? state.lastRunId);
}

export function LionModeBadge({ state }: LionModeBadgeProps) {
	const label = formatLionModeLabel(state);
	if (!label) return null;

	return (
		<span
			className="min-w-0 truncate rounded border border-border-subtle bg-bg px-2 py-1 text-xs text-text-secondary"
			title={label}
		>
			{label}
		</span>
	);
}
