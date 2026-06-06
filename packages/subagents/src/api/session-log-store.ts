import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export type DashboardLogLevel = "debug" | "info" | "warn" | "error";

export interface DashboardLogEntry {
	timestamp: number;
	sessionId: string;
	threadId?: string;
	type: string;
	source: string;
	level: DashboardLogLevel;
	data: Record<string, unknown>;
}

export interface DashboardLogQuery {
	sessionId?: string;
	threadId?: string;
	type?: string;
	level?: DashboardLogLevel;
	since?: number;
	until?: number;
	limit?: number;
}

export interface DashboardLogSessionSummary {
	sessionId: string;
	entryCount: number;
	firstTimestamp: number | null;
	lastTimestamp: number | null;
	updatedAt: number;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export class DashboardSessionLogStore {
	private pending = Promise.resolve();

	constructor(
		private readonly cwd: string,
		private readonly logDir = ".pi/dashboard/logs",
	) {}

	append(entry: Omit<DashboardLogEntry, "timestamp"> & { timestamp?: number }): Promise<void> {
		const fullEntry: DashboardLogEntry = {
			...entry,
			timestamp: entry.timestamp ?? Date.now(),
		};
		const promise = this.pending.then(async () => {
			const path = this.sessionPath(fullEntry.sessionId);
			const dir = dirname(path);
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}
			await appendFile(path, `${JSON.stringify(fullEntry)}\n`, "utf-8");
		});
		this.pending = promise.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`[DashboardSessionLogStore] Write failed: ${message}`);
		});
		return promise;
	}

	async query(input: DashboardLogQuery): Promise<DashboardLogEntry[]> {
		const sessionIds = input.sessionId ? [input.sessionId] : await this.listSessionIds();
		const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
		const entries: DashboardLogEntry[] = [];

		for (const sessionId of sessionIds) {
			const sessionEntries = await this.readSession(sessionId);
			for (const entry of sessionEntries) {
				if (!matchesLogQuery(entry, input)) continue;
				entries.push(entry);
			}
		}

		entries.sort((a, b) => b.timestamp - a.timestamp);
		return entries.slice(0, limit);
	}

	async list(): Promise<DashboardLogSessionSummary[]> {
		const sessionIds = await this.listSessionIds();
		const summaries: DashboardLogSessionSummary[] = [];
		for (const sessionId of sessionIds) {
			const entries = await this.readSession(sessionId);
			const fileStat = await stat(this.sessionPath(sessionId)).catch(() => null);
			summaries.push({
				sessionId,
				entryCount: entries.length,
				firstTimestamp: entries.at(-1)?.timestamp ?? null,
				lastTimestamp: entries[0]?.timestamp ?? null,
				updatedAt: fileStat?.mtimeMs ?? 0,
			});
		}
		return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	private async readSession(sessionId: string): Promise<DashboardLogEntry[]> {
		const path = this.sessionPath(sessionId);
		if (!existsSync(path)) return [];
		const content = await readFile(path, "utf-8");
		const entries: DashboardLogEntry[] = [];
		for (const line of content.split("\n")) {
			if (!line.trim()) continue;
			try {
				const parsed = JSON.parse(line) as unknown;
				if (isDashboardLogEntry(parsed)) entries.push(parsed);
			} catch {
				// Skip malformed lines so one bad write does not break the endpoint.
			}
		}
		return entries.sort((a, b) => b.timestamp - a.timestamp);
	}

	private async listSessionIds(): Promise<string[]> {
		const dir = join(this.cwd, this.logDir);
		if (!existsSync(dir)) return [];
		const entries = await readdir(dir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
			.map((entry) => entry.name.slice(0, -6));
	}

	private sessionPath(sessionId: string): string {
		return join(this.cwd, this.logDir, `${sessionId}.jsonl`);
	}
}

function matchesLogQuery(entry: DashboardLogEntry, query: DashboardLogQuery): boolean {
	if (query.threadId && entry.threadId !== query.threadId) return false;
	if (query.type && entry.type !== query.type) return false;
	if (query.level && entry.level !== query.level) return false;
	if (query.since !== undefined && entry.timestamp < query.since) return false;
	if (query.until !== undefined && entry.timestamp > query.until) return false;
	return true;
}

function isDashboardLogEntry(value: unknown): value is DashboardLogEntry {
	if (!value || typeof value !== "object") return false;
	const entry = value as Partial<DashboardLogEntry>;
	return (
		typeof entry.timestamp === "number" &&
		typeof entry.sessionId === "string" &&
		typeof entry.type === "string" &&
		typeof entry.source === "string" &&
		(entry.level === "debug" || entry.level === "info" || entry.level === "warn" || entry.level === "error") &&
		typeof entry.data === "object" &&
		entry.data !== null
	);
}
