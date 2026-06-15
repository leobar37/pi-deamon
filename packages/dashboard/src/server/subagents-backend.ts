import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable } from "node:stream";

const DASHBOARD_URL_REGEX = /\[lion\] dashboard at (https?:\/\/[^\s]+)/;
const KILL_TIMEOUT_MS = 3000;
const MAX_STDOUT_BUFFER_SIZE = 8192;

export interface SubagentsBackendCommand {
	command: string;
	args: string[];
	env?: Record<string, string | undefined>;
}

export interface SubagentsBackendManagerOptions {
	onStdout?: (text: string) => void;
	onStderr?: (text: string) => void;
	onUnexpectedExit?: (code: number | null) => void;
}

export class SubagentsBackendManager {
	private process: ChildProcessByStdio<null, Readable, Readable> | null = null;
	private urlPromise: Promise<string> | null = null;
	private urlResolve: ((url: string) => void) | null = null;
	private urlReject: ((err: Error) => void) | null = null;
	private resolvedUrl: string | null = null;
	private stdoutBuffer = "";

	constructor(private readonly options: SubagentsBackendManagerOptions = {}) {}

	getUrl(): Promise<string> {
		if (this.resolvedUrl) {
			return Promise.resolve(this.resolvedUrl);
		}
		if (this.urlPromise) {
			return this.urlPromise;
		}
		this.urlPromise = new Promise<string>((resolve, reject) => {
			this.urlResolve = resolve;
			this.urlReject = reject;
		});
		return this.urlPromise;
	}

	start(command: SubagentsBackendCommand): void {
		if (this.process) {
			return;
		}

		const proc = spawn(command.command, command.args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				...command.env,
			},
		});

		this.process = proc;

		proc.stdout.on("data", (data: Buffer) => {
			const text = data.toString("utf-8");
			this.appendStdout(text);
			this.options.onStdout?.(text);

			const url = this.parseUrl();
			if (url) {
				this.resolveUrl(url);
			}
		});

		proc.stderr.on("data", (data: Buffer) => {
			this.options.onStderr?.(data.toString("utf-8"));
		});

		proc.on("error", (err) => {
			this.rejectUrl(new Error(`Failed to start backend: ${err.message}`));
		});

		proc.on("exit", (code) => {
			if (!this.resolvedUrl) {
				this.rejectUrl(new Error(`Backend exited with code ${code} before becoming ready`));
			} else {
				this.handleUnexpectedExit(code);
			}
		});
	}

	kill(): void {
		const proc = this.process;
		if (!proc) return;

		try {
			proc.kill("SIGTERM");
		} catch {
			// ignore
		}

		setTimeout(() => {
			try {
				proc.kill("SIGKILL");
			} catch {
				// ignore
			}
		}, KILL_TIMEOUT_MS);

		this.process = null;
	}

	private resolveUrl(url: string): void {
		if (this.resolvedUrl) return;
		this.resolvedUrl = url;
		this.urlResolve?.(url);
		this.urlResolve = null;
		this.urlReject = null;
	}

	private rejectUrl(err: Error): void {
		if (this.resolvedUrl) return;
		this.urlReject?.(err);
		this.urlResolve = null;
		this.urlReject = null;
		this.urlPromise = null;
	}

	private appendStdout(text: string): void {
		this.stdoutBuffer += text;
		if (this.stdoutBuffer.length > MAX_STDOUT_BUFFER_SIZE) {
			this.stdoutBuffer = this.stdoutBuffer.slice(-MAX_STDOUT_BUFFER_SIZE);
		}
	}

	private parseUrl(): string | null {
		const match = DASHBOARD_URL_REGEX.exec(this.stdoutBuffer);
		return match ? match[1].replace(/\/$/, "") : null;
	}

	private handleUnexpectedExit(code: number | null): void {
		this.process = null;
		this.resolvedUrl = null;
		this.urlPromise = null;
		this.options.onUnexpectedExit?.(code);
	}
}
