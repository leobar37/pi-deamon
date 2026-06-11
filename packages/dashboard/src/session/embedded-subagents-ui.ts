import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { DashboardSessionSource, DashboardThreadState, SubAgentEvent } from "@local/pi-subagents";
import type { DashboardSessionCommand, DashboardSessionModel, LiveSession } from "./live-session.js";

function mapStatus(state: LiveSession["status"]): DashboardThreadState["state"] {
	if (state === "streaming") return "running";
	if (state === "starting") return "starting";
	if (state === "error") return "failed";
	if (state === "stopped") return "completed";
	return "running";
}

function toSessionEvent(sessionId: string, event: AgentSessionEvent): SubAgentEvent {
	return {
		type: "session.event",
		instanceId: sessionId,
		taskId: sessionId,
		sessionEvent: event,
		timestamp: Date.now(),
	};
}

class LiveSessionSource implements DashboardSessionSource {
	private listeners = new Set<(event: SubAgentEvent) => void>();
	private events: SubAgentEvent[] = [];
	private unsubscribe?: () => void;

	constructor(private readonly session: LiveSession) {
		this.unsubscribe = this.session.eventPublisher.subscribe("*", (event) => {
			const dashboardEvent = toSessionEvent(this.session.id, event);
			this.events.push(dashboardEvent);
			for (const listener of this.listeners) {
				listener(dashboardEvent);
			}
		});
	}

	getThread(): DashboardThreadState {
		const info = this.session.info;
		return {
			instanceId: info.id,
			taskId: info.id,
			definitionName: "agent",
			description: info.name ?? `Session ${info.id.slice(0, 8)}`,
			state: mapStatus(info.status),
			startTime: info.createdAt,
			endTime: info.status === "stopped" ? info.lastActivityAt : null,
			turnCount: info.messageCount,
			lastActivityAt: info.lastActivityAt,
			currentTool: null,
			error: info.status === "error" ? "Session failed" : null,
			toolCount: 0,
			currentToolStartedAt: null,
			durationMs: Date.now() - info.createdAt,
			kind: "main",
			isLive: info.isActive,
			sessionFile: info.sessionFile,
			sessionId: info.id,
			modelProvider: this.session.getModel()?.provider,
			modelId: this.session.getModel()?.id,
		};
	}

	getMessages(threadId: string): AgentMessage[] | null {
		if (threadId !== this.session.id) return null;
		return this.session.getMessages();
	}

	getEvents(threadId: string): SubAgentEvent[] {
		if (threadId !== this.session.id) return [];
		return this.events;
	}

	async sendMessage(threadId: string, message: string, mode: "prompt" | "follow_up" | "steer"): Promise<void> {
		if (threadId !== this.session.id) return;
		if (mode === "follow_up") {
			await this.session.followUp(message);
			return;
		}
		if (mode === "steer") {
			await this.session.steer(message);
			return;
		}
		await this.session.prompt(message);
	}

	async getCommands(threadId: string): Promise<DashboardSessionCommand[]> {
		if (threadId !== this.session.id) return [];
		return this.session.getCommands();
	}

	async getModels(threadId: string): Promise<DashboardSessionModel[]> {
		if (threadId !== this.session.id) return [];
		return this.session.getAvailableModels();
	}

	async setModel(threadId: string, provider: string, modelId: string): Promise<boolean> {
		if (threadId !== this.session.id) return false;
		await this.session.setModelById(provider, modelId);
		return true;
	}

	subscribe(listener: (event: SubAgentEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	dispose(): void {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.listeners.clear();
	}
}

export class EmbeddedSubagentsUi {
	private transport: { port: number; start(): Promise<void>; stop(force?: boolean): Promise<void> | void } | null =
		null;
	private source: LiveSessionSource | null = null;
	private url: URL | null = null;

	constructor(private readonly session: LiveSession) {}

	async start(): Promise<URL> {
		if (this.url) return this.url;
		const { HttpServerTransport, SubAgentController } = await import("@local/pi-subagents");
		this.source = new LiveSessionSource(this.session);
		const controller = new SubAgentController({
			cwd: this.session.cwd,
			definitions: [],
		});
		this.transport = new HttpServerTransport({
			controller,
			host: "127.0.0.1",
			port: 0,
			serveFrontend: true,
			mainSession: this.source,
		});
		await this.transport.start();
		this.url = new URL(`http://127.0.0.1:${this.transport.port}/#/thread/${encodeURIComponent(this.session.id)}`);
		return this.url;
	}

	async stop(): Promise<void> {
		await this.transport?.stop();
		this.transport = null;
		this.source?.dispose();
		this.source = null;
		this.url = null;
	}
}
