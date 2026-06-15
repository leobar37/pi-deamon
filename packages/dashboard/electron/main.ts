/**
 * Electron main process.
 *
 * Starts the dashboard backend (DashboardDaemon) and the subagents backend,
 * then loads the React frontend. The renderer obtains both backend URLs
 * through the preload script via IPC and performs catalog operations through
 * the dashboard backend API.
 */

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DashboardDaemon } from "../src/server/daemon.js";
import { SubagentsBackendManager, type SubagentsBackendCommand } from "../src/server/subagents-backend.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HEALTHCHECK_TIMEOUT_MS = 30000;
const HEALTHCHECK_INTERVAL_MS = 200;
const DEV_RENDERER_URL = process.env.PI_DASHBOARD_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let dashboardDaemon: DashboardDaemon | null = null;
const backendManager = new SubagentsBackendManager({
	onStdout: (text) => process.stdout.write(`[backend] ${text}`),
	onStderr: (text) => process.stderr.write(`[backend] ${text}`),
	onUnexpectedExit: (code) => console.error(`[backend] Backend exited unexpectedly with code ${code}`),
});

/**
 * Determine how to start the backend.
 * In dev: runs the coding-agent CLI through Bun with the local extensions dir.
 * In packaged: uses `process.resourcesPath` where electron-builder places extraResources.
 */
function getBackendCommand(): SubagentsBackendCommand {
	const isPackaged = app.isPackaged;
	const extensionsDir = isPackaged
		? join(process.resourcesPath, "extensions")
		: join(__dirname, "..", "..", "..", "extensions");
	const args = ["--web", "--no-extensions", "-e", extensionsDir];

	if (isPackaged) {
		return { command: join(process.resourcesPath, "pi"), args, env: { LION_AUTO_ACTIVATE: "true" } };
	}
	return {
		command: "bun",
		args: [join(__dirname, "..", "..", "..", "coding-agent", "src", "cli.ts"), ...args],
		env: { LION_AUTO_ACTIVATE: "true" },
	};
}

/**
 * Wait for a URL healthcheck endpoint to respond.
 */
/**
 * Wait for a URL to become reachable.
 *
 * Accepts any 2xx response as "ready". A 404 is also accepted because some
 * backends (including older subagents builds) may not serve a root handler and
 * still be healthy. Redirects are not followed here; Electron's net/fetch
 * should resolve them before we see the response.
 */
async function waitForUrl(url: string, timeoutMs: number, intervalMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url, { method: "GET" });
			if (res.ok || res.status === 404) {
				return;
			}
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`${url} did not become ready within ${timeoutMs}ms`);
}

/**
 * Create the main BrowserWindow.
 */
async function createWindow(): Promise<void> {
	const indexPath = join(__dirname, "..", "..", "frontend", "dist", "index.html");
	const rendererUrl = DEV_RENDERER_URL ?? `file://${indexPath}`;

	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: "#0d0d12",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
		trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 18 } : undefined,
		webPreferences: {
			preload: join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		show: false,
	});

	let windowShown = false;
	const showMainWindow = () => {
		if (!mainWindow || windowShown) return;
		windowShown = true;
		mainWindow.show();
		if (process.platform === "darwin") {
			app.dock.show();
		}
		mainWindow.focus();
		console.log("[electron] Window shown and focused");
	};

	mainWindow.once("ready-to-show", showMainWindow);
	mainWindow.webContents.once("did-finish-load", showMainWindow);

	if (DEV_RENDERER_URL) {
		await waitForUrl(DEV_RENDERER_URL, HEALTHCHECK_TIMEOUT_MS, HEALTHCHECK_INTERVAL_MS);
	}

	await mainWindow.loadURL(rendererUrl);

	// Forward renderer console messages to the main process log so we can
	// diagnose iframe/subagents frontend issues without needing DevTools.
	mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
		const levelLabel = ["debug", "info", "warn", "error"][level] ?? "log";
		console.log(`[renderer:${levelLabel}] ${sourceId ?? ""}:${line ?? ""} ${message}`);
	});

	// Open DevTools automatically during development so errors in the renderer
	// and inside the subagent iframes are visible immediately.
	mainWindow.webContents.openDevTools({ mode: "detach" });

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

ipcMain.handle("get-backend-url", () => backendManager.getUrl());
ipcMain.handle("get-dashboard-url", () => dashboardDaemon?.url?.toString() ?? null);

ipcMain.handle("choose-project-directory", async () => {
	const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
		properties: ["openDirectory", "createDirectory"],
	});
	return result.canceled ? null : result.filePaths[0] ?? null;
});

if (!DEV_RENDERER_URL) {
	const gotLock = app.requestSingleInstanceLock();
	if (!gotLock) {
		console.error("[electron] Another Pi Dashboard instance is already running. Exiting.");
		app.quit();
		process.exit(0);
	}

	app.on("second-instance", () => {
		console.log("[electron] Second instance detected; focusing existing window");
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			if (!mainWindow.isVisible()) {
				mainWindow.show();
			}
			if (process.platform === "darwin") {
				app.dock.show();
			}
			mainWindow.focus();
		}
	});
}

// App lifecycle
app.whenReady().then(async () => {
	try {
		console.log("[electron] Starting dashboard backend...");
		dashboardDaemon = new DashboardDaemon();
		const dashboardUrl = await dashboardDaemon.start();
		console.log(`[electron] Dashboard backend URL: ${dashboardUrl}`);

		console.log("[electron] Starting subagents backend...");
		backendManager.start(getBackendCommand());
		const subagentsUrl = await backendManager.getUrl();
		console.log(`[electron] Subagents backend URL resolved: ${subagentsUrl}`);
		dashboardDaemon.setSubagentsUrl(subagentsUrl);

		await waitForUrl(subagentsUrl, HEALTHCHECK_TIMEOUT_MS, HEALTHCHECK_INTERVAL_MS);
		console.log("[electron] Subagents backend is ready; creating window");
		await createWindow();
	} catch (err) {
		console.error("[electron] Failed to start dashboard:", err);
		app.quit();
	}
});

app.on("before-quit", () => {
	backendManager.kill();
	void dashboardDaemon?.stop();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null) {
		void createWindow();
	}
});
