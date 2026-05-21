import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { LionEventBus } from "./bus.js";
import { LionRuleMonitor } from "./rule-monitor.js";
import { LionEventStore } from "./store.js";

export interface LionRunReporterOptions {
	getActivePlanSlug?: () => string | null;
}

/**
 * Configura el reporter para el bus dado: cada evento publicado en el bus
 * se guarda en el store (si hay un plan activo) y se evaluan violaciones de
 * reglas.
 */
export function createLionRunReporter(
	ctx: Pick<ExtensionCommandContext, "cwd">,
	bus: LionEventBus,
	_options: LionRunReporterOptions = {},
): void {
	const store = new LionEventStore(ctx.cwd);
	const monitor = new LionRuleMonitor((event) => bus.emit(event));

	bus.on("*", (event) => {
		try {
			store.save(event);
		} catch {
			// Event logs are diagnostic; command behavior remains authoritative.
		}
		monitor.onEvent(event);
	});
}
