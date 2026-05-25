import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Bun is not available in Node.js (vitest). Skip daemon tests if Bun is not defined.
const hasBun = typeof Bun !== "undefined";

describe.runIf(hasBun)("DashboardDaemon integration", () => {
	let serveCalls: unknown[] = [];
	let fileExists = new Map<string, boolean>();
	let serveSpy: { mockRestore: () => void } | null = null;

	function setupMockBun() {
		serveCalls = [];
		fileExists = new Map();

		serveSpy = vi.spyOn(Bun, "serve").mockImplementation((options: any) => {
			serveCalls.push(options);
			return {
				port: options.port,
				hostname: options.hostname,
				stop: vi.fn(),
			} as any;
		});

		vi.spyOn(Bun, "file").mockImplementation((path: string) => {
			return {
				exists: () => Promise.resolve(fileExists.get(path) ?? false),
				size: 0,
				[Symbol.toStringTag]: "Blob",
			} as any;
		});
	}

	function restoreBun() {
		serveSpy?.mockRestore();
		vi.restoreAllMocks();
	}

	beforeEach(() => {
		setupMockBun();
	});

	afterEach(() => {
		restoreBun();
	});

	it("creates EventStreamProvider and SessionHost on construction", async () => {
		const { DashboardDaemon } = await import("../src/server/daemon.js");
		const daemon = new DashboardDaemon({ host: "127.0.0.1", port: 9393 });

		expect(daemon.eventProvider).toBeDefined();
		expect(daemon.sessionHost).toBeDefined();
	});

	it("starts Bun server with correct options", async () => {
		const { DashboardDaemon } = await import("../src/server/daemon.js");
		const daemon = new DashboardDaemon({ host: "127.0.0.1", port: 9393 });
		const url = await daemon.start();

		expect(Bun.serve).toHaveBeenCalledTimes(1);
		const options = serveCalls[0] as {
			hostname: string;
			port: number;
			fetch: (req: Request) => Promise<Response> | Response;
		};
		expect(options.hostname).toBe("127.0.0.1");
		expect(options.port).toBe(9393);
		expect(typeof options.fetch).toBe("function");
		expect(url!.href).toBe("http://127.0.0.1:9393/");
		expect(daemon.isRunning).toBe(true);
	});

	it("returns same URL on second start", async () => {
		const { DashboardDaemon } = await import("../src/server/daemon.js");
		const daemon = new DashboardDaemon({ port: 9394 });
		const url1 = await daemon.start();
		const url2 = await daemon.start();
		expect(Bun.serve).toHaveBeenCalledTimes(1);
		expect(url1!.href).toBe(url2!.href);
	});

	it("serves static files", async () => {
		const { DashboardDaemon } = await import("../src/server/daemon.js");
		const daemon = new DashboardDaemon({ port: 9395, frontendDir: "/fake/dist" });
		await daemon.start();

		const options = serveCalls[0] as { fetch: (req: Request) => Promise<Response> | Response };
		fileExists.set("/fake/dist/style.css", true);

		const req = new Request("http://localhost/style.css");
		const res = await options.fetch(req);
		expect(res.status).toBe(200);
	});

	it("falls back to index.html for unknown paths", async () => {
		const { DashboardDaemon } = await import("../src/server/daemon.js");
		const daemon = new DashboardDaemon({ port: 9396, frontendDir: "/fake/dist" });
		await daemon.start();

		const options = serveCalls[0] as { fetch: (req: Request) => Promise<Response> | Response };
		fileExists.set("/fake/dist/index.html", true);

		const req = new Request("http://localhost/unknown-route");
		const res = await options.fetch(req);
		expect(res.status).toBe(200);
	});

	it("stops server and resets state", async () => {
		const { DashboardDaemon } = await import("../src/server/daemon.js");
		const daemon = new DashboardDaemon({ port: 9398 });
		await daemon.start();
		daemon.stop();

		expect(daemon.isRunning).toBe(false);
		expect(daemon.url).toBeNull();
		expect(daemon.uptime).toBe(0);
	});
});
