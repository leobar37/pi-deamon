import type { DashboardEvent, DashboardEventBus } from "../events.js";

interface DashboardSseClient {
	controller: ReadableStreamDefaultController<Uint8Array>;
	sessionId?: string;
	projectId?: string;
	type?: string;
}

const encoder = new TextEncoder();

function encodeSse(event: DashboardEvent): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function matchesFilter(event: DashboardEvent, client: DashboardSseClient): boolean {
	if (client.type && event.type !== client.type) return false;
	if (client.sessionId && !matchesSession(event, client.sessionId)) return false;
	if (client.projectId && !matchesProject(event, client.projectId)) return false;
	return true;
}

function matchesSession(event: DashboardEvent, sessionId: string): boolean {
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

function matchesProject(event: DashboardEvent, projectId: string): boolean {
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
		case "session.action":
			return event.projectId === projectId;
	}
}

export class DashboardEventStream {
	private clients = new Set<DashboardSseClient>();
	private unsubscribe: (() => void) | undefined;
	private heartbeatTimer: ReturnType<typeof setInterval> | undefined;

	constructor(private bus: DashboardEventBus) {}

	start(): void {
		if (this.unsubscribe) return;
		this.unsubscribe = this.bus.subscribe((event) => this.emit(event));
		this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 30000);
	}

	stop(): void {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = undefined;
		}
		for (const client of this.clients) {
			try {
				client.controller.close();
			} catch {
				// best effort
			}
		}
		this.clients.clear();
	}

	serve(request: Request): Response | undefined {
		const url = new URL(request.url);
		if (request.method !== "GET" || url.pathname !== "/events") {
			return undefined;
		}

		const sessionId = url.searchParams.get("sessionId") ?? undefined;
		const projectId = url.searchParams.get("projectId") ?? undefined;
		const type = url.searchParams.get("type") ?? undefined;

		const stream = new ReadableStream<Uint8Array>({
			start: (controller) => {
				const client: DashboardSseClient = { controller, sessionId, projectId, type };
				this.clients.add(client);
				for (const event of this.bus.list({ sessionId, projectId, type, limit: 50 })) {
					controller.enqueue(encodeSse(event));
				}
				request.signal.addEventListener("abort", () => {
					this.clients.delete(client);
					try {
						controller.close();
					} catch {
						// best effort
					}
				});
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Access-Control-Allow-Origin": "*",
			},
		});
	}

	private emit(event: DashboardEvent): void {
		const payload = encodeSse(event);
		for (const client of this.clients) {
			if (!matchesFilter(event, client)) continue;
			try {
				client.controller.enqueue(payload);
			} catch {
				this.clients.delete(client);
			}
		}
	}

	private sendHeartbeat(): void {
		const heartbeat = encoder.encode(":heartbeat\n\n");
		for (const client of this.clients) {
			try {
				client.controller.enqueue(heartbeat);
			} catch {
				this.clients.delete(client);
			}
		}
	}
}
