import type { ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import type { LionState } from "./types.js";

const STRUCTURE_TOOLS = new Set(["find", "ls"]);
const PLAN_TOOLS = new Set(["lion_list_plans", "lion_activate_plan", "lion_reconcile_plan"]);
const WRITE_TOOLS = new Set(["edit", "write"]);
const STRUCTURE_PROBE_BUDGET = 3;

interface DelegationGuardTurn {
	required: boolean;
	probeCount: number;
	delegated: boolean;
}

export class LionDelegationGuard {
	#turn: DelegationGuardTurn = { required: false, probeCount: 0, delegated: false };

	startTurn(prompt: string, state: LionState): void {
		this.#turn = {
			required: state.active && isNonTrivialRepositoryWork(prompt),
			probeCount: 0,
			delegated: false,
		};
	}

	endTurn(): void {
		this.#turn = { required: false, probeCount: 0, delegated: false };
	}

	handleToolCall(event: ToolCallEvent, state: LionState): ToolCallEventResult | undefined {
		if (!state.active || !this.#turn.required) return undefined;
		if (event.toolName === "lion_tasks") {
			this.#turn.delegated = true;
			return undefined;
		}
		if (PLAN_TOOLS.has(event.toolName)) return undefined;
		if (this.#turn.delegated) return undefined;
		if (isPlanFileToolCall(event)) return undefined;

		if (WRITE_TOOLS.has(event.toolName)) {
			return block("Lion is active. Delegate implementation to subagents with lion_tasks before editing files.");
		}
		if (event.toolName === "read") {
			return block(
				"Lion is active. Do not read source files one by one in the main thread. First inspect only the file tree, group related files into bundles, then call lion_tasks with analyzer prompts for those bundles.",
			);
		}
		if (event.toolName === "grep" || event.toolName === "bash") {
			return block(
				"Lion is active. Avoid broad main-thread exploration. Use ls/find to map the structure, then delegate file-bundle analysis with lion_tasks.",
			);
		}
		if (!STRUCTURE_TOOLS.has(event.toolName)) return undefined;

		this.#turn.probeCount++;
		if (this.#turn.probeCount <= STRUCTURE_PROBE_BUDGET) return undefined;

		return block(
			"Lion is active. You have enough structure. Group related files into bundles and call lion_tasks with analyzer prompts before more repository exploration.",
		);
	}
}

function block(reason: string): ToolCallEventResult {
	return { block: true, reason };
}

function isNonTrivialRepositoryWork(prompt: string): boolean {
	const normalized = prompt.toLowerCase();
	const hasRepositoryTarget =
		/packages\/[a-z0-9/_-]+/.test(normalized) ||
		/\b(src|frontend|backend|dashboard|runtime|extension|subagents|controller|state|event|mocks?|tests?)\b/.test(
			normalized,
		);
	const hasWorkIntent =
		/\b(analy[sz]e|review|implement|fix|refactor|improve|inspect|audit|plan|build|detect|revis|arregl|mejor|analiz|implementar|refactorizar)\b/.test(
			normalized,
		);
	return hasRepositoryTarget && hasWorkIntent;
}

function isPlanFileToolCall(event: ToolCallEvent): boolean {
	const paths = collectInputPaths(event.input);
	return paths.length > 0 && paths.every(isPlanPath);
}

function collectInputPaths(input: Record<string, unknown>): string[] {
	const paths: string[] = [];
	for (const [key, value] of Object.entries(input)) {
		if (!/path|file|cwd|dir/i.test(key)) continue;
		if (typeof value === "string") {
			paths.push(value);
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") paths.push(item);
			}
		}
	}
	return paths;
}

function isPlanPath(path: string): boolean {
	return (
		path === ".plans" ||
		path.startsWith(".plans/") ||
		path.includes("/.plans/") ||
		path === "plans" ||
		path.startsWith("plans/") ||
		path.includes("/plans/")
	);
}
