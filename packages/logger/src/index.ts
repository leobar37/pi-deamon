import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type LogEntryType = "event" | "state" | "tool" | "error" | "turn" | "lifecycle";
export type LogEntrySource = "lion" | "subagent";

export interface LogEntry {
	timestamp: number;
	type: LogEntryType;
	source: LogEntrySource;
	data: unknown;
}

export interface SessionLoggerOptions {
	cwd: string;
	sessionId: string;
	/** Subdirectory inside cwd for log files. Default: ".lion/runs" */
	logDir?: string;
}

export class SessionLogger {
	private readonly cwd: string;
	private readonly sessionId: string;
	private readonly logDir: string;
	private pending: Promise<void> = Promise.resolve();

	constructor(options: SessionLoggerOptions) {
		this.cwd = options.cwd;
		this.sessionId = options.sessionId;
		this.logDir = options.logDir ?? ".lion/runs";
	}

	log(entry: Omit<LogEntry, "timestamp">): void {
		const fullEntry: LogEntry = {
			...entry,
			timestamp: Date.now(),
		};
		const promise = this.pending.then(async () => {
			const dir = join(this.cwd, this.logDir);
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}
			const filePath = join(dir, `${this.sessionId}.jsonl`);
			await appendFile(filePath, `${JSON.stringify(fullEntry)}\n`, "utf-8");
		});
		this.pending = promise.catch(() => {});
	}

	static async readSession(cwd: string, sessionId: string, logDir = ".lion/runs"): Promise<LogEntry[]> {
		const filePath = join(cwd, logDir, `${sessionId}.jsonl`);
		if (!existsSync(filePath)) {
			return [];
		}
		const content = await readFile(filePath, "utf-8");
		const lines = content.trim().split("\n").filter(Boolean);
		const entries: LogEntry[] = [];
		for (const line of lines) {
			try {
				entries.push(JSON.parse(line) as LogEntry);
			} catch {
				// Skip malformed lines
			}
		}
		return entries;
	}
}
