/**
 * Electron main process.
 *
 * Spawns the Pi coding-agent in web mode, waits for the Lion dashboard URL,
 * then loads the React frontend. The renderer obtains the backend URL through
 * the preload script via IPC.
 */

import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DASHBOARD_URL_REGEX = /\[lion\] dashboard at (http:\/\/[^\s]+)/;
const HEALTHCHECK_TIMEOUT_MS = 30000;
const HEALTHCHECK_INTERVAL_MS = 200;
const KILL_TIMEOUT_MS = 3000;
const BACKEND_URL_WAIT_MS = 30000;

let backendProcess: ChildProcessWithoutNullStreams | null = null;
let mainWindow: BrowserWindow | null = null;
let backendUrl: string | null = null;

/**
 * Determine how to start the backend.
 * In dev: runs the coding-agent CLI through Bun with the local extensions dir.
 * In packaged: uses `process.resourcesPath` where electron-builder places extraResources.
 */
function getBackendCommand(): { command: string; args: string[] } {
	const isPackaged = app.isPackaged;
	const extensionsDir = isPackaged
		? join(process.resourcesPath, "extensions")
		: join(__dirname, "..", "..", "..", "extensions");
	const args = ["--web", "-e", extensionsDir];

	if (isPackaged) {
		return { command: join(process.resourcesPath, "pi"), args };
	}
	return {
		command: "bun",
		args: [join(__dirname, "..", "..", "..", "coding-agent", "src", "cli.ts"), ...args],
	};
}

function normalizeUrl(url: string): string {
	return url.replace(/\/$/, "");
}

/**
 * Wait for the backend healthcheck endpoint to respond.
 */
async function waitForBackend(url: string, timeoutMs: number, intervalMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`${url}/rpc`, { method: "HEAD" });
			if (res.ok || res.status === 404) {
				return;
			}
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`Backend at ${url} did not become ready within ${timeoutMs}ms`);
}

/**
 * Start the backend binary and resolve with its URL once ready.
 */
async function startBackend(): Promise<string> {
	const backendCommand = getBackendCommand();

	return new Promise((resolve, reject) => {
		const proc = spawn(backendCommand.command, backendCommand.args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				LION_AUTO_ACTIVATE: "true",
			},
		});

		backendProcess = proc;

		let localBackendUrl: string | null = null;
		let stdoutBuffer = "";

		proc.stdout.on("data", (data: Buffer) => {
			const text = data.toString("utf-8");
			stdoutBuffer += text;
			process.stdout.write(`[backend] ${text}`);

			const match = DASHBOARD_URL_REGEX.exec(stdoutBuffer);
			if (match && !localBackendUrl) {
				localBackendUrl = normalizeUrl(match[1]);
				backendUrl = localBackendUrl;
				resolve(localBackendUrl);
			}
		});

		proc.stderr.on("data", (data: Buffer) => {
			process.stderr.write(`[backend] ${data.toString("utf-8")}`);
		});

		proc.on("error", (err) => {
			reject(new Error(`Failed to start backend: ${err.message}`));
		});

		proc.on("exit", (code) => {
			if (!localBackendUrl) {
				reject(new Error(`Backend exited with code ${code} before becoming ready`));
			}
		});
	});
}

/**
 * Kill the backend process gracefully, then forcefully.
 */
function killBackend(): void {
	if (!backendProcess) return;

	try {
		backendProcess.kill("SIGTERM");
	} catch {
		// ignore
	}

	setTimeout(() => {
		try {
			backendProcess?.kill("SIGKILL");
		} catch {
			// ignore
		}
	}, KILL_TIMEOUT_MS);

	backendProcess = null;
}

/**
 * Create the main BrowserWindow.
 */
function createWindow(): void {
	const indexPath = join(__dirname, "..", "..", "frontend", "dist", "index.html");

	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 800,
		minHeight: 600,
		webPreferences: {
			preload: join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		show: false,
	});

	mainWindow.loadURL(`file://${indexPath}`);

	mainWindow.once("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

ipcMain.handle("get-backend-url", async () => {
	if (backendUrl) return backendUrl;

	const start = Date.now();
	while (!backendUrl && Date.now() - start < BACKEND_URL_WAIT_MS) {
		await new Promise((r) => setTimeout(r, 100));
	}

	if (!backendUrl) {
		throw new Error("Backend URL is not available");
	}

	return backendUrl;
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
	process.exit(0);
}

app.on("second-instance", () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.focus();
	}
});

// App lifecycle
app.whenReady().then(async () => {
	try {
		const url = await startBackend();
		await waitForBackend(url, HEALTHCHECK_TIMEOUT_MS, HEALTHCHECK_INTERVAL_MS);
		createWindow();
	} catch (err) {
		console.error("Failed to start dashboard:", err);
		app.quit();
	}
});

app.on("before-quit", () => {
	killBackend();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null && backendProcess !== null && backendUrl !== null) {
		createWindow();
	}
});
