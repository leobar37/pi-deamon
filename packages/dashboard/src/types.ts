import type { z } from "zod";
import type { DashboardSessionRuntimeSchema } from "./contract.js";
import type { DashboardDatabase } from "./db/connection.js";
import type { CanvasNodeRepository, ProjectRepository, SessionRepository } from "./db/repositories.js";
import type { DashboardEventBus } from "./events.js";

export interface DashboardConfig {
	host?: string;
	port?: number;
	frontendDir?: string;
	dev?: boolean;
	/**
	 * Path to the SQLite catalog database. Defaults to ~/.pi/dashboard.sqlite.
	 */
	databasePath?: string;
}

export interface DashboardContext extends Record<PropertyKey, unknown> {
	db: DashboardDatabase;
	projects: ProjectRepository;
	sessions: SessionRepository;
	canvasNodes: CanvasNodeRepository;
	events: DashboardEventBus;
}

export type DashboardSessionRuntime = z.infer<typeof DashboardSessionRuntimeSchema>;
