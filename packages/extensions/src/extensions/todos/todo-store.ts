import crypto from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { clearAssignmentIfClosed, formatTodoId, isTodoClosed, sortTodos, validateTodoId } from "./format.js";
import {
	DEFAULT_TODO_SETTINGS,
	LOCK_TTL_MS,
	type LockInfo,
	TODO_DIR_NAME,
	TODO_PATH_ENV,
	TODO_SETTINGS_NAME,
	type TodoFrontMatter,
	type TodoRecord,
	type TodoSettings,
} from "./types.js";

export function resolveTodosDir(cwd: string): string {
	const overridePath = process.env[TODO_PATH_ENV];
	if (overridePath?.trim()) {
		return path.resolve(cwd, overridePath.trim());
	}
	return path.resolve(cwd, TODO_DIR_NAME);
}

export function resolveTodosDirLabel(cwd: string): string {
	const overridePath = process.env[TODO_PATH_ENV];
	if (overridePath?.trim()) {
		return path.resolve(cwd, overridePath.trim());
	}
	return TODO_DIR_NAME;
}

function getTodoSettingsPath(todosDir: string): string {
	return path.join(todosDir, TODO_SETTINGS_NAME);
}

function normalizeTodoSettings(raw: Partial<TodoSettings>): TodoSettings {
	const gc = raw.gc ?? DEFAULT_TODO_SETTINGS.gc;
	const gcDays =
		typeof raw.gcDays === "number" && Number.isFinite(raw.gcDays) ? raw.gcDays : DEFAULT_TODO_SETTINGS.gcDays;
	return {
		gc: Boolean(gc),
		gcDays: Math.max(0, Math.floor(gcDays)),
	};
}

function findJsonObjectEnd(content: string): number {
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < content.length; i += 1) {
		const char = content[i];

		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
			continue;
		}

		if (char === "{") {
			depth += 1;
			continue;
		}

		if (char === "}") {
			depth -= 1;
			if (depth === 0) return i;
		}
	}

	return -1;
}

function splitFrontMatter(content: string): { frontMatter: string; body: string } {
	if (!content.startsWith("{")) {
		return { frontMatter: "", body: content };
	}

	const endIndex = findJsonObjectEnd(content);
	if (endIndex === -1) {
		return { frontMatter: "", body: content };
	}

	const frontMatter = content.slice(0, endIndex + 1);
	const body = content.slice(endIndex + 1).replace(/^\r?\n+/, "");
	return { frontMatter, body };
}

function parseFrontMatter(text: string, idFallback: string): TodoFrontMatter {
	const data: TodoFrontMatter = {
		id: idFallback,
		title: "",
		tags: [],
		status: "open",
		created_at: "",
		assigned_to_session: undefined,
	};

	const trimmed = text.trim();
	if (!trimmed) return data;

	try {
		const parsed = JSON.parse(trimmed) as Partial<TodoFrontMatter> | null;
		if (!parsed || typeof parsed !== "object") return data;
		if (typeof parsed.id === "string" && parsed.id) data.id = parsed.id;
		if (typeof parsed.title === "string") data.title = parsed.title;
		if (typeof parsed.status === "string" && parsed.status) data.status = parsed.status;
		if (typeof parsed.created_at === "string") data.created_at = parsed.created_at;
		if (typeof parsed.assigned_to_session === "string" && parsed.assigned_to_session.trim()) {
			data.assigned_to_session = parsed.assigned_to_session;
		}
		if (Array.isArray(parsed.tags)) {
			data.tags = parsed.tags.filter((tag): tag is string => typeof tag === "string");
		}
	} catch {
		return data;
	}

	return data;
}

function parseTodoContent(content: string, idFallback: string): TodoRecord {
	const { frontMatter, body } = splitFrontMatter(content);
	const parsed = parseFrontMatter(frontMatter, idFallback);
	return {
		id: idFallback,
		title: parsed.title,
		tags: parsed.tags ?? [],
		status: parsed.status,
		created_at: parsed.created_at,
		assigned_to_session: parsed.assigned_to_session,
		body: body ?? "",
	};
}

function serializeTodo(todo: TodoRecord): string {
	const frontMatter = JSON.stringify(
		{
			id: todo.id,
			title: todo.title,
			tags: todo.tags ?? [],
			status: todo.status,
			created_at: todo.created_at,
			assigned_to_session: todo.assigned_to_session || undefined,
		},
		null,
		2,
	);

	const body = todo.body ?? "";
	const trimmedBody = body.replace(/^\n+/, "").replace(/\s+$/, "");
	if (!trimmedBody) return `${frontMatter}\n`;
	return `${frontMatter}\n\n${trimmedBody}\n`;
}

export class TodoStore {
	constructor(
		readonly todosDir: string,
		private lockStealCallback?: (todoId: string) => Promise<boolean>,
	) {}

	async ensureDir(): Promise<void> {
		await fs.mkdir(this.todosDir, { recursive: true });
	}

	async readSettings(): Promise<TodoSettings> {
		const settingsPath = getTodoSettingsPath(this.todosDir);
		let data: Partial<TodoSettings> = {};

		try {
			const raw = await fs.readFile(settingsPath, "utf8");
			data = JSON.parse(raw) as Partial<TodoSettings>;
		} catch {
			data = {};
		}

		return normalizeTodoSettings(data);
	}

	async gc(settings: TodoSettings): Promise<void> {
		if (!settings.gc) return;

		let entries: string[] = [];
		try {
			entries = await fs.readdir(this.todosDir);
		} catch {
			return;
		}

		const cutoff = Date.now() - settings.gcDays * 24 * 60 * 60 * 1000;
		await Promise.all(
			entries
				.filter((entry) => entry.endsWith(".md"))
				.map(async (entry) => {
					const id = entry.slice(0, -3);
					const filePath = this.getTodoPath(id);
					try {
						const content = await fs.readFile(filePath, "utf8");
						const { frontMatter } = splitFrontMatter(content);
						const parsed = parseFrontMatter(frontMatter, id);
						if (!isTodoClosed(parsed.status)) return;
						const createdAt = Date.parse(parsed.created_at);
						if (!Number.isFinite(createdAt)) return;
						if (createdAt < cutoff) {
							await fs.unlink(filePath);
						}
					} catch {
						// ignore unreadable todo
					}
				}),
		);
	}

	async list(): Promise<TodoFrontMatter[]> {
		let entries: string[] = [];
		try {
			entries = await fs.readdir(this.todosDir);
		} catch {
			return [];
		}

		const todos: TodoFrontMatter[] = [];
		for (const entry of entries) {
			if (!entry.endsWith(".md")) continue;
			const id = entry.slice(0, -3);
			const filePath = this.getTodoPath(id);
			try {
				const content = await fs.readFile(filePath, "utf8");
				const { frontMatter } = splitFrontMatter(content);
				const parsed = parseFrontMatter(frontMatter, id);
				todos.push({
					id,
					title: parsed.title,
					tags: parsed.tags ?? [],
					status: parsed.status,
					created_at: parsed.created_at,
					assigned_to_session: parsed.assigned_to_session,
				});
			} catch {
				// ignore unreadable todo
			}
		}

		return sortTodos(todos);
	}

	listSync(): TodoFrontMatter[] {
		let entries: string[] = [];
		try {
			entries = readdirSync(this.todosDir);
		} catch {
			return [];
		}

		const todos: TodoFrontMatter[] = [];
		for (const entry of entries) {
			if (!entry.endsWith(".md")) continue;
			const id = entry.slice(0, -3);
			const filePath = this.getTodoPath(id);
			try {
				const content = readFileSync(filePath, "utf8");
				const { frontMatter } = splitFrontMatter(content);
				const parsed = parseFrontMatter(frontMatter, id);
				todos.push({
					id,
					title: parsed.title,
					tags: parsed.tags ?? [],
					status: parsed.status,
					created_at: parsed.created_at,
					assigned_to_session: parsed.assigned_to_session,
				});
			} catch {
				// ignore
			}
		}

		return sortTodos(todos);
	}

	async get(id: string): Promise<TodoRecord | null> {
		const validated = validateTodoId(id);
		if ("error" in validated) return null;
		const filePath = this.getTodoPath(validated.id);
		if (!existsSync(filePath)) return null;
		return this.readTodoFile(filePath, validated.id);
	}

	async create(
		title: string,
		tags: string[] = [],
		status = "open",
		body = "",
		sessionFile?: string | null,
	): Promise<TodoRecord> {
		await this.ensureDir();
		const id = await this.generateId();
		const filePath = this.getTodoPath(id);
		const todo: TodoRecord = {
			id,
			title,
			tags,
			status,
			created_at: new Date().toISOString(),
			body,
		};

		const result = await this.withLock(id, sessionFile, async () => {
			await fs.writeFile(filePath, serializeTodo(todo), "utf8");
			return todo;
		});

		if (typeof result === "object" && "error" in result) {
			throw new Error(result.error);
		}

		return result;
	}

	async update(
		id: string,
		fields: Partial<Pick<TodoFrontMatter, "title" | "status" | "tags"> & { body: string }>,
		sessionFile?: string | null,
	): Promise<TodoRecord | { error: string }> {
		const validated = validateTodoId(id);
		if ("error" in validated) return { error: validated.error };
		const normalizedId = validated.id;
		const filePath = this.getTodoPath(normalizedId);
		if (!existsSync(filePath)) return { error: `Todo ${formatTodoId(normalizedId)} not found` };

		return this.withLock(normalizedId, sessionFile, async () => {
			const existing = await this.ensureTodoExists(filePath, normalizedId);
			if (!existing) return { error: `Todo ${formatTodoId(normalizedId)} not found` } as const;

			if (fields.title !== undefined) existing.title = fields.title;
			if (fields.status !== undefined) existing.status = fields.status;
			if (fields.tags !== undefined) existing.tags = fields.tags;
			if (fields.body !== undefined) existing.body = fields.body;
			if (!existing.created_at) existing.created_at = new Date().toISOString();
			clearAssignmentIfClosed(existing);

			await fs.writeFile(filePath, serializeTodo(existing), "utf8");
			return existing;
		});
	}

	async appendBody(id: string, text: string, sessionFile?: string | null): Promise<TodoRecord | { error: string }> {
		const validated = validateTodoId(id);
		if ("error" in validated) return { error: validated.error };
		const normalizedId = validated.id;
		const filePath = this.getTodoPath(normalizedId);
		if (!existsSync(filePath)) return { error: `Todo ${formatTodoId(normalizedId)} not found` };

		return this.withLock(normalizedId, sessionFile, async () => {
			const existing = await this.ensureTodoExists(filePath, normalizedId);
			if (!existing) return { error: `Todo ${formatTodoId(normalizedId)} not found` } as const;
			if (!text || !text.trim()) return existing;

			const spacer = existing.body.trim().length ? "\n\n" : "";
			existing.body = `${existing.body.replace(/\s+$/, "")}${spacer}${text.trim()}\n`;
			await fs.writeFile(filePath, serializeTodo(existing), "utf8");
			return existing;
		});
	}

	async claim(
		id: string,
		sessionId: string,
		sessionFile?: string | null,
		force = false,
	): Promise<TodoRecord | { error: string }> {
		const validated = validateTodoId(id);
		if ("error" in validated) return { error: validated.error };
		const normalizedId = validated.id;
		const filePath = this.getTodoPath(normalizedId);
		if (!existsSync(filePath)) return { error: `Todo ${formatTodoId(normalizedId)} not found` };

		return this.withLock(normalizedId, sessionFile, async () => {
			const existing = await this.ensureTodoExists(filePath, normalizedId);
			if (!existing) return { error: `Todo ${formatTodoId(normalizedId)} not found` } as const;
			if (isTodoClosed(existing.status)) {
				return { error: `Todo ${formatTodoId(normalizedId)} is closed` } as const;
			}
			const assigned = existing.assigned_to_session;
			if (assigned && assigned !== sessionId && !force) {
				return {
					error: `Todo ${formatTodoId(normalizedId)} is already assigned to session ${assigned}. Use force to override.`,
				} as const;
			}
			if (assigned !== sessionId) {
				existing.assigned_to_session = sessionId;
				await fs.writeFile(filePath, serializeTodo(existing), "utf8");
			}
			return existing;
		});
	}

	async release(
		id: string,
		sessionId: string,
		sessionFile?: string | null,
		force = false,
	): Promise<TodoRecord | { error: string }> {
		const validated = validateTodoId(id);
		if ("error" in validated) return { error: validated.error };
		const normalizedId = validated.id;
		const filePath = this.getTodoPath(normalizedId);
		if (!existsSync(filePath)) return { error: `Todo ${formatTodoId(normalizedId)} not found` };

		return this.withLock(normalizedId, sessionFile, async () => {
			const existing = await this.ensureTodoExists(filePath, normalizedId);
			if (!existing) return { error: `Todo ${formatTodoId(normalizedId)} not found` } as const;
			const assigned = existing.assigned_to_session;
			if (!assigned) return existing;
			if (assigned !== sessionId && !force) {
				return {
					error: `Todo ${formatTodoId(normalizedId)} is assigned to session ${assigned}. Use force to release.`,
				} as const;
			}
			existing.assigned_to_session = undefined;
			await fs.writeFile(filePath, serializeTodo(existing), "utf8");
			return existing;
		});
	}

	async updateStatus(
		id: string,
		status: string,
		sessionFile?: string | null,
	): Promise<TodoRecord | { error: string }> {
		const validated = validateTodoId(id);
		if ("error" in validated) return { error: validated.error };
		const normalizedId = validated.id;
		const filePath = this.getTodoPath(normalizedId);
		if (!existsSync(filePath)) return { error: `Todo ${formatTodoId(normalizedId)} not found` };

		return this.withLock(normalizedId, sessionFile, async () => {
			const existing = await this.ensureTodoExists(filePath, normalizedId);
			if (!existing) return { error: `Todo ${formatTodoId(normalizedId)} not found` } as const;
			existing.status = status;
			clearAssignmentIfClosed(existing);
			await fs.writeFile(filePath, serializeTodo(existing), "utf8");
			return existing;
		});
	}

	async delete(id: string, sessionFile?: string | null): Promise<TodoRecord | { error: string }> {
		const validated = validateTodoId(id);
		if ("error" in validated) return { error: validated.error };
		const normalizedId = validated.id;
		const filePath = this.getTodoPath(normalizedId);
		if (!existsSync(filePath)) return { error: `Todo ${formatTodoId(normalizedId)} not found` };

		return this.withLock(normalizedId, sessionFile, async () => {
			const existing = await this.ensureTodoExists(filePath, normalizedId);
			if (!existing) return { error: `Todo ${formatTodoId(normalizedId)} not found` } as const;
			await fs.unlink(filePath);
			return existing;
		});
	}

	getTodoPath(id: string): string {
		return path.join(this.todosDir, `${id}.md`);
	}

	private getLockPath(id: string): string {
		return path.join(this.todosDir, `${id}.lock`);
	}

	private async readTodoFile(filePath: string, idFallback: string): Promise<TodoRecord> {
		const content = await fs.readFile(filePath, "utf8");
		return parseTodoContent(content, idFallback);
	}

	private async ensureTodoExists(filePath: string, id: string): Promise<TodoRecord | null> {
		if (!existsSync(filePath)) return null;
		return this.readTodoFile(filePath, id);
	}

	private async generateId(): Promise<string> {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const id = crypto.randomBytes(4).toString("hex");
			const todoPath = this.getTodoPath(id);
			if (!existsSync(todoPath)) return id;
		}
		throw new Error("Failed to generate unique todo id");
	}

	private async readLockInfo(lockPath: string): Promise<LockInfo | null> {
		try {
			const raw = await fs.readFile(lockPath, "utf8");
			return JSON.parse(raw) as LockInfo;
		} catch {
			return null;
		}
	}

	private async acquireLock(id: string, session?: string | null): Promise<(() => Promise<void>) | { error: string }> {
		const lockPath = this.getLockPath(id);
		const now = Date.now();

		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const handle = await fs.open(lockPath, "wx");
				const info: LockInfo = {
					id,
					pid: process.pid,
					session,
					created_at: new Date(now).toISOString(),
				};
				await handle.writeFile(JSON.stringify(info, null, 2), "utf8");
				await handle.close();
				return async () => {
					try {
						await fs.unlink(lockPath);
					} catch {
						// ignore
					}
				};
			} catch (error: any) {
				if (error?.code !== "EEXIST") {
					return { error: `Failed to acquire lock: ${error?.message ?? "unknown error"}` };
				}
				const stats = await fs.stat(lockPath).catch(() => null);
				const lockAge = stats ? now - stats.mtimeMs : LOCK_TTL_MS + 1;
				if (lockAge <= LOCK_TTL_MS) {
					const info = await this.readLockInfo(lockPath);
					const owner = info?.session ? ` (session ${info.session})` : "";
					return { error: `Todo ${formatTodoId(id)} is locked${owner}. Try again later.` };
				}
				if (!this.lockStealCallback) {
					return { error: `Todo ${formatTodoId(id)} lock is stale; rerun in interactive mode to steal it.` };
				}
				const ok = await this.lockStealCallback(formatTodoId(id));
				if (!ok) {
					return { error: `Todo ${formatTodoId(id)} remains locked.` };
				}
				await fs.unlink(lockPath).catch(() => undefined);
			}
		}

		return { error: `Failed to acquire lock for todo ${formatTodoId(id)}.` };
	}

	private async withLock<T>(
		id: string,
		session: string | null | undefined,
		fn: () => Promise<T>,
	): Promise<T | { error: string }> {
		const lock = await this.acquireLock(id, session);
		if (typeof lock === "object" && "error" in lock) return lock;
		try {
			return await fn();
		} finally {
			await lock();
		}
	}
}
