/**
 * DashboardDaemon — minimal HTTP server for the web dashboard SPA.
 *
 * Serves the static React SPA and exposes the dashboard catalog API. Session
 * runtime is handled by the subagents backend spawned by Electron's main process.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { createDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { createCanvasNodeRepository, createProjectRepository, createSessionRepository } from "../db/repositories.js";
import { DashboardEventBus } from "../events.js";
import { logger } from "../logging.js";
import { createDashboardRouter } from "../procedures/index.js";
import type { DashboardConfig, DashboardContext } from "../types.js";
import { DashboardEventStream } from "./events.js";
import { createFetchHandler, type HttpServer, startHttpServer } from "./http-server.js";
import { serveStaticFile } from "./static.js";
import { SubagentsBackendManager } from "./subagents-backend.js";

function resolveDefaultFrontendDir(moduleDir: string): string {
	const candidates = [join(moduleDir, "..", "..", "frontend", "dist"), join(moduleDir, "..", "frontend", "dist")];
	return candidates.find((candidate) => existsSync(join(candidate, "index.html"))) ?? candidates[0];
}

function resolveDefaultDatabasePath(): string {
	return join(homedir(), ".pi", "dashboard.sqlite");
}

export class DashboardDaemon {
	private handler: RPCHandler<DashboardContext> | null = null;
	private server: HttpServer | null = null;
	private config: DashboardConfig & {
		host: string;
		port: number;
		frontendDir: string;
		dev: boolean;
		databasePath: string;
	};
	private startTime = 0;
	private context: DashboardContext | null = null;
	private subagentsUrl: string | undefined;
	private eventStream: DashboardEventStream | null = null;
	private subagentsBackend: SubagentsBackendManager | null = null;

	constructor(config?: DashboardConfig) {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		this.config = {
			host: config?.host ?? "127.0.0.1",
			port: config?.port ?? 9393,
			frontendDir: config?.frontendDir ?? resolveDefaultFrontendDir(__dirname),
			dev: config?.dev ?? false,
			databasePath: config?.databasePath ?? resolveDefaultDatabasePath(),
			subagentsBackend: config?.subagentsBackend,
		};
		const db = createDatabase({ path: this.config.databasePath });
		runMigrations(db);
		this.context = {
			db,
			projects: createProjectRepository(db),
			sessions: createSessionRepository(db),
			canvasNodes: createCanvasNodeRepository(db),
			events: new DashboardEventBus(),
		};
		this.eventStream = new DashboardEventStream(this.context.events);
		logger.info("Dashboard database initialized", { path: this.config.databasePath });
	}

	getContext(): DashboardContext {
		if (!this.context) {
			throw new Error("Dashboard context is not initialized");
		}
		return this.context;
	}

	/**
	 * Start the HTTP server. Returns the URL where the dashboard is reachable.
	 * If already running, returns the existing URL.
	 */
	async start(port?: number): Promise<URL> {
		if (this.server) {
			return this.url!;
		}

		this.startTime = Date.now();

		const listenPort = port ?? this.config.port;
		const router = createDashboardRouter({
			getStartTime: () => this.startTime,
			context: this.getContext(),
			getSubagentsUrl: () => this.subagentsUrl,
		});
		this.handler = new RPCHandler(router, {
			plugins: [
				new CORSPlugin({
					origin: (origin) => origin,
					allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
				}),
			],
		});

		const fetchHandler = createFetchHandler(
			this.handler,
			"/rpc",
			this.getContext(),
			(pathname: string) => serveStaticFile(pathname, this.config.frontendDir),
			(request) => this.eventStream?.serve(request),
		);

		this.eventStream?.start();
		this.server = await startHttpServer(fetchHandler, this.config.host, listenPort);
		if (this.config.subagentsBackend) {
			this.subagentsBackend = new SubagentsBackendManager({
				onStdout: (text) => logger.info("Subagents backend stdout", { text }),
				onStderr: (text) => logger.warn("Subagents backend stderr", { text }),
				onUnexpectedExit: (code) => logger.error("Subagents backend exited unexpectedly", { code }),
			});
			this.subagentsBackend.start(this.config.subagentsBackend);
			this.setSubagentsUrl(await this.subagentsBackend.getUrl());
		}

		return this.url!;
	}

	async stop(): Promise<void> {
		if (!this.server) return;

		this.server.stop(true);
		this.eventStream?.stop();
		this.subagentsBackend?.kill();
		this.subagentsBackend = null;
		this.server = null;
		this.handler = null;
		this.startTime = 0;
	}

	get isRunning(): boolean {
		return this.server !== null;
	}

	get url(): URL | null {
		if (!this.server) return null;
		return new URL(`http://${this.config.host}:${this.server.port}`);
	}

	get uptime(): number {
		if (!this.startTime) return 0;
		return Date.now() - this.startTime;
	}

	setSubagentsUrl(url: string | undefined): void {
		this.subagentsUrl = url;
		logger.info("Subagents backend URL registered", { url });
	}

	getSubagentsUrl(): string | undefined {
		return this.subagentsUrl;
	}
}
