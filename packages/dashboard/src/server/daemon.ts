/**
 * DashboardDaemon — HTTP server for the web dashboard.
 *
 * Starts a Bun HTTP server with:
 * - `/api` — oRPC endpoints (state + unified event stream + session API)
 * - `/` — static React SPA frontend (or Vite dev server in dev mode)
 *
 * Usage:
 * ```ts
 * const daemon = new DashboardDaemon();
 * const url = await daemon.start();
 * console.log(`Dashboard at ${url.href}`);
 * daemon.stop();
 * ```
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { EventStreamProvider } from "../events/provider.js";
import { logger } from "../logging.js";
import { createDashboardRouter } from "../procedures/index.js";
import { SessionHost } from "../session/host.js";
import type { DashboardConfig } from "../types.js";
import { serveStaticFile } from "./static.js";

async function fileExists(path: string): Promise<boolean> {
	try {
		const f = Bun.file(path);
		// Bun.file().size throws if the file doesn't exist
		await f.size;
		return true;
	} catch {
		return false;
	}
}

/** Wait for a URL to be reachable with a timeout. */
async function waitForServer(url: string, timeoutMs = 30000, intervalMs = 200): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url, { method: "HEAD" });
			if (res.ok || res.status === 404) {
				return;
			}
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export class DashboardDaemon {
	private handler: RPCHandler<any> | null = null;
	private server: ReturnType<typeof Bun.serve> | null = null;
	private config: Required<DashboardConfig>;
	private startTime = 0;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private viteProcess: any | null = null;
	private viteDevUrl = "http://127.0.0.1:5173";
	readonly eventProvider = new EventStreamProvider();
	readonly sessionHost = new SessionHost();

	constructor(config?: DashboardConfig) {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		this.config = {
			host: config?.host ?? "127.0.0.1",
			port: config?.port ?? 9393,
			frontendDir: config?.frontendDir ?? join(__dirname, "..", "..", "frontend", "dist"),
			dev: config?.dev ?? false,
		};
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

		// Wire up event forwarding so agent events reach SSE subscribers
		this.sessionHost.setEventProvider(this.eventProvider);

		// In dev mode, spawn Vite dev server instead of serving static files
		if (this.config.dev) {
			await this._startViteDevServer();
		} else {
			// Ensure frontend is built before serving static files
			await this._ensureFrontendBuild();
		}

		const listenPort = port ?? this.config.port;
		const router = createDashboardRouter(this.eventProvider, () => this.startTime, this.sessionHost);
		this.handler = new RPCHandler(router, {
			plugins: [
				new CORSPlugin({
					origin: (origin) => origin,
					allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
				}),
			],
		});

		this.server = Bun.serve({
			hostname: this.config.host,
			port: listenPort,
			fetch: async (req: Request) => {
				const url = new URL(req.url);
				const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

				logger.debug(`${req.method} ${url.pathname}`, { requestId });

				// Direct logs endpoint (before oRPC to avoid RPC routing issues)
				if (url.pathname === "/api/logs" && req.method === "GET") {
					const level = url.searchParams.get("level") as any;
					const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
					const sessionId = url.searchParams.get("sessionId") ?? undefined;
					const logs = logger.getLogs({ level, limit, sessionId });
					return new Response(JSON.stringify({ logs, total: logger.size }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}

				// API routes -> oRPC handler
				if (url.pathname.startsWith("/api")) {
					const { matched, response } = await this.handler!.handle(req, {
						prefix: "/api",
						context: {},
					});
					if (matched) {
						const status = response.status;
						if (status >= 500) {
							logger.error(`oRPC returned ${status} for ${req.method} ${url.pathname}`, {
								requestId,
								status,
							});
						} else if (status >= 400) {
							logger.warn(`oRPC returned ${status} for ${req.method} ${url.pathname}`, {
								requestId,
								status,
							});
						} else {
							logger.debug(`oRPC ${status} for ${req.method} ${url.pathname}`, {
								requestId,
								status,
							});
						}
						return response;
					}
				}

				// In dev mode, proxy to Vite dev server
				if (this.config.dev) {
					return this._proxyToVite(req);
				}

				// Static files -> frontend dist
				return serveStaticFile(url.pathname, this.config.frontendDir);
			},
		});

		return this.url!;
	}

	stop(): void {
		if (!this.server) return;

		// Kill Vite dev server if running
		if (this.viteProcess) {
			this._killViteDevServer();
		}

		// Clean up event subscribers
		this.eventProvider.clear();

		// Dispose all live sessions
		this.sessionHost.dispose().catch((err) => {
			logger.error("Error disposing sessions", { error: String(err) });
		});

		// Stop HTTP server
		this.server.stop(true);
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

	// -------------------------------------------------------------------------
	// Dev mode: Vite dev server
	// -------------------------------------------------------------------------

	private async _startViteDevServer(): Promise<void> {
		const frontendDir = join(this.config.frontendDir, "..");
		const pkgJsonPath = join(frontendDir, "package.json");
		const hasPackageJson = await fileExists(pkgJsonPath);

		if (!hasPackageJson) {
			logger.warn("Frontend package.json not found, cannot start dev server", { frontendDir });
			return;
		}

		logger.info("Starting Vite dev server...", { frontendDir });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.viteProcess = (Bun as any).spawn(["bun", "run", "dev"], {
			cwd: frontendDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		// Forward Vite output with prefix
		const reader = this.viteProcess.stdout.getReader();
		const decoder = new TextDecoder();
		(async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const text = decoder.decode(value, { stream: true });
					for (const line of text.split("\n")) {
						if (line.trim()) {
							console.log(`[vite] ${line}`);
						}
					}
				}
			} catch {
				// ignore
			}
		})();

		const stderrReader = this.viteProcess.stderr.getReader();
		(async () => {
			try {
				while (true) {
					const { done, value } = await stderrReader.read();
					if (done) break;
					const text = decoder.decode(value, { stream: true });
					for (const line of text.split("\n")) {
						if (line.trim()) {
							console.error(`[vite] ${line}`);
						}
					}
				}
			} catch {
				// ignore
			}
		})();

		// Wait for Vite to be ready
		try {
			await waitForServer(this.viteDevUrl);
			logger.info("Vite dev server ready", { url: this.viteDevUrl });
		} catch (err) {
			this._killViteDevServer();
			throw new Error(`Failed to start Vite dev server: ${err}`);
		}
	}

	private _killViteDevServer(): void {
		if (!this.viteProcess) return;

		logger.info("Stopping Vite dev server...");
		try {
			this.viteProcess.kill("SIGTERM");
		} catch {
			// ignore
		}

		// Force kill after 3s if still running
		setTimeout(() => {
			try {
				this.viteProcess?.kill("SIGKILL");
			} catch {
				// ignore
			}
		}, 3000);

		this.viteProcess = null;
	}

	private async _proxyToVite(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const targetUrl = `${this.viteDevUrl}${url.pathname}${url.search}`;

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const proxyReq = new Request(targetUrl, {
				method: req.method,
				headers: req.headers,
				body: req.body,
				duplex: "half",
			} as any);
			return await fetch(proxyReq);
		} catch (err) {
			logger.error("Vite proxy error", { path: url.pathname, error: String(err) });
			return new Response(`Vite dev server error: ${err}`, { status: 502 });
		}
	}

	// -------------------------------------------------------------------------
	// Frontend build
	// -------------------------------------------------------------------------

	private async _ensureFrontendBuild(): Promise<void> {
		const indexPath = join(this.config.frontendDir, "index.html");
		const hasBuild = await fileExists(indexPath);

		if (hasBuild) {
			return;
		}

		logger.info("Frontend build not found, building...", { frontendDir: this.config.frontendDir });
		await this._buildFrontend();
	}

	private async _buildFrontend(): Promise<void> {
		const frontendDir = join(this.config.frontendDir, "..");
		const pkgJsonPath = join(frontendDir, "package.json");
		const hasPackageJson = await fileExists(pkgJsonPath);

		if (!hasPackageJson) {
			logger.warn("Frontend package.json not found, skipping build", { frontendDir });
			return;
		}

		logger.info("Building frontend...", { frontendDir });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const proc = (Bun as any).spawn(["bun", "run", "build"], {
			cwd: frontendDir,
			stdout: "inherit",
			stderr: "inherit",
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const exitCode = (await proc.exited) as number;
		if (exitCode !== 0) {
			logger.error("Frontend build failed", { exitCode, frontendDir });
			throw new Error(`Frontend build failed with exit code ${exitCode}`);
		}

		logger.info("Frontend build complete");
	}
}
