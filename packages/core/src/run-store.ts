import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
	SubAgentRunListFilters,
	SubAgentRunRecord,
	SubAgentRunStore as SubAgentRunStoreContract,
} from "./types.js";

const SUBAGENT_RUN_VERSION = 1;

export class SubAgentRunStore implements SubAgentRunStoreContract {
	constructor(private readonly cwd: string) {}

	private getDir(): string {
		return join(this.cwd, ".pi", "subagents", "runs");
	}

	getPath(sessionId: string, taskId: string): string {
		return join(this.getDir(), sessionId, `${taskId}.json`);
	}

	async read(sessionId: string, taskId: string): Promise<SubAgentRunRecord | null> {
		const path = this.getPath(sessionId, taskId);
		try {
			return parseRecord(await readFile(path, "utf8"), path);
		} catch (err) {
			if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
				return null;
			}
			throw err;
		}
	}

	async list(filters: SubAgentRunListFilters = {}): Promise<SubAgentRunRecord[]> {
		const paths = await this.listRecordPaths();
		const records: SubAgentRunRecord[] = [];
		for (const path of paths) {
			const record = parseRecord(await readFile(path, "utf8"), path);
			if (!matchesFilters(record, filters)) continue;
			records.push(record);
		}
		return records.sort((a, b) => b.updatedAt - a.updatedAt || b.startedAt - a.startedAt);
	}

	async start(input: Parameters<SubAgentRunStoreContract["start"]>[0]): Promise<SubAgentRunRecord> {
		const now = input.startedAt ?? Date.now();
		const record: SubAgentRunRecord = {
			version: SUBAGENT_RUN_VERSION,
			sessionId: input.sessionId,
			sessionFile: input.sessionFile,
			taskId: input.taskId,
			instanceId: input.instanceId,
			definitionName: input.definitionName,
			cwd: input.cwd,
			parentThreadId: input.parentThreadId,
			parentToolCallId: input.parentToolCallId,
			runId: input.runId,
			runIndex: input.runIndex,
			description: input.description,
			prompt: input.prompt,
			systemPrompt: input.systemPrompt,
			modelProvider: input.modelProvider,
			modelId: input.modelId,
			status: "running",
			startedAt: now,
			updatedAt: now,
			turnCount: 0,
			toolCount: 0,
		};
		await this.write(record);
		return record;
	}

	async complete(input: Parameters<SubAgentRunStoreContract["complete"]>[0]): Promise<SubAgentRunRecord | null> {
		const current = await this.read(input.sessionId, input.taskId);
		if (!current) return null;
		const now = input.completedAt ?? Date.now();
		const updated: SubAgentRunRecord = {
			...current,
			status: input.status,
			summary: input.summary,
			recordedResult: input.recordedResult,
			error: input.error,
			modelProvider: input.modelProvider ?? current.modelProvider,
			modelId: input.modelId ?? current.modelId,
			completedAt: now,
			updatedAt: now,
			turnCount: input.turnCount,
			toolCount: input.toolCount,
		};
		await this.write(updated);
		return updated;
	}

	private async write(record: SubAgentRunRecord): Promise<void> {
		const path = this.getPath(record.sessionId, record.taskId);
		await mkdir(dirname(path), { recursive: true });
		const tmp = `${path}.tmp.${process.pid}`;
		await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
		await rename(tmp, path);
	}

	private async listRecordPaths(): Promise<string[]> {
		const root = this.getDir();
		try {
			const sessionDirs = await readdir(root, { withFileTypes: true });
			const result: string[] = [];
			for (const sessionDir of sessionDirs) {
				if (!sessionDir.isDirectory()) continue;
				const sessionPath = join(root, sessionDir.name);
				const files = await readdir(sessionPath, { withFileTypes: true });
				for (const file of files) {
					if (!file.isFile() || !file.name.endsWith(".json")) continue;
					result.push(join(sessionPath, file.name));
				}
			}
			return result;
		} catch (err) {
			if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
				return [];
			}
			throw err;
		}
	}
}

function matchesFilters(record: SubAgentRunRecord, filters: SubAgentRunListFilters): boolean {
	if (filters.status && record.status !== filters.status) return false;
	if (filters.runId && record.runId !== filters.runId) return false;
	if (filters.definitionName && record.definitionName !== filters.definitionName) return false;
	if (filters.sessionId && record.sessionId !== filters.sessionId) return false;
	if (filters.parentThreadId && record.parentThreadId !== filters.parentThreadId) return false;
	if (filters.parentToolCallId && record.parentToolCallId !== filters.parentToolCallId) return false;
	return true;
}

function parseRecord(raw: string, path: string): SubAgentRunRecord {
	const parsed = JSON.parse(raw) as unknown;
	if (!parsed || typeof parsed !== "object") {
		throw new Error(`Invalid subagent run record at ${path}`);
	}
	const record = parsed as SubAgentRunRecord;
	if (
		record.version !== SUBAGENT_RUN_VERSION ||
		typeof record.sessionId !== "string" ||
		typeof record.taskId !== "string" ||
		typeof record.instanceId !== "string" ||
		typeof record.definitionName !== "string" ||
		typeof record.cwd !== "string" ||
		typeof record.prompt !== "string" ||
		typeof record.startedAt !== "number" ||
		typeof record.updatedAt !== "number" ||
		typeof record.turnCount !== "number" ||
		typeof record.toolCount !== "number"
	) {
		throw new Error(`Invalid subagent run record shape at ${path}`);
	}
	return record;
}
