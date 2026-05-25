#!/usr/bin/env node
/**
 * pi-web CLI entry point
 *
 * Usage:
 *   pi-web              Start web dashboard on default port (9393)
 *   pi-web --port 8080  Start on custom port
 *   pi-web --host 0.0.0.0  Listen on all interfaces
 */

import { DashboardDaemon } from "./server/daemon.js";

// ============================================================================
// Argument parsing
// ============================================================================

interface CliArgs {
	port?: number;
	host?: string;
	dev?: boolean;
	help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
	const result: CliArgs = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--help" || arg === "-h") {
			result.help = true;
		} else if ((arg === "--port" || arg === "-p") && i + 1 < args.length) {
			const port = parseInt(args[++i], 10);
			if (!Number.isNaN(port)) result.port = port;
		} else if ((arg === "--host" || arg === "-H") && i + 1 < args.length) {
			result.host = args[++i];
		} else if (arg === "--dev" || arg === "-d") {
			result.dev = true;
		}
	}

	return result;
}

function printHelp(): void {
	console.log(`
pi-web - Web dashboard for Pi sessions

Usage:
  pi-web [options]

Options:
  -p, --port <number>       Port to listen on (default: 9393)
  -H, --host <address>      Host to bind to (default: 127.0.0.1)
  -d, --dev                 Start in development mode with Vite HMR
  -h, --help                Show this help message

Examples:
  pi-web                    Start on http://127.0.0.1:9393
  pi-web --port 8080        Start on http://127.0.0.1:8080
  pi-web --host 0.0.0.0     Listen on all interfaces
  pi-web --dev              Start in dev mode with live reload
`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	const port = args.port ?? 9393;
	const host = args.host ?? "127.0.0.1";
	const dev = args.dev ?? false;

	if (dev) {
		console.log(`Starting pi-web in dev mode on http://${host}:${port}`);
	} else {
		console.log(`Starting pi-web on http://${host}:${port}`);
	}

	const daemon = new DashboardDaemon({ port, host, dev });
	const url = await daemon.start();

	console.log(`pi-web running at ${url.href}`);
	if (dev) {
		console.log("Dev mode: Vite HMR enabled");
	}
	console.log("Press Ctrl+C to stop");

	// Keep alive
	await new Promise(() => {});
}

main().catch((err) => {
	console.error("Failed to start pi-web:", err);
	process.exit(1);
});
