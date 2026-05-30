import type { DelegationResult } from "../types.js";
import type { LionTaskEvidence, LionVerificationStatus } from "./types.js";

const COMMAND_PATTERN =
	/(?:^|\n)\s*(?:[$>]\s*)?((?:bun|pnpm|yarn|npm|cargo|go|python|pytest|vitest|tsc|tsgo|grep|rg|find|git)\b[^\n]*)/gi;
const CHANGED_FILE_PATTERN =
	/(?:modified|created|deleted|renamed|changed|updated|files? changed|archivo[s]?):?\s+([^\n]+)/gi;
const FAILURE_PATTERN = /\b(error|failed|failure|exception|stack overflow|maximum call stack|stderr|timeout)\b/gi;
const BLOCKED_PATTERN = /\b(blocked|eperm|permission denied|sandbox|network|cannot connect|listen eperm)\b/gi;
const PASSED_PATTERN = /\b(pass(?:ed|es)?|success|succeeded|clean|ok)\b/gi;
const NEGATION_PATTERN =
	/\b(no(?:t)?\s+(?:error|failure|fail|exception|errors|failures|fails|exceptions)|(?:error|failure|fail|exception|errors|failures|fails|exceptions)\s+(?:not\s+found|free|cleared|fixed|resolved|handled|expected|0|zero))\b/gi;
const EXTERNAL_PATTERN = /\b(unrelated|external|pre-existing|preexisting|out of scope)\b/i;
const RISK_PATTERN = /\b(risk|warning|warn|unverified|not run|skipped|todo|remaining|follow-up|follow up)\b/i;

export function classifyLionTaskResult(result: DelegationResult): {
	verificationStatus: LionVerificationStatus;
	evidence: LionTaskEvidence;
} {
	const summary = result.summary.trim();
	const evidence: LionTaskEvidence = {
		commands: extractCommands(summary),
		checks: extractChecks(summary),
		changedFiles: extractChangedFiles(summary),
		warnings: extractMatchingLines(summary, RISK_PATTERN),
		externalFailures: extractExternalFailures(summary),
		residualRisks: [],
	};

	if (result.error) {
		evidence.warnings.push(result.error);
	}

	const verificationStatus = classifyVerification(result, summary, evidence);
	if (verificationStatus === "unverified") {
		evidence.residualRisks.push("Subagent completed without explicit passing validation evidence.");
	}
	if (verificationStatus === "blocked") {
		evidence.residualRisks.push("Validation was blocked by an environment or external failure.");
	}

	return { verificationStatus, evidence };
}

function classifyVerification(
	result: DelegationResult,
	summary: string,
	evidence: LionTaskEvidence,
): LionVerificationStatus {
	if (result.status !== "completed") {
		return result.status === "blocked" || result.status === "timed_out" || result.status === "cancelled"
			? "blocked"
			: "failed";
	}

	const hasFailure = FAILURE_PATTERN.test(summary) && !onlyExternalFailures(summary);
	if (hasFailure) return "failed";

	if (evidence.externalFailures.length > 0 || BLOCKED_PATTERN.test(summary)) {
		return "blocked";
	}

	const hasPassingCheck = evidence.checks.some((check) => check.status === "passed");
	const hasPassingCommand = evidence.commands.some((command) => command.status === "passed");
	if (hasPassingCheck || hasPassingCommand) return "verified";

	return "unverified";
}

function extractCommands(summary: string): LionTaskEvidence["commands"] {
	return Array.from(summary.matchAll(COMMAND_PATTERN), (match) => {
		const command = match[1].trim();
		const line = getLine(summary, match.index ?? 0);
		return {
			command,
			status: lineStatus(line),
			stderrSnippet: FAILURE_PATTERN.test(line) ? trimSnippet(line) : undefined,
		};
	});
}

function extractChecks(summary: string): LionTaskEvidence["checks"] {
	return summary
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => /\b(test|check|validation|verify|vitest|tsgo|typecheck|lint)\b/i.test(line))
		.map((line) => ({
			name: trimSnippet(line),
			status: lineStatus(line) === "unknown" ? "unknown" : lineStatus(line),
			detail: trimSnippet(line),
		}));
}

function extractChangedFiles(summary: string): string[] {
	const files = new Set<string>();
	for (const match of summary.matchAll(CHANGED_FILE_PATTERN)) {
		for (const part of match[1].split(/[,\s]+/)) {
			const value = part.trim().replace(/^[`"']|[`"',.]$/g, "");
			if (value.includes("/") && !value.includes("://")) files.add(value);
		}
	}
	return Array.from(files);
}

function extractExternalFailures(summary: string): string[] {
	return extractMatchingLines(summary, EXTERNAL_PATTERN).filter((line) => FAILURE_PATTERN.test(line));
}

function extractMatchingLines(summary: string, pattern: RegExp): string[] {
	return summary
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && pattern.test(line))
		.map(trimSnippet);
}

function lineStatus(line: string): "passed" | "failed" | "blocked" | "unknown" {
	if (BLOCKED_PATTERN.test(line)) return "blocked";
	if (NEGATION_PATTERN.test(line)) return "passed";
	if (FAILURE_PATTERN.test(line)) return "failed";
	if (PASSED_PATTERN.test(line)) return "passed";
	return "unknown";
}

function onlyExternalFailures(summary: string): boolean {
	const failureLines = extractMatchingLines(summary, FAILURE_PATTERN);
	return failureLines.length > 0 && failureLines.every((line) => EXTERNAL_PATTERN.test(line));
}

function getLine(text: string, index: number): string {
	const start = text.lastIndexOf("\n", index) + 1;
	const end = text.indexOf("\n", index);
	return text.slice(start, end === -1 ? undefined : end);
}

function trimSnippet(value: string): string {
	return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}
