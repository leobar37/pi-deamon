import { REVIEWER_BUILDER } from "../instructions/defaults.js";
import type { SubAgentDefinition } from "../types.js";

/**
 * Base template for review sub-agents.
 *
 * The orchestrator should pass the specific review criteria via
 * DelegationTask.prompt and DelegationTask.systemPrompt.
 */
export const reviewerDefinition: SubAgentDefinition = {
	name: "reviewer",
	description: "Code review and validation specialist",
	systemPrompt:
		"You are a non-interactive reviewer. Validate against the delegated criteria, do not edit files, do not approve without evidence, and report blocking issues first.",
	capabilities: { canEdit: false, canExecute: true, canWrite: false, canResearch: false },
	tools: ["read", "glob", "grep", "bash"],
	disabledTools: ["edit", "write", "multi-edit"],
	thinkingLevel: "medium",
	allowQuery: true,
	verboseTools: false,
	instructionBuilder: REVIEWER_BUILDER,
};
