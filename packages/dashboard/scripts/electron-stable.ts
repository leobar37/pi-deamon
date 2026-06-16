/**
 * electron-stable
 *
 * Builds the dashboard and its dependencies from compiled artifacts, then
 * starts Electron against the static frontend build. No Vite dev server and
 * no HMR are used, so edits to source files do not affect the running app
 * until the next rebuild/restart.
 *
 * Environment variables:
 * - PI_CORE_PORT  Port for the core backend (default: 9394)
 * - SKIP_NATIVE_REBUILD  Set to "1" to skip the better-sqlite3 Electron rebuild
 */

import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const DASHBOARD_DIR = join(REPO_ROOT, "packages", "dashboard");
const CORE_DIR = join(REPO_ROOT, "packages", "core");
const CORE_FRONTEND_DIR = join(REPO_ROOT, "packages", "core", "frontend");

const DEFAULT_CORE_PORT = "9394";

async function runCommand(command: string, args: string[], cwd?: string): Promise<void> {
	const child = spawn(command, args, {
		stdio: "inherit",
		shell: false,
		cwd,
	});

	const [code, signal] = (await once(child, "exit")) as [number | null, NodeJS.Signals | null];
	if (code !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed with ${signal ?? `code ${code}`}`);
	}
}

function spawnProcess(command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): ChildProcess {
	return spawn(command, args, {
		stdio: "inherit",
		shell: false,
		cwd: options?.cwd,
		env: {
			...process.env,
			...options?.env,
		},
	});
}

function stopProcess(child: ChildProcess): void {
	if (child.exitCode !== null || child.signalCode !== null) {
		return;
	}
	child.kill("SIGTERM");
}

/**
 * Rebuild native modules against Electron's NODE_MODULE_VERSION.
 *
 * Bun installs better-sqlite3 with prebuilds targeting the system Node ABI,
 * but Electron's embedded Node uses a different ABI. Without this step the
 * dashboard daemon fails at startup with ERR_DLOPEN_FAILED.
 *
 * The rebuild is incremental (skips if already rebuilt for the current
 * Electron version).
 */
async function rebuildNativeModulesForElectron(): Promise<void> {
	await runCommand("bun", ["x", "electron-rebuild", "--only", "better-sqlite3", "--module-dir", "."], DASHBOARD_DIR);
}

async function main(): Promise<void> {
	console.log("[electron-stable] Building static artifacts...");

	await runCommand("bun", ["run", "build"], CORE_DIR);
	await runCommand("bun", ["run", "build"], CORE_FRONTEND_DIR);
	await runCommand("bun", ["run", "build:all"], DASHBOARD_DIR);
	await runCommand("bun", ["run", "build:electron"], DASHBOARD_DIR);

	if (process.env.SKIP_NATIVE_REBUILD !== "1") {
		console.log("[electron-stable] Rebuilding native modules for Electron...");
		await rebuildNativeModulesForElectron();
	}

	const corePort = process.env.PI_CORE_PORT ?? process.env.PI_SUBAGENTS_PORT ?? DEFAULT_CORE_PORT;

	const env: NodeJS.ProcessEnv = {
		...process.env,
		PI_CORE_DASHBOARD_PORT: corePort,
	};
	// Ensure we never inherit a dev renderer URL; Electron must load the static
	// frontend build from file://frontend/dist/index.html.
	delete env.PI_DASHBOARD_RENDERER_URL;

	console.log(`[electron-stable] Starting Electron (core backend port ${corePort})...`);
	const electron = spawnProcess("electron", ["electron/dist/main.cjs"], {
		cwd: DASHBOARD_DIR,
		env,
	});

	const stopAll = () => {
		stopProcess(electron);
	};

	process.once("SIGINT", () => {
		stopAll();
		process.exit(130);
	});
	process.once("SIGTERM", () => {
		stopAll();
		process.exit(143);
	});

	const [code, signal] = (await once(electron, "exit")) as [number | null, NodeJS.Signals | null];
	stopAll();

	if (code !== 0) {
		throw new Error(`Electron exited with ${signal ?? `code ${code}`}`);
	}
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[electron-stable] ${message}`);
	process.exit(1);
});
