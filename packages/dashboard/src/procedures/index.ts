import type { DashboardProcedureOptions } from "./dashboard.js";
import { createDashboardProcedures } from "./dashboard.js";

// ============================================================================
// Router factory
// ============================================================================

export function createDashboardRouter(options: DashboardProcedureOptions) {
	return createDashboardProcedures(options);
}

export type DashboardRouter = ReturnType<typeof createDashboardRouter>;
