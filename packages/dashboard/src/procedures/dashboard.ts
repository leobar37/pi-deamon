/**
 * Dashboard procedures — minimal server state info.
 *
 * After removing Lion code, this module only exposes basic server metrics.
 * Event streaming is now handled by the unified `events.stream` endpoint
 * in the session procedures.
 */

import { eventIterator, os } from "@orpc/server";
import { z } from "zod";
import type { EventStreamProvider } from "../events/provider.js";
import { EventFilterSchema, ServerEventSchema } from "../events/schemas.js";
import { logger } from "../logging.js";
import type { SessionHost } from "../session/host.js";

// ============================================================================
// Types
// ============================================================================

export interface DashboardState {
	uptime: number;
	subscriberCount: number;
}

// ============================================================================
// Procedures
// ============================================================================

export function createDashboardProcedures(
	eventProvider: EventStreamProvider,
	getStartTime: () => number,
	sessionHost?: SessionHost,
) {
	return {
		state: {
			get: os
				.output(
					z.object({
						uptime: z.number(),
						subscriberCount: z.number(),
					}),
				)
				.handler(async () => ({
					uptime: Date.now() - getStartTime(),
					subscriberCount: eventProvider.getSubscriberCount(),
				})),
		},
		events: {
			stream: os
				.input(EventFilterSchema)
				.output(eventIterator(ServerEventSchema))
				.handler(async function* ({ input, signal }) {
					// Auto-start session if it exists but is not active
					if (input.sessionId && sessionHost) {
						try {
							const session = await sessionHost.resolve(input.sessionId);
							if (session && !session.info.isActive) {
								logger.info("Auto-starting session for SSE subscriber", { sessionId: input.sessionId });
								sessionHost.start(input.sessionId).catch((err: unknown) => {
									logger.warn("Auto-start failed for SSE subscriber", {
										sessionId: input.sessionId,
										error: err instanceof Error ? err.message : String(err),
									});
								});
							}
						} catch {
							// Session not found — subscriber will get no events, which is fine
						}
					}

					const iterator = eventProvider.subscribe(
						{
							sessionId: input.sessionId,
							eventTypes: input.eventTypes,
						},
						signal,
					);

					try {
						for await (const event of iterator) {
							yield event;
						}
					} finally {
						await iterator.return?.(undefined);
					}
				}),
		},
		logs: {
			get: os
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
				)
				.handler(async ({ input }) => {
					const logs = logger.getLogs(input);
					return { logs, total: logger.size };
				}),
		},
	};
}
