import type { LionPlanValidationVerdict } from "../types.js";

export function parsePlanValidationVerdict(summary: string): LionPlanValidationVerdict {
	const normalized = summary.toLowerCase();
	if (normalized.includes("<lion-plan-valid>")) return "valid";
	if (normalized.includes("<lion-plan-needs-work>")) return "needs_work";
	return "unknown";
}
