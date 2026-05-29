import type { SessionLogger } from "@local/pi-logger";
import type { LionCore } from "./core.js";
import type { LionEvent, LionState } from "./types.js";

export class LionLogger {
	#logger: SessionLogger | null;

	constructor(logger: SessionLogger | null = null) {
		this.#logger = logger;
	}

	setLogger(logger: SessionLogger | null): void {
		this.#logger = logger;
	}

	logEvent(event: LionEvent): void {
		if (this.#logger) {
			this.#logger.log({
				type: "event",
				source: "lion",
				data: event,
			});
		}
	}

	logState(action: string, state: LionState, core: LionCore, details?: Record<string, unknown>): void {
		if (this.#logger) {
			this.#logger.log({
				type: "state",
				source: "lion",
				data: {
					action,
					state: { ...state },
					core: core.activeRun
						? {
								runId: core.activeRun.runId,
								status: core.activeRun.status,
								attempts: core.activeRun.attempts,
								taskId: core.activeRun.taskId,
							}
						: null,
					...details,
				},
			});
		}
	}

	logTool(toolName: string, params: unknown, result?: unknown): void {
		if (this.#logger) {
			this.#logger.log({
				type: "tool",
				source: "lion",
				data: {
					toolName,
					params,
					result,
				},
			});
		}
	}

	logError(context: string, error: unknown): void {
		if (this.#logger) {
			this.#logger.log({
				type: "error",
				source: "lion",
				data: {
					context,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				},
			});
		}
	}
}
