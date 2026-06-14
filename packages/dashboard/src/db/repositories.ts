import { eq } from "drizzle-orm";
import type { DashboardDatabase } from "./connection.js";
import { canvasNodes, type NewCanvasNode, type NewProject, type NewSession, projects, sessions } from "./schema.js";

export function createProjectRepository(db: DashboardDatabase) {
	return {
		create(input: NewProject) {
			return db.insert(projects).values(input).returning().get();
		},

		list() {
			return db.select().from(projects).orderBy(projects.createdAt).all();
		},

		getById(id: string) {
			return db.select().from(projects).where(eq(projects.id, id)).get();
		},

		update(id: string, input: Partial<Pick<NewProject, "name" | "updatedAt">>) {
			return db.update(projects).set(input).where(eq(projects.id, id)).returning().get();
		},

		delete(id: string) {
			return db.delete(projects).where(eq(projects.id, id)).returning().get();
		},
	};
}

export function createSessionRepository(db: DashboardDatabase) {
	return {
		create(input: NewSession) {
			return db.insert(sessions).values(input).returning().get();
		},

		list(projectId?: string) {
			const query = db.select().from(sessions);
			if (projectId) {
				return query.where(eq(sessions.projectId, projectId)).orderBy(sessions.createdAt).all();
			}
			return query.orderBy(sessions.createdAt).all();
		},

		getById(id: string) {
			return db.select().from(sessions).where(eq(sessions.id, id)).get();
		},

		update(id: string, input: Partial<Pick<NewSession, "name" | "threadId" | "updatedAt">>) {
			return db.update(sessions).set(input).where(eq(sessions.id, id)).returning().get();
		},

		delete(id: string) {
			return db.delete(sessions).where(eq(sessions.id, id)).returning().get();
		},
	};
}

export function createCanvasNodeRepository(db: DashboardDatabase) {
	return {
		upsert(input: NewCanvasNode) {
			const existing = db.select().from(canvasNodes).where(eq(canvasNodes.sessionId, input.sessionId)).get();
			if (existing) {
				return db
					.update(canvasNodes)
					.set({
						x: input.x,
						y: input.y,
						width: input.width,
						height: input.height,
						updatedAt: input.updatedAt,
					})
					.where(eq(canvasNodes.sessionId, input.sessionId))
					.returning()
					.get();
			}
			return db.insert(canvasNodes).values(input).returning().get();
		},

		getBySessionId(sessionId: string) {
			return db.select().from(canvasNodes).where(eq(canvasNodes.sessionId, sessionId)).get();
		},

		list() {
			return db.select().from(canvasNodes).all();
		},

		delete(sessionId: string) {
			return db.delete(canvasNodes).where(eq(canvasNodes.sessionId, sessionId)).returning().get();
		},
	};
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
export type SessionRepository = ReturnType<typeof createSessionRepository>;
export type CanvasNodeRepository = ReturnType<typeof createCanvasNodeRepository>;
