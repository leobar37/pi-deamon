import { eventIterator, os } from "@orpc/server";
import { z } from "zod";
import type { DashboardEventBridge } from "./bridge.js";

// ============================================================
// Schemas
// ============================================================

const DashboardEventPayloadSchema = z.object({
	id: z.string(),
	type: z.string(),
	source: z.enum(["lion", "subagent"]),
	payload: z.unknown(),
	timestamp: z.number(),
});

const DashboardStateSchema = z.object({
	uptime: z.number(),
	bridgeCount: z.number(),
	subscriberCount: z.number(),
	recentEvents: z.array(DashboardEventPayloadSchema),
});

// ============================================================
// Types
// ============================================================

export interface DashboardEventPayload {
	id: string;
	type: string;
	source: "lion" | "subagent";
	payload: unknown;
	timestamp: number;
}

export interface DashboardState {
	uptime: number;
	bridgeCount: number;
	subscriberCount: number;
	recentEvents: DashboardEventPayload[];
}

// ============================================================
// Router factory
// ============================================================

export async function getDashboardState(
	bridge: DashboardEventBridge,
	getStartTime: () => number,
): Promise<DashboardState> {
	return {
		uptime: Date.now() - getStartTime(),
		bridgeCount: bridge.bridgeCount,
		subscriberCount: bridge.getSubscriberCount(),
		recentEvents: bridge.getRecentEvents(),
	};
}

export async function* streamDashboardEvents(
	bridge: DashboardEventBridge,
	signal: AbortSignal | undefined,
	pingIntervalMs = 5000,
): AsyncGenerator<DashboardEventPayload> {
	bridge.incrementSubscribers();
	const subscriber = bridge.getPublisher().subscribe("*", { signal });
	let nextEvent = subscriber.next();
	try {
		while (!signal?.aborted) {
			const pingPromise = new Promise<{ ping: true }>((resolve) => {
				setTimeout(() => resolve({ ping: true }), pingIntervalMs);
			});
			try {
				const result = await Promise.race([nextEvent, pingPromise]);
				if ("ping" in result) {
					yield {
						id: `ping-${Date.now()}`,
						type: "ping",
						source: "lion",
						payload: null,
						timestamp: Date.now(),
					};
				} else {
					yield result.value;
					nextEvent = subscriber.next();
				}
			} catch (err) {
				// subscriber.next() may throw on abort; log unexpected errors
				if (!signal?.aborted) {
					console.error("[dashboard] stream error:", err);
				}
				break;
			}
		}
	} finally {
		bridge.decrementSubscribers();
	}
}

export function createDashboardRouter(bridge: DashboardEventBridge, getStartTime: () => number, pingIntervalMs = 5000) {
	return {
		state: {
			get: os.output(DashboardStateSchema).handler(async () => getDashboardState(bridge, getStartTime)),
		},
		events: {
			stream: os.output(eventIterator(DashboardEventPayloadSchema)).handler(async function* ({ signal }) {
				yield* streamDashboardEvents(bridge, signal, pingIntervalMs);
			}),
		},
	};
}

export type DashboardRouter = ReturnType<typeof createDashboardRouter>;
