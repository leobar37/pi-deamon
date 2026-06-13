#!/usr/bin/env bun
/**
 * pi-dev: run this fork of pi in web mode from any directory,
 * loading the vendored extensions from packages/extensions.
 */

import { realpathSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = realpathSync(join(import.meta.dirname, ".."));
const CLI_ENTRY = join(REPO_ROOT, "packages", "coding-agent", "src", "cli.ts");
const SUBAGENTS_DIR = join(REPO_ROOT, "packages", "subagents");
const SUBAGENTS_FRONTEND_DIR = join(SUBAGENTS_DIR, "frontend");
const EXT_DIR = join(REPO_ROOT, "packages", "extensions");
const DASHBOARD_URL_PATTERN = /\[lion\] dashboard at (https?:\/\/[^\s]+)/;

const args = process.argv.slice(2).filter((arg) => arg !== "--web-only");

function runBuild(command: string[], cwd: string): void {
	const proc = Bun.spawnSync(command, {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	});
	if (proc.exitCode !== 0) {
		process.exit(proc.exitCode ?? 1);
	}
}

function openBrowser(url: string): void {
	const command =
		process.platform === "darwin"
			? ["open", url]
			: process.platform === "win32"
				? ["cmd", "/c", "start", "", url]
				: ["xdg-open", url];

	Bun.spawn(command, {
		stdout: "ignore",
		stderr: "ignore",
	});
}

async function forwardOutput(
	stream: ReadableStream<Uint8Array> | null,
	write: (chunk: Uint8Array) => boolean,
	onText: (text: string) => void,
): Promise<void> {
	if (!stream) return;

	const decoder = new TextDecoder();
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			write(value);
			onText(decoder.decode(value, { stream: true }));
		}
		const remaining = decoder.decode();
		if (remaining) {
			onText(remaining);
		}
	} finally {
		reader.releaseLock();
	}
}

console.log("[pi-dev] Starting Pi web interface");

// Build subagents frontend first because HttpServerTransport serves its static files.
runBuild(["bun", "run", "build"], SUBAGENTS_FRONTEND_DIR);

// Build subagents because extensions keep @local/pi-subagents external.
runBuild(["bun", "run", "build"], SUBAGENTS_DIR);

// Build extensions so external dependencies are bundled and imports resolve.
runBuild(["bun", "run", "build"], EXT_DIR);

// --no-extensions disables global extension discovery so we only load the
// vendored extensions from packages/extensions, avoiding conflicts with
// user-installed global extensions (e.g. @capyup/pi-goal, @juicesharp/rpiv-todo).
const bunArgs = ["run", CLI_ENTRY, "--no-extensions", "-e", EXT_DIR, "--web", ...args];
const proc = Bun.spawn(["bun", ...bunArgs], {
	stdout: "pipe",
	stderr: "pipe",
	stdin: "inherit",
	env: {
		...process.env,
		LION_AUTO_ACTIVATE: "true",
	},
});

let dashboardOpened = false;
let dashboardOutputBuffer = "";
function detectDashboardUrl(text: string): void {
	if (dashboardOpened) return;

	dashboardOutputBuffer = `${dashboardOutputBuffer}${text}`.slice(-4096);
	const match = dashboardOutputBuffer.match(DASHBOARD_URL_PATTERN);
	if (!match) return;

	const url = match[1];
	dashboardOpened = true;
	console.log(`[pi-dev] Web interface: ${url}`);
	openBrowser(url);
}

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
if (process.platform !== "win32") {
	signals.push("SIGHUP");
}

for (const signal of signals) {
	process.on(signal, () => {
		proc.kill(signal);
	});
}

await Promise.all([
	forwardOutput(proc.stdout, (chunk) => process.stdout.write(chunk), detectDashboardUrl),
	forwardOutput(proc.stderr, (chunk) => process.stderr.write(chunk), detectDashboardUrl),
	proc.exited,
]);

process.exit(proc.exitCode ?? 0);
