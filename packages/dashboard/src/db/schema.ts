import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	defaultCwd: text("default_cwd").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	threadId: text("thread_id"),
	cwd: text("cwd").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const canvasNodes = sqliteTable("canvas_nodes", {
	sessionId: text("session_id")
		.primaryKey()
		.references(() => sessions.id, { onDelete: "cascade" }),
	x: real("x").notNull(),
	y: real("y").notNull(),
	width: real("width").notNull(),
	height: real("height").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type CanvasNode = typeof canvasNodes.$inferSelect;
export type NewCanvasNode = typeof canvasNodes.$inferInsert;
