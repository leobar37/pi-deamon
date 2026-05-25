/**
 * Dashboard router factory.
 *
 * Creates the top-level oRPC router with dashboard and session procedures.
 */

import type { EventStreamProvider } from "../events/provider.js";
import type { SessionHost } from "../session/host.js";
import { createDashboardProcedures } from "./dashboard.js";
import { createSessionProcedures } from "./session.js";

// ============================================================================
// Router factory
// ============================================================================

export function createDashboardRouter(
	eventProvider: EventStreamProvider,
	getStartTime: () => number,
	sessionHost?: SessionHost,
) {
	const baseRouter = createDashboardProcedures(eventProvider, getStartTime, sessionHost);

	if (!sessionHost) {
		return baseRouter;
	}

	const sessions = createSessionProcedures(sessionHost, eventProvider);

	return {
		...baseRouter,
		sessions,
	};
}

export type DashboardRouter = ReturnType<typeof createDashboardRouter>;
export type { SessionProcedures } from "./session.js";
