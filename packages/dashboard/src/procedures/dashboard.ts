/**
 * Dashboard procedures — catalog ownership for projects, sessions, and layout.
 */

import { implement, ORPCError } from "@orpc/server";
import {
	createSubagentsClient as defaultCreateSubagentsClient,
	type SubagentsClient,
} from "../api/subagents-client.js";
import { dashboardContract } from "../contract.js";
import { createDashboardEvent } from "../events.js";
import { logger } from "../logging.js";
import type { DashboardContext, DashboardSessionRuntime } from "../types.js";

// ============================================================================
// Procedures
// ============================================================================

export interface DashboardProcedureOptions {
	getStartTime: () => number;
	context: DashboardContext;
	getSubagentsUrl: () => string | undefined;
	createSubagentsClient?: (url: string) => SubagentsClient;
}

type SubagentsThreadState = Awaited<ReturnType<SubagentsClient["threads"]["get"]>>;

function mapThreadStateToRuntime(sessionId: string, thread: SubagentsThreadState): DashboardSessionRuntime {
	const state = (() => {
		switch (thread.state) {
			case "starting":
			case "created":
				return "starting" as const;
			case "running":
			case "completing":
				return "running" as const;
			case "paused":
				return "idle" as const;
			case "completed":
				return "completed" as const;
			case "blocked":
				return "blocked" as const;
			case "timed_out":
				return "timed_out" as const;
			case "failed":
				return "failed" as const;
			case "cancelled":
				return "cancelled" as const;
			default:
				return "unknown" as const;
		}
	})();
	return {
		id: sessionId,
		threadId: thread.instanceId,
		state,
		isLive: thread.isLive ?? state === "running",
		isRunning: state === "running",
		canPrompt: state === "idle" || state === "completed" || state === "blocked" || state === "timed_out",
		canFollowUp: state === "idle" || state === "running",
		canSteer: state === "running",
		canAbort: state === "running",
		canResume: state === "idle" || state === "completed" || state === "blocked" || state === "timed_out",
		canCancel: state === "running" || state === "idle",
		canKill: thread.isLive ?? false,
		lastActivityAt: thread.lastActivityAt ?? null,
		error: thread.error ?? null,
		turnCount: thread.turnCount ?? null,
		toolCount: thread.toolCount ?? null,
		durationMs: thread.durationMs ?? null,
		modelProvider: thread.modelProvider ?? null,
		modelId: thread.modelId ?? null,
	};
}

function offlineRuntime(sessionId: string, threadId: string | null): DashboardSessionRuntime {
	return {
		id: sessionId,
		threadId,
		state: threadId ? "unknown" : "offline",
		isLive: false,
		isRunning: false,
		canPrompt: false,
		canFollowUp: false,
		canSteer: false,
		canAbort: false,
		canResume: false,
		canCancel: false,
		canKill: false,
		lastActivityAt: null,
		error: null,
		turnCount: null,
		toolCount: null,
		durationMs: null,
		modelProvider: null,
		modelId: null,
	};
}

export function createDashboardProcedures({
	getStartTime,
	context,
	getSubagentsUrl,
	createSubagentsClient = defaultCreateSubagentsClient,
}: DashboardProcedureOptions) {
	const impl = implement(dashboardContract).$context<DashboardContext>();

	async function getSessionRuntime(sessionId: string): Promise<DashboardSessionRuntime> {
		const session = getSessionOrThrow(sessionId);

		const subagentsUrl = getSubagentsUrl();
		if (!subagentsUrl || !session.threadId) {
			return offlineRuntime(session.id, session.threadId);
		}

		try {
			const client = createSubagentsClient(subagentsUrl);
			const thread = await client.threads.get({ threadId: session.threadId });
			return mapThreadStateToRuntime(session.id, thread);
		} catch {
			return offlineRuntime(session.id, session.threadId);
		}
	}

	function getSessionOrThrow(sessionId: string) {
		const session = context.sessions.getById(sessionId);
		if (!session) {
			throw new ORPCError("NOT_FOUND", { message: "Session not found" });
		}
		return session;
	}

	function getRuntimeClientOrThrow(session: { threadId: string | null }) {
		const subagentsUrl = getSubagentsUrl();
		if (!subagentsUrl || !session.threadId) {
			throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Session is offline" });
		}
		return {
			client: createSubagentsClient(subagentsUrl),
			threadId: session.threadId,
		};
	}

	async function sendSessionMessage(
		sessionId: string,
		message: string,
		mode: "prompt" | "follow_up" | "steer",
		images?: Array<{ type: "image"; data: string; mimeType: string; name?: string }>,
	) {
		const session = getSessionOrThrow(sessionId);
		const { client, threadId } = getRuntimeClientOrThrow(session);
		const result = await client.threads.prompt({ threadId, message, mode, images });
		const runtime = await getSessionRuntime(session.id);
		context.events.emit(
			createDashboardEvent("session.action", {
				sessionId: session.id,
				threadId,
				projectId: session.projectId,
				action: mode,
			}),
		);
		context.events.emit(createDashboardEvent("session.runtime", { runtime, projectId: session.projectId }));
		return {
			id: session.id,
			threadId: result.threadId,
			action: result.mode,
			status: result.status,
			acceptedAt: result.acceptedAt,
		};
	}

	async function controlSessionLifecycle(
		sessionId: string,
		action: "abort" | "resume" | "cancel" | "kill",
	): Promise<DashboardSessionRuntime> {
		const session = getSessionOrThrow(sessionId);
		const { client, threadId } = getRuntimeClientOrThrow(session);
		try {
			if (action === "abort") {
				await client.threads.abort({ threadId });
			} else if (action === "resume") {
				await client.threads.resume({ threadId });
			} else if (action === "cancel") {
				await client.threads.cancel({ threadId });
			} else {
				await client.threads.kill({ threadId });
			}
			const runtime =
				action === "kill"
					? { ...offlineRuntime(session.id, session.threadId), state: "offline" as const }
					: await getSessionRuntime(session.id);
			context.events.emit(
				createDashboardEvent("session.action", {
					sessionId: session.id,
					threadId,
					projectId: session.projectId,
					action,
				}),
			);
			context.events.emit(createDashboardEvent("session.runtime", { runtime, projectId: session.projectId }));
			return runtime;
		} catch (error) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: error instanceof Error ? error.message : `Failed to ${action} session`,
			});
		}
	}

	return impl.router({
		projects: {
			list: impl.projects.list.handler(async () => {
				return context.projects.list();
			}),

			create: impl.projects.create.handler(async ({ input }) => {
				const now = Date.now();
				const project = context.projects.create({
					id: crypto.randomUUID(),
					name: input.name,
					defaultCwd: input.defaultCwd,
					createdAt: now,
					updatedAt: now,
				});
				context.events.emit(createDashboardEvent("project.created", { project }));
				return project;
			}),

			update: impl.projects.update.handler(async ({ input }) => {
				const existing = context.projects.getById(input.id);
				if (!existing) {
					throw new ORPCError("NOT_FOUND", { message: "Project not found" });
				}
				const project = context.projects.update(input.id, {
					name: input.name ?? existing.name,
					updatedAt: Date.now(),
				});
				context.events.emit(createDashboardEvent("project.updated", { project }));
				return project;
			}),

			delete: impl.projects.delete.handler(async ({ input }) => {
				const existing = context.projects.getById(input.id);
				if (!existing) {
					throw new ORPCError("NOT_FOUND", { message: "Project not found" });
				}
				context.projects.delete(input.id);
				context.events.emit(createDashboardEvent("project.deleted", { projectId: input.id }));
				return { id: input.id };
			}),
		},

		sessions: {
			list: impl.sessions.list.handler(async ({ input }) => {
				return context.sessions.list(input.projectId);
			}),

			get: impl.sessions.get.handler(async ({ input }) => {
				const session = context.sessions.getById(input.id);
				if (!session) {
					throw new ORPCError("NOT_FOUND", { message: "Session not found" });
				}
				return session;
			}),

			create: impl.sessions.create.handler(async ({ input }) => {
				const project = context.projects.getById(input.projectId);
				if (!project) {
					throw new ORPCError("NOT_FOUND", { message: "Project not found" });
				}

				const now = Date.now();
				const projectSessions = context.sessions.list(project.id);
				const name = input.name ?? `Session ${projectSessions.length + 1}`;

				const session = context.sessions.create({
					id: crypto.randomUUID(),
					projectId: project.id,
					name,
					threadId: null,
					cwd: project.defaultCwd,
					createdAt: now,
					updatedAt: now,
				});

				const subagentsUrl = getSubagentsUrl();
				if (subagentsUrl) {
					try {
						const client = createSubagentsClient(subagentsUrl);
						const result = await client.threads.create({ name: session.name, cwd: session.cwd });
						context.sessions.update(session.id, { threadId: result.threadId, updatedAt: Date.now() });
						const materialized = context.sessions.getById(session.id)!;
						context.events.emit(createDashboardEvent("session.created", { session: materialized }));
						const runtime = await getSessionRuntime(materialized.id);
						context.events.emit(
							createDashboardEvent("session.runtime", { runtime, projectId: materialized.projectId }),
						);
						return materialized;
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						logger.warn("Failed to materialize session in subagents backend", {
							sessionId: session.id,
							error: message,
						});
						// The catalog record is already created; the session is offline.
					}
				}

				context.events.emit(createDashboardEvent("session.created", { session }));
				return session;
			}),

			update: impl.sessions.update.handler(async ({ input }) => {
				const existing = context.sessions.getById(input.id);
				if (!existing) {
					throw new ORPCError("NOT_FOUND", { message: "Session not found" });
				}
				const session = context.sessions.update(input.id, {
					name: input.name ?? existing.name,
					updatedAt: Date.now(),
				});
				context.events.emit(createDashboardEvent("session.updated", { session }));
				return session;
			}),

			delete: impl.sessions.delete.handler(async ({ input }) => {
				const existing = context.sessions.getById(input.id);
				if (!existing) {
					throw new ORPCError("NOT_FOUND", { message: "Session not found" });
				}
				context.sessions.delete(input.id);
				context.events.emit(
					createDashboardEvent("session.deleted", { sessionId: input.id, projectId: existing.projectId }),
				);
				return { id: input.id };
			}),

			status: impl.sessions.status.handler(async ({ input }) => {
				return getSessionRuntime(input.id);
			}),

			statuses: impl.sessions.statuses.handler(async ({ input }) => {
				const sessions = context.sessions.list(input.projectId);
				const subagentsUrl = getSubagentsUrl();
				if (!subagentsUrl) {
					return sessions.map((session) => offlineRuntime(session.id, session.threadId));
				}

				const client = createSubagentsClient(subagentsUrl);
				return Promise.all(
					sessions.map(async (session) => {
						if (!session.threadId) {
							return offlineRuntime(session.id, session.threadId);
						}
						try {
							const thread = await client.threads.get({ threadId: session.threadId });
							return mapThreadStateToRuntime(session.id, thread);
						} catch {
							return offlineRuntime(session.id, session.threadId);
						}
					}),
				);
			}),

			abort: impl.sessions.abort.handler(async ({ input }) => {
				return controlSessionLifecycle(input.id, "abort");
			}),

			resume: impl.sessions.resume.handler(async ({ input }) => {
				return controlSessionLifecycle(input.id, "resume");
			}),

			cancel: impl.sessions.cancel.handler(async ({ input }) => {
				return controlSessionLifecycle(input.id, "cancel");
			}),

			kill: impl.sessions.kill.handler(async ({ input }) => {
				return controlSessionLifecycle(input.id, "kill");
			}),

			prompt: impl.sessions.prompt.handler(async ({ input }) => {
				return sendSessionMessage(input.id, input.message.trim(), "prompt", input.images);
			}),

			followUp: impl.sessions.followUp.handler(async ({ input }) => {
				return sendSessionMessage(input.id, input.message.trim(), "follow_up", input.images);
			}),

			steer: impl.sessions.steer.handler(async ({ input }) => {
				return sendSessionMessage(input.id, input.message.trim(), "steer", input.images);
			}),

			messages: impl.sessions.messages.handler(async ({ input }) => {
				const session = getSessionOrThrow(input.id);
				const { client, threadId } = getRuntimeClientOrThrow(session);
				return client.threads.messages({ threadId });
			}),

			threadEvents: impl.sessions.threadEvents.handler(async ({ input }) => {
				const session = getSessionOrThrow(input.id);
				const { client, threadId } = getRuntimeClientOrThrow(session);
				return client.threads.events({ threadId });
			}),

			commands: impl.sessions.commands.handler(async ({ input }) => {
				const session = getSessionOrThrow(input.id);
				const { client, threadId } = getRuntimeClientOrThrow(session);
				return client.threads.commands({ threadId });
			}),

			models: impl.sessions.models.handler(async ({ input }) => {
				const session = getSessionOrThrow(input.id);
				const { client, threadId } = getRuntimeClientOrThrow(session);
				return client.threads.models({ threadId });
			}),

			model: impl.sessions.model.handler(async ({ input }) => {
				const session = getSessionOrThrow(input.id);
				const { client, threadId } = getRuntimeClientOrThrow(session);
				const result = await client.threads.model({ threadId, provider: input.provider, modelId: input.modelId });
				const runtime = await getSessionRuntime(session.id);
				context.events.emit(
					createDashboardEvent("session.action", {
						sessionId: session.id,
						threadId,
						projectId: session.projectId,
						action: "select_model",
					}),
				);
				context.events.emit(createDashboardEvent("session.runtime", { runtime, projectId: session.projectId }));
				return {
					id: session.id,
					threadId: result.threadId,
					action: "select_model" as const,
					status: "sent" as const,
					acceptedAt: result.selectedAt,
				};
			}),
		},

		layout: {
			get: impl.layout.get.handler(async ({ input }) => {
				return context.canvasNodes.getBySessionId(input.sessionId) ?? null;
			}),

			update: impl.layout.update.handler(async ({ input }) => {
				const now = Date.now();
				return context.canvasNodes.upsert({
					sessionId: input.sessionId,
					x: input.x,
					y: input.y,
					width: input.width,
					height: input.height,
					updatedAt: now,
				});
			}),
		},

		state: {
			get: impl.state.get.handler(async () => ({
				uptime: Date.now() - getStartTime(),
			})),
		},

		environment: {
			get: impl.environment.get.handler(async () => ({
				subagentsUrl: getSubagentsUrl() ?? null,
			})),
		},

		logs: {
			get: impl.logs.get.handler(async ({ input }) => {
				const logs = logger.getLogs(input);
				return { logs, total: logger.size };
			}),
		},

		events: {
			list: impl.events.list.handler(async ({ input }) => {
				return context.events.list(input);
			}),
		},
	});
}
