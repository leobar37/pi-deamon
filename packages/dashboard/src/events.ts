import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { DashboardEventSchema } from "./contract.js";

export type DashboardEvent = z.infer<typeof DashboardEventSchema>;
export type DashboardEventType = DashboardEvent["type"];

export type DashboardEventMap = {
	[T in DashboardEventType]: Extract<DashboardEvent, { type: T }>;
};

export class DashboardEventBus {
	private listeners = new Map<DashboardEventType | "*", Set<(event: DashboardEvent) => void>>();
	private events: DashboardEvent[] = [];

	constructor(private maxEvents = 500) {}

	on<T extends DashboardEventType>(type: T, listener: (event: DashboardEventMap[T]) => void): () => void;
	on(type: "*", listener: (event: DashboardEvent) => void): () => void;
	on(type: DashboardEventType | "*", listener: (event: DashboardEvent) => void): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)!.add(listener);

		return () => {
			this.listeners.get(type)?.delete(listener);
		};
	}

	emit(event: DashboardEvent): void {
		this.events.push(event);
		if (this.events.length > this.maxEvents) {
			this.events.splice(0, this.events.length - this.maxEvents);
		}

		const specific = this.listeners.get(event.type);
		if (specific) {
			for (const listener of specific) {
				this.callListener(listener, event);
			}
		}

		const wildcard = this.listeners.get("*");
		if (wildcard) {
			for (const listener of wildcard) {
				this.callListener(listener, event);
			}
		}
	}

	subscribe(listener: (event: DashboardEvent) => void): () => void {
		return this.on("*", listener);
	}

	clear(): void {
		this.listeners.clear();
		this.events = [];
	}

	list(filter?: { sessionId?: string; projectId?: string; type?: string; limit?: number }): DashboardEvent[] {
		const filtered = this.events.filter((event) => {
			if (filter?.type && event.type !== filter.type) return false;
			if (filter?.sessionId && !eventMatchesSession(event, filter.sessionId)) return false;
			if (filter?.projectId && !eventMatchesProject(event, filter.projectId)) return false;
			return true;
		});
		const limit = filter?.limit ?? filtered.length;
		return filtered.slice(Math.max(0, filtered.length - limit));
	}

	private callListener(listener: (event: DashboardEvent) => void, event: DashboardEvent): void {
		try {
			listener(event);
		} catch (error) {
			console.error("[dashboard-event-bus] listener error:", error);
		}
	}
}

function eventMatchesSession(event: DashboardEvent, sessionId: string): boolean {
	switch (event.type) {
		case "session.created":
		case "session.updated":
			return event.session.id === sessionId;
		case "session.deleted":
			return event.sessionId === sessionId;
		case "session.runtime":
			return event.runtime.id === sessionId;
		case "session.action":
			return event.sessionId === sessionId;
		default:
			return false;
	}
}

function eventMatchesProject(event: DashboardEvent, projectId: string): boolean {
	switch (event.type) {
		case "project.created":
		case "project.updated":
			return event.project.id === projectId;
		case "project.deleted":
			return event.projectId === projectId;
		case "session.created":
		case "session.updated":
			return event.session.projectId === projectId;
		case "session.deleted":
		case "session.runtime":
			return event.projectId === projectId;
		case "session.action":
			return event.projectId === projectId;
	}
}

export function createDashboardEvent<TType extends DashboardEventType>(
	type: TType,
	payload: Omit<DashboardEventMap[TType], "id" | "timestamp" | "type">,
): DashboardEventMap[TType] {
	return {
		...payload,
		id: randomUUID(),
		type,
		timestamp: Date.now(),
	} as DashboardEventMap[TType];
}
