import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { LionPlan, LionPlanContent, LionTask, LionTaskStatus } from "../types.js";
import { LionChecklistFile } from "./checklist.js";

interface StructuredPlan {
	kind: "structured";
	slug: string;
	rootPath: string;
	indexFile: string;
	contextFile: string;
	requirementsFile: string;
	checklistFile?: string;
	tasks: LionPlan["tasks"];
}

export class StructuredLionPlanFile {
	constructor(private rootPath: string) {}

	loadPlan(): StructuredPlan {
		const cwd = resolve(this.rootPath);
		const contextFile = join(cwd, "context.md");
		const requirementsFile = join(cwd, "requirements.md");
		const taskIndexFile = join(cwd, "task-index.md");
		const checklistFile = join(cwd, "checklist.json");

		if (!existsSync(contextFile)) {
			throw new Error(`Required plan file missing: context.md in ${cwd}`);
		}
		if (!existsSync(requirementsFile)) {
			throw new Error(`Required plan file missing: requirements.md in ${cwd}`);
		}
		if (!existsSync(taskIndexFile)) {
			throw new Error(`Required plan file missing: task-index.md in ${cwd}`);
		}

		const tasks: LionPlan["tasks"] = [];

		if (existsSync(checklistFile)) {
			const checklist = new LionChecklistFile(checklistFile);
			tasks.push(...checklist.loadTasks());
		} else {
			tasks.push(...loadMarkdownTasks(cwd));
		}

		return {
			kind: "structured",
			slug: "plan",
			rootPath: cwd,
			indexFile: taskIndexFile,
			contextFile,
			requirementsFile,
			checklistFile: existsSync(checklistFile) ? checklistFile : undefined,
			tasks,
		};
	}

	readContent(plan: StructuredPlan, task: LionTask): LionPlanContent {
		const taskBriefPath = task.file ? join(plan.rootPath, task.file) : "";
		return {
			context: readFileSync(plan.contextFile, "utf-8"),
			requirements: readFileSync(join(plan.rootPath, "requirements.md"), "utf-8"),
			taskIndex: readFileSync(plan.indexFile, "utf-8"),
			taskBrief: taskBriefPath && existsSync(taskBriefPath) ? readFileSync(taskBriefPath, "utf-8") : "",
		};
	}

	markTaskComplete(plan: LionPlan, taskId: string): void {
		this.updateTaskStatus(plan, taskId, "complete");
	}

	updateTaskStatus(plan: LionPlan, taskId: string, status: LionTaskStatus): void {
		const checklistFile = join(plan.rootPath, "checklist.json");
		if (existsSync(checklistFile)) {
			const checklist = new LionChecklistFile(checklistFile);
			checklist.updateTaskStatus(taskId, status);
			return;
		}
		updateMarkdownTask(plan.rootPath, taskId, { status });
	}

	recordTaskResult(plan: LionPlan, taskId: string, status: LionTaskStatus, summary?: string): void {
		const checklistFile = join(plan.rootPath, "checklist.json");
		if (existsSync(checklistFile)) {
			const checklist = new LionChecklistFile(checklistFile);
			checklist.recordTaskResult(taskId, status, summary);
			return;
		}
		updateMarkdownTask(plan.rootPath, taskId, { status, summary });
	}
}

function loadMarkdownTasks(rootPath: string): LionTask[] {
	const tasksDir = join(rootPath, "tasks");
	if (!existsSync(tasksDir)) return loadTasksFromIndex(rootPath);

	const files = readdirSync(tasksDir)
		.filter((file) => file.endsWith(".md"))
		.sort((a, b) => a.localeCompare(b));

	const tasks = files.map((file) => {
		const relativeFile = join("tasks", file);
		const path = join(rootPath, relativeFile);
		return parseTaskMarkdown(relativeFile, readFileSync(path, "utf-8"));
	});

	return tasks.length > 0 ? tasks : loadTasksFromIndex(rootPath);
}

function loadTasksFromIndex(rootPath: string): LionTask[] {
	const indexFile = join(rootPath, "task-index.md");
	if (!existsSync(indexFile)) return [];

	const content = readFileSync(indexFile, "utf-8");
	const rows = content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("|") && !line.includes("---"));

	const tableTasks = rows.map(parseTaskIndexRow).filter((task): task is LionTask => task !== null);
	if (tableTasks.length > 0) return tableTasks;

	const headingTasks: LionTask[] = [];
	const headingPattern = /^##\s+([A-Z]+-\d+)[:\s-]+(.+)$/gm;
	let match = headingPattern.exec(content);
	while (match !== null) {
		headingTasks.push({
			id: match[1],
			title: match[2].trim(),
			file: "",
			status: "pending",
			dependencies: [],
			requirements: [],
		});
		match = headingPattern.exec(content);
	}
	return headingTasks;
}

function parseTaskIndexRow(line: string): LionTask | null {
	const cells = line
		.split("|")
		.slice(1, -1)
		.map((cell) => cell.trim().replace(/^`|`$/g, ""));
	if (cells.length < 2 || cells[0].toLowerCase() === "task id") return null;
	if (!/^[A-Z]+-\d+$/.test(cells[0])) return null;

	return {
		id: cells[0],
		title: cells[2] || cells[0],
		file: cells[1] === "none" ? "" : cells[1],
		status: "pending",
		dependencies: parseListCell(cells[3]),
		requirements: [],
	};
}

function parseTaskMarkdown(relativeFile: string, content: string): LionTask {
	const frontmatter = parseFrontmatter(content);
	const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
	const headingMatch = heading?.match(/^([A-Z]+-\d+)[:\s-]+(.+)$/);
	const id = stringValue(frontmatter.id) ?? headingMatch?.[1] ?? basename(relativeFile, ".md");
	const title = stringValue(frontmatter.title) ?? headingMatch?.[2] ?? heading ?? id;

	return {
		id,
		title,
		file: relativeFile,
		status: normalizeTaskStatus(stringValue(frontmatter.status)),
		dependencies: arrayValue(frontmatter.dependencies) ?? parseSectionList(content, "Dependencies"),
		requirements: arrayValue(frontmatter.requirements) ?? parseSectionList(content, "Requirements Covered"),
		phase: stringValue(frontmatter.phase),
		scope: arrayValue(frontmatter.scope),
		kind: stringValue(frontmatter.kind),
		last_summary: stringValue(frontmatter.last_summary),
		updated_at: stringValue(frontmatter.updated_at),
	};
}

function parseFrontmatter(content: string): Record<string, string | string[]> {
	if (!content.startsWith("---\n")) return {};
	const end = content.indexOf("\n---", 4);
	if (end === -1) return {};
	const lines = content.slice(4, end).split("\n");
	const result: Record<string, string | string[]> = {};
	let currentKey: string | null = null;

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const listItem = line.match(/^\s*-\s+(.+)$/);
		if (listItem && currentKey) {
			const current = result[currentKey];
			result[currentKey] = Array.isArray(current)
				? [...current, cleanScalar(listItem[1])]
				: [cleanScalar(listItem[1])];
			continue;
		}

		const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!field) continue;
		currentKey = field[1];
		const value = field[2].trim();
		result[currentKey] = value ? cleanScalar(value) : [];
	}

	return result;
}

function updateMarkdownTask(
	rootPath: string,
	taskId: string,
	update: { status: LionTaskStatus; summary?: string },
): void {
	const plan = new StructuredLionPlanFile(rootPath).loadPlan();
	const task = plan.tasks.find((item) => item.id === taskId);
	if (!task?.file) throw new Error(`Task ${taskId} not found in Markdown plan`);

	const taskPath = join(rootPath, task.file);
	const content = readFileSync(taskPath, "utf-8");
	const updated = upsertFrontmatter(content, {
		status: update.status,
		...(update.summary ? { last_summary: update.summary } : {}),
		updated_at: new Date().toISOString(),
	});
	writeFileSync(taskPath, updated, "utf-8");
}

function upsertFrontmatter(content: string, fields: Record<string, string>): string {
	if (!content.startsWith("---\n")) {
		return `---\n${formatFrontmatter(fields)}---\n\n${content}`;
	}

	const end = content.indexOf("\n---", 4);
	if (end === -1) return `---\n${formatFrontmatter(fields)}---\n\n${content}`;

	const existing = content.slice(4, end).split("\n");
	const remaining = new Map(Object.entries(fields));
	const next = existing.map((line) => {
		const match = line.match(/^([A-Za-z0-9_-]+):/);
		if (!match || !remaining.has(match[1])) return line;
		const value = remaining.get(match[1]) ?? "";
		remaining.delete(match[1]);
		return `${match[1]}: ${formatScalar(value)}`;
	});
	for (const [key, value] of remaining) {
		next.push(`${key}: ${formatScalar(value)}`);
	}

	return `---\n${next.join("\n")}\n---${content.slice(end + "\n---".length)}`;
}

function formatFrontmatter(fields: Record<string, string>): string {
	return Object.entries(fields)
		.map(([key, value]) => `${key}: ${formatScalar(value)}`)
		.join("\n")
		.concat("\n");
}

function parseSectionList(content: string, title: string): string[] {
	const pattern = new RegExp(`^##\\s+${escapeRegExp(title)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
	const match = content.match(pattern);
	if (!match) return [];
	return match[1]
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("-"))
		.map((line) => cleanScalar(line.replace(/^-\s+/, "")))
		.filter((line) => line && line.toLowerCase() !== "none");
}

function parseListCell(value: string | undefined): string[] {
	if (!value || value.toLowerCase() === "none") return [];
	if (value === "[]") return [];
	return value.split(",").map(cleanScalar).filter(Boolean);
}

function arrayValue(value: string | string[] | undefined): string[] | undefined {
	if (Array.isArray(value)) return value;
	if (!value) return undefined;
	return parseListCell(value);
}

function stringValue(value: string | string[] | undefined): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeTaskStatus(status: string | undefined): LionTaskStatus {
	if (
		status === "pending" ||
		status === "in_progress" ||
		status === "complete" ||
		status === "blocked" ||
		status === "retryable"
	) {
		return status;
	}
	if (status === "running") return "in_progress";
	return "pending";
}

function cleanScalar(value: string): string {
	return value
		.trim()
		.replace(/^`|`$/g, "")
		.replace(/^["']|["']$/g, "");
}

function formatScalar(value: string): string {
	return JSON.stringify(value);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
