import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { LogEntry, LogEntrySource, LogEntryType } from "@local/pi-logger";

// =============================================================================
// Run Logger — Structured logging per run with folder-based organization
//
// Structure:
//   .lion/runs/
//     <run-id>/
//       main.jsonl        — High-signal events only (lifecycle, tasks, errors)
//       subagents/
//         <task-id>.jsonl — Full subagent event stream (thinking deltas, etc.)
//       meta.json         — Run metadata (start, end, status, summary)
// =============================================================================

export interface RunLoggerOptions {
	cwd: string;
	runId: string;
	/** Base directory for logs. Default: ".lion/runs" */
	logDir?: string;
	/** Max age in days before compressing old runs. Default: 7 */
	compressAfterDays?: number;
}

export interface RunMeta {
	runId: string;
	startedAt: number;
	endedAt?: number;
	status?: "running" | "completed" | "failed" | "cancelled" | "interrupted";
	reason?: string;
	tasksTotal: number;
	tasksCompleted: number;
	tasksFailed: number;
	tasksPending: number;
	planSlug?: string | null;
	planPath?: string | null;
}

export interface HeartbeatEntry {
	type: "heartbeat";
	timestamp: number;
	status: string;
	activeTaskId?: string | null;
	pendingTasks: number;
	runningTasks: number;
}

export interface RunCompleteEntry {
	type: "run.complete";
	timestamp: number;
	status: RunMeta["status"];
	reason?: string;
	durationMs: number;
	tasksCompleted: number;
	tasksFailed: number;
	tasksPending: number;
}

export interface RunInterruptedEntry {
	type: "run.interrupted";
	timestamp: number;
	signal?: string;
	reason?: string;
}

export type MainLogEntry = LogEntry | HeartbeatEntry | RunCompleteEntry | RunInterruptedEntry;

export class RunLogger {
	readonly cwd: string;
	readonly runId: string;
	readonly logDir: string;
	readonly compressAfterDays: number;
	private pending: Promise<void> = Promise.resolve();
	private meta: RunMeta;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private _closed = false;

	get closed(): boolean {
		return this._closed;
	}

	constructor(options: RunLoggerOptions) {
		this.cwd = options.cwd;
		this.runId = options.runId;
		this.logDir = options.logDir ?? ".lion/runs";
		this.compressAfterDays = options.compressAfterDays ?? 7;
		this.meta = {
			runId: options.runId,
			startedAt: Date.now(),
			status: "running",
			tasksTotal: 0,
			tasksCompleted: 0,
			tasksFailed: 0,
			tasksPending: 0,
		};
		// Ensure run directory exists synchronously so callers can rely on it
		const dir = this.runDir;
		if (!existsSync(dir)) {
			// Fire-and-forget is acceptable here; errors are logged to stderr
			mkdir(dir, { recursive: true }).catch((err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`[RunLogger] Failed to create run directory ${dir}: ${message}`);
			});
		}
		this.writeMeta();
	}

	// ---------------------------------------------------------------------------
	// Main log — high-signal events only
	// ---------------------------------------------------------------------------
	logMain(entry: Omit<MainLogEntry, "timestamp"> & Record<string, unknown>): void {
		if (this._closed) return;
		const fullEntry = { ...entry, timestamp: Date.now() } as MainLogEntry;
		this.queueWrite(this.mainFilePath, `${JSON.stringify(fullEntry)}\n`);
	}

	// ---------------------------------------------------------------------------
	// Subagent log — full event stream per task
	// ---------------------------------------------------------------------------
	logSubagent(taskId: string, entry: Omit<LogEntry, "timestamp">): void {
		if (this._closed) return;
		const fullEntry: LogEntry = { ...entry, timestamp: Date.now() };
		this.queueWrite(this.subagentFilePath(taskId), `${JSON.stringify(fullEntry)}\n`);
	}

	// ---------------------------------------------------------------------------
	// Convenience methods for lion events
	// ---------------------------------------------------------------------------
	logEvent(source: LogEntrySource, type: LogEntryType, data: unknown): void {
		this.logMain({ type, source, data } as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
	}

	logState(action: string, state: Record<string, unknown>): void {
		this.logMain({ type: "state", source: "lion", data: { action, ...state } } as Omit<MainLogEntry, "timestamp"> &
			Record<string, unknown>);
	}

	logTool(toolName: string, params: unknown, result?: unknown): void {
		this.logMain({ type: "tool", source: "lion", data: { toolName, params, result } } as Omit<
			MainLogEntry,
			"timestamp"
		> &
			Record<string, unknown>);
	}

	logError(context: string, error: unknown): void {
		this.logMain({
			type: "error",
			source: "lion",
			data: {
				context,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
		} as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
	}

	// ---------------------------------------------------------------------------
	// Run lifecycle
	// ---------------------------------------------------------------------------
	startRun(meta: Partial<RunMeta>): void {
		this.meta = { ...this.meta, ...meta, runId: this.runId, startedAt: this.meta.startedAt };
		this.writeMeta();
	}

	completeRun(status: Exclude<RunMeta["status"], "running">, reason?: string): void {
		if (this.closed) return;
		const now = Date.now();
		const durationMs = now - this.meta.startedAt;
		this.meta = {
			...this.meta,
			endedAt: now,
			status,
			reason,
		};
		const entry: Omit<RunCompleteEntry, "timestamp"> = {
			type: "run.complete",
			status,
			reason,
			durationMs,
			tasksCompleted: this.meta.tasksCompleted,
			tasksFailed: this.meta.tasksFailed,
			tasksPending: this.meta.tasksPending,
		};
		this.logMain(entry as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
		this.writeMeta();
		this.stopHeartbeat();
		this._closed = true;
		this.triggerCompression();
	}

	interruptRun(signal?: string, reason?: string): void {
		if (this._closed) return;
		this.meta = { ...this.meta, endedAt: Date.now(), status: "interrupted", reason: reason ?? `Signal: ${signal}` };
		const entry: Omit<RunInterruptedEntry, "timestamp"> = { type: "run.interrupted", signal, reason };
		this.logMain(entry as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
		this.writeMeta();
		this.stopHeartbeat();
		this._closed = true;
		this.triggerCompression();
	}

	updateTaskCounts(completed: number, failed: number, pending: number, total: number): void {
		this.meta = {
			...this.meta,
			tasksCompleted: completed,
			tasksFailed: failed,
			tasksPending: pending,
			tasksTotal: total,
		};
		this.writeMeta();
	}

	// ---------------------------------------------------------------------------
	// Heartbeat
	// ---------------------------------------------------------------------------
	startHeartbeat(intervalMs = 30000): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			if (this._closed) return;
			this.logMain({
				type: "heartbeat",
				status: this.meta.status ?? "unknown",
				activeTaskId: null,
				pendingTasks: this.meta.tasksPending,
				runningTasks: Math.max(0, this.meta.tasksTotal - this.meta.tasksCompleted - this.meta.tasksFailed),
			} as Omit<MainLogEntry, "timestamp"> & Record<string, unknown>);
		}, intervalMs);
		// Allow Node process to exit even if heartbeat is running
		this.heartbeatTimer.unref();
	}

	stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Paths
	// ---------------------------------------------------------------------------
	private get runDir(): string {
		return join(this.cwd, this.logDir, this.runId);
	}

	private get mainFilePath(): string {
		return join(this.runDir, "main.jsonl");
	}

	private get metaFilePath(): string {
		return join(this.runDir, "meta.json");
	}

	private subagentFilePath(taskId: string): string {
		return join(this.runDir, "subagents", `${taskId}.jsonl`);
	}

	// ---------------------------------------------------------------------------
	// I/O
	// ---------------------------------------------------------------------------
	private queueWrite(filePath: string, content: string): void {
		const promise = this.pending.then(async () => {
			const dir = dirname(filePath);
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}
			await appendFile(filePath, content, "utf-8");
		});
		this.pending = promise.catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[RunLogger] Write failed for ${filePath}: ${message}`);
		});
	}

	private writeMeta(): void {
		const promise = this.pending.then(async () => {
			if (!existsSync(this.runDir)) {
				await mkdir(this.runDir, { recursive: true });
			}
			await writeFile(this.metaFilePath, `${JSON.stringify(this.meta)}\n`, "utf-8");
		});
		this.pending = promise.catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[RunLogger] Meta write failed: ${message}`);
		});
	}

	// ---------------------------------------------------------------------------
	// Compression of old runs
	// ---------------------------------------------------------------------------
	private async triggerCompression(): Promise<void> {
		// Wait for all pending writes to flush before compressing
		try {
			await this.pending;
		} catch {
			/* errors already logged to stderr */
		}
		try {
			await this.compressOldRuns();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[RunLogger] Compression failed: ${message}`);
		}
	}

	private async compressOldRuns(): Promise<void> {
		const runsDir = join(this.cwd, this.logDir);
		if (!existsSync(runsDir)) return;

		const entries = await readdir(runsDir, { withFileTypes: true });
		const cutoff = Date.now() - this.compressAfterDays * 24 * 60 * 60 * 1000;

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const runPath = join(runsDir, entry.name);
			const metaPath = join(runPath, "meta.json");

			// Skip non-directory entries (e.g. .tar.gz archives)
			if (!entry.isDirectory()) continue;

			// Check if this is the current run
			if (entry.name === this.runId) continue;

			let runEndedAt = 0;
			try {
				const s = await stat(metaPath);
				runEndedAt = s.mtimeMs;
			} catch {
				// No meta file — skip compression, cannot determine age reliably
				continue;
			}

			if (runEndedAt < cutoff) {
				await this.compressRun(runPath);
			}
		}
	}

	private async compressRun(runPath: string): Promise<void> {
		const archivePath = `${runPath}.tar.gz`;
		const runName = basename(runPath);
		const parentDir = dirname(runPath);

		await new Promise<void>((resolve, reject) => {
			const child = spawn("tar", ["-czf", archivePath, "-C", parentDir, runName], {
				stdio: "ignore",
			});
			child.on("error", reject);
			child.on("close", (code) => {
				if (code === 0) resolve();
				else reject(new Error(`tar exited with code ${code}`));
			});
		});

		// Remove original directory after successful compression
		await rm(runPath, { recursive: true, force: true });
	}

	// ---------------------------------------------------------------------------
	// Static helpers
	// ---------------------------------------------------------------------------
	static async readRunMeta(cwd: string, runId: string, logDir = ".lion/runs"): Promise<RunMeta | null> {
		const metaPath = join(cwd, logDir, runId, "meta.json");
		if (!existsSync(metaPath)) return null;
		const { readFile } = await import("node:fs/promises");
		const content = await readFile(metaPath, "utf-8");
		const lines = content.trim().split("\n").filter(Boolean);
		if (lines.length === 0) return null;
		try {
			return JSON.parse(lines[lines.length - 1]) as RunMeta;
		} catch {
			return null;
		}
	}

	static async listRuns(cwd: string, logDir = ".lion/runs"): Promise<Array<{ runId: string; meta: RunMeta | null }>> {
		const runsDir = join(cwd, logDir);
		if (!existsSync(runsDir)) return [];
		const { readdir } = await import("node:fs/promises");
		const entries = await readdir(runsDir, { withFileTypes: true });
		const runs: Array<{ runId: string; meta: RunMeta | null }> = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			runs.push({
				runId: entry.name,
				meta: await RunLogger.readRunMeta(cwd, entry.name, logDir),
			});
		}
		return runs.sort((a, b) => (b.meta?.startedAt ?? 0) - (a.meta?.startedAt ?? 0));
	}
}
