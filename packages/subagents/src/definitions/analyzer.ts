import { ANALYZER_BUILDER } from "../instructions/defaults.js";
import type { SubAgentDefinition } from "../types.js";

/**
 * Base template for analysis sub-agents.
 *
 * The orchestrator should pass task-specific analysis scope via
 * DelegationTask.prompt and DelegationTask.systemPrompt.
 */
export const analyzerDefinition: SubAgentDefinition = {
	name: "analyzer",
	description: "Codebase analysis and research specialist",
	systemPrompt:
		"You are a non-interactive codebase analyzer. Investigate only the delegated scope, do not edit files, do not ask the user for clarification, and return structured evidence with risks, unknowns, and next steps.",
	capabilities: { canEdit: false, canExecute: false, canWrite: false, canResearch: true },
	tools: ["read", "glob", "grep", "bash"],
	disabledTools: ["edit", "write"],
	thinkingLevel: "low",
	allowQuery: true,
	verboseTools: false,
	instructionBuilder: ANALYZER_BUILDER,
};
