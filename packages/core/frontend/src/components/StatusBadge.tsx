import type { SubAgentState } from "../types.ts";

const STATE_CONFIG: Record<
	SubAgentState,
	{ label: string; color: string }
> = {
	created: { label: "Created", color: "text-text-muted" },
	starting: { label: "Starting", color: "text-info" },
	running: { label: "Running", color: "text-accent" },
	paused: { label: "Paused", color: "text-warning" },
	completing: { label: "Completing", color: "text-info" },
	completed: { label: "Completed", color: "text-success" },
	blocked: { label: "Blocked", color: "text-warning" },
	failed: { label: "Failed", color: "text-error" },
	cancelled: { label: "Cancelled", color: "text-text-muted" },
	timed_out: { label: "Timed Out", color: "text-error" },
};

interface StatusBadgeProps {
	state: SubAgentState;
	pulse?: boolean;
}

export function StatusBadge({ state, pulse }: StatusBadgeProps) {
	const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.created;
	return (
		<span
			className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color} ${pulse ? "animate-pulse-opacity" : ""}`}
		>
			<span className={`w-1.5 h-1.5 rounded-full ${state === "running" ? "bg-accent" : state === "completed" ? "bg-success" : state === "blocked" ? "bg-warning" : state === "failed" || state === "timed_out" ? "bg-error" : "bg-text-muted"}`} />
			{cfg.label}
		</span>
	);
}
