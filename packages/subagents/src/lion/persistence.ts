import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildPersistedLionCore, LION_CORE_ENTRY_TYPE, type LionCore } from "./core.js";
import { createInitialLionState } from "./state.js";
import { LION_STATE_ENTRY_TYPE, type LionState, type PersistedLionState } from "./types.js";

export class LionPersistence {
	readonly #pi: ExtensionAPI;

	constructor(pi: ExtensionAPI) {
		this.#pi = pi;
	}

	restoreState(ctx: ExtensionContext): LionState {
		const states = ctx.sessionManager
			.getBranch()
			.filter((entry) => entry.type === "custom" && entry.customType === LION_STATE_ENTRY_TYPE)
			.map((entry) => (entry as { data: PersistedLionState }).data)
			.sort((a, b) => a.updatedAt - b.updatedAt);
		const lastState = states[states.length - 1];
		if (!lastState || lastState.version !== 1) return createInitialLionState();
		const { action: _action, updatedAt: _updatedAt, ...state } = lastState;
		return state;
	}

	saveState(state: LionState, action: PersistedLionState["action"]): void {
		this.#pi.appendEntry(LION_STATE_ENTRY_TYPE, { ...state, action, updatedAt: Date.now() });
	}

	saveCore(core: LionCore, action: "start" | "record" | "finish" | "restore"): void {
		this.#pi.appendEntry(LION_CORE_ENTRY_TYPE, buildPersistedLionCore(core, action));
	}
}
