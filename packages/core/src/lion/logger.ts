import type { SessionLogger } from "@local/pi-logger";
import type { LionCore } from "./core.js";
import type { MainLogEntry, RunLogger } from "./run-logger.js";
import type { LionEvent, LionState } from "./types.js";

export class LionLogger {
	#logger: SessionLogger | null;
	#runLogger: RunLogger | null;

	constructor(logger: SessionLogger | null = null) {
		this.#logger = logger;
		this.#runLogger = null;
	}

	setLogger(logger: SessionLogger | null): void {
		this.#logger = logger;
	}

	setRunLogger(runLogger: RunLogger | null): void {
		this.#runLogger = runLogger;
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
		// Forward all state changes to run logger for structured observability.
		// The run logger's main.jsonl is designed to be high-signal but lightweight
		// (lifecycle + task boundaries), so all state transitions are relevant.
		this.#runLogger?.logMain({
			type: "state",
			source: "lion",
			data: { action, state: { ...state }, ...details },
		} as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
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
		this.#runLogger?.logMain({
			type: "tool",
			source: "lion",
			data: { toolName, params, result: result !== undefined ? "<present>" : undefined },
		} as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
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
		this.#runLogger?.logError(context, error);
	}
}
