import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db/connection.js";
import { runMigrations } from "../../src/db/migrate.js";
import {
	createCanvasNodeRepository,
	createProjectRepository,
	createSessionRepository,
} from "../../src/db/repositories.js";

describe("dashboard database catalog", () => {
	let dbPath: string;
	let cleanup: () => void;

	beforeAll(() => {
		const dir = mkdtempSync(join(tmpdir(), "pi-dashboard-db-test-"));
		dbPath = join(dir, "dashboard.sqlite");
		cleanup = () => {
			rmSync(dir, { recursive: true, force: true });
		};
	});

	afterAll(() => {
		cleanup();
	});

	it("creates the catalog schema and supports project/session/node CRUD", () => {
		const db = createDatabase({ path: dbPath });
		runMigrations(db);

		const projects = createProjectRepository(db);
		const sessions = createSessionRepository(db);
		const nodes = createCanvasNodeRepository(db);

		const now = Date.now();
		const project = projects.create({
			id: "project-1",
			name: "Test Project",
			defaultCwd: "/tmp/test",
			createdAt: now,
			updatedAt: now,
		});
		expect(project.id).toBe("project-1");

		const listedProjects = projects.list();
		expect(listedProjects).toHaveLength(1);
		expect(listedProjects[0]?.name).toBe("Test Project");

		const session = sessions.create({
			id: "session-1",
			projectId: project.id,
			name: "Test Session",
			threadId: null,
			cwd: "/tmp/test",
			createdAt: now,
			updatedAt: now,
		});
		expect(session.projectId).toBe(project.id);

		const listedSessions = sessions.list();
		expect(listedSessions).toHaveLength(1);

		const node = nodes.upsert({
			sessionId: session.id,
			x: 10,
			y: 20,
			width: 100,
			height: 200,
			updatedAt: now,
		});
		expect(node.sessionId).toBe(session.id);
		expect(node.width).toBe(100);

		sessions.update(session.id, { threadId: "thread-abc", updatedAt: Date.now() });
		const updated = sessions.getById(session.id);
		expect(updated?.threadId).toBe("thread-abc");

		projects.delete(project.id);
		expect(sessions.getById(session.id)).toBeUndefined();
		expect(nodes.getBySessionId(session.id)).toBeUndefined();
	});
});
