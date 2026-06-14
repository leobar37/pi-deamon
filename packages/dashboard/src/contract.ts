/**
 * Dashboard oRPC contract shared between server and frontend.
 *
 * This module re-exports only type-level constructs so that the frontend
 * can import them without pulling in server-side runtime dependencies.
 */

import { oc } from "@orpc/contract";
import { z } from "zod";

export const DashboardProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	defaultCwd: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

export const DashboardSessionSchema = z.object({
	id: z.string(),
	projectId: z.string(),
	name: z.string(),
	threadId: z.string().nullable(),
	cwd: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

export const DashboardSessionRuntimeStateSchema = z.enum([
	"offline",
	"idle",
	"starting",
	"running",
	"blocked",
	"completed",
	"failed",
	"timed_out",
	"cancelled",
	"unknown",
]);

export const DashboardSessionRuntimeSchema = z.object({
	id: z.string(),
	threadId: z.string().nullable(),
	state: DashboardSessionRuntimeStateSchema,
	isLive: z.boolean(),
	isRunning: z.boolean(),
	canPrompt: z.boolean(),
	canFollowUp: z.boolean(),
	canSteer: z.boolean(),
	canAbort: z.boolean(),
	canResume: z.boolean(),
	canCancel: z.boolean(),
	canKill: z.boolean(),
	lastActivityAt: z.number().nullable(),
	error: z.string().nullable(),
	turnCount: z.number().nullable(),
	toolCount: z.number().nullable(),
	durationMs: z.number().nullable(),
	modelProvider: z.string().nullable(),
	modelId: z.string().nullable(),
});

export const DashboardPromptImageSchema = z.object({
	type: z.literal("image"),
	data: z.string().trim().min(1),
	mimeType: z.string().trim().min(1),
	name: z.string().optional(),
});

export const DashboardSessionPromptInputSchema = z
	.object({
		id: z.string(),
		message: z.string(),
		images: z.array(DashboardPromptImageSchema).optional(),
	})
	.refine((input) => input.message.trim().length > 0 || (input.images?.length ?? 0) > 0, {
		message: "Message or image is required",
		path: ["message"],
	});

export const DashboardSessionActionReceiptSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	action: z.enum(["prompt", "follow_up", "steer", "select_model"]),
	status: z.literal("sent"),
	acceptedAt: z.number(),
});

export const DashboardCommandSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	source: z.enum(["extension", "prompt", "skill"]),
});

export const DashboardModelSchema = z.object({
	provider: z.string(),
	id: z.string(),
	name: z.string(),
	api: z.string(),
	reasoning: z.boolean(),
});

export const DashboardSessionModelInputSchema = z.object({
	id: z.string(),
	provider: z.string().trim().min(1),
	modelId: z.string().trim().min(1),
});

export const DashboardRawMessageSchema = z.record(z.unknown());

export const DashboardRawThreadEventSchema = z
	.object({
		type: z.string(),
	})
	.catchall(z.unknown());

export const DashboardCanvasNodeSchema = z.object({
	sessionId: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	updatedAt: z.number(),
});

const DashboardEventBaseSchema = z.object({
	id: z.string(),
	timestamp: z.number(),
});

export const DashboardEventSchema = z.discriminatedUnion("type", [
	DashboardEventBaseSchema.extend({
		type: z.literal("project.created"),
		project: DashboardProjectSchema,
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("project.updated"),
		project: DashboardProjectSchema,
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("project.deleted"),
		projectId: z.string(),
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("session.created"),
		session: DashboardSessionSchema,
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("session.updated"),
		session: DashboardSessionSchema,
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("session.deleted"),
		sessionId: z.string(),
		projectId: z.string(),
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("session.runtime"),
		runtime: DashboardSessionRuntimeSchema,
		projectId: z.string().nullable(),
	}),
	DashboardEventBaseSchema.extend({
		type: z.literal("session.action"),
		sessionId: z.string(),
		threadId: z.string(),
		projectId: z.string(),
		action: z.enum(["prompt", "follow_up", "steer", "abort", "resume", "cancel", "kill", "select_model"]),
	}),
]);

export const dashboardContract = oc.router({
	projects: {
		list: oc.output(z.array(DashboardProjectSchema)),

		create: oc.input(z.object({ name: z.string(), defaultCwd: z.string() })).output(DashboardProjectSchema),

		update: oc.input(z.object({ id: z.string(), name: z.string().optional() })).output(DashboardProjectSchema),

		delete: oc.input(z.object({ id: z.string() })).output(z.object({ id: z.string() })),
	},

	sessions: {
		list: oc.input(z.object({ projectId: z.string().optional() })).output(z.array(DashboardSessionSchema)),

		get: oc.input(z.object({ id: z.string() })).output(DashboardSessionSchema),

		create: oc.input(z.object({ projectId: z.string(), name: z.string().optional() })).output(DashboardSessionSchema),

		update: oc.input(z.object({ id: z.string(), name: z.string().optional() })).output(DashboardSessionSchema),

		delete: oc.input(z.object({ id: z.string() })).output(z.object({ id: z.string() })),

		status: oc.input(z.object({ id: z.string() })).output(DashboardSessionRuntimeSchema),

		statuses: oc.input(z.object({ projectId: z.string().optional() })).output(z.array(DashboardSessionRuntimeSchema)),

		abort: oc.input(z.object({ id: z.string() })).output(DashboardSessionRuntimeSchema),

		resume: oc.input(z.object({ id: z.string() })).output(DashboardSessionRuntimeSchema),

		cancel: oc.input(z.object({ id: z.string() })).output(DashboardSessionRuntimeSchema),

		kill: oc.input(z.object({ id: z.string() })).output(DashboardSessionRuntimeSchema),

		prompt: oc.input(DashboardSessionPromptInputSchema).output(DashboardSessionActionReceiptSchema),

		followUp: oc.input(DashboardSessionPromptInputSchema).output(DashboardSessionActionReceiptSchema),

		steer: oc.input(DashboardSessionPromptInputSchema).output(DashboardSessionActionReceiptSchema),

		messages: oc.input(z.object({ id: z.string() })).output(z.array(DashboardRawMessageSchema)),

		threadEvents: oc.input(z.object({ id: z.string() })).output(z.array(DashboardRawThreadEventSchema)),

		commands: oc.input(z.object({ id: z.string() })).output(z.array(DashboardCommandSchema)),

		models: oc.input(z.object({ id: z.string() })).output(z.array(DashboardModelSchema)),

		model: oc.input(DashboardSessionModelInputSchema).output(DashboardSessionActionReceiptSchema),
	},

	layout: {
		get: oc.input(z.object({ sessionId: z.string() })).output(DashboardCanvasNodeSchema.nullable()),

		update: oc
			.input(
				z.object({
					sessionId: z.string(),
					x: z.number(),
					y: z.number(),
					width: z.number(),
					height: z.number(),
				}),
			)
			.output(DashboardCanvasNodeSchema),
	},

	state: {
		get: oc.output(z.object({ uptime: z.number() })),
	},

	logs: {
		get: oc
			.input(
				z.object({
					level: z.enum(["debug", "info", "warn", "error"]).optional(),
					limit: z.number().min(1).max(1000).optional(),
					sessionId: z.string().optional(),
				}),
			)
			.output(
				z.object({
					logs: z.array(
						z.object({
							timestamp: z.string(),
							level: z.enum(["debug", "info", "warn", "error"]),
							message: z.string(),
							context: z.record(z.unknown()).optional(),
						}),
					),
					total: z.number(),
				}),
			),
	},

	events: {
		list: oc
			.input(
				z.object({
					sessionId: z.string().optional(),
					projectId: z.string().optional(),
					type: z.string().optional(),
					limit: z.number().min(1).max(500).optional(),
				}),
			)
			.output(z.array(DashboardEventSchema)),
	},
});

export type DashboardContract = typeof dashboardContract;
export type { DashboardRouter } from "./procedures/index.js";
export type { DashboardConfig } from "./types.js";
