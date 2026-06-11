/**
 * LiveSession — a single live session with an optional AgentSession runtime.
 *
 * Lifecycle:
 *   created -> start() -> starting -> idle <-> streaming -> stop() -> stopped
 *                         |
 *                         +-> error
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
	AgentSession,
	AgentSessionEvent,
	CreateAgentSessionOptions,
	ModelRegistry,
	RpcClientOptions,
	RpcSessionState,
	SessionManager,
	SlashCommandInfo,
} from "@earendil-works/pi-coding-agent";
import { createAgentSession, RpcClient } from "@earendil-works/pi-coding-agent";
import { EventPublisher } from "@orpc/server";
import type { EventStreamProvider } from "../events/provider.js";
import { serializeAgentSessionEvent, serializeLionEvent } from "../events/serialize.js";
import { logger } from "../logging.js";
import { EmbeddedSubagentsUi } from "./embedded-subagents-ui.js";
import type { LiveSessionInfo, SessionStatus } from "./types.js";

export interface DashboardSessionCommand {
	name: string;
	description?: string;
	source: "extension" | "prompt" | "skill";
}

export interface DashboardSessionModel {
	provider: string;
	id: string;
	name: string;
	api: string;
	reasoning: boolean;
}

interface RpcModelPayload {
	provider: string;
	id: string;
	name?: string;
	api?: string;
	reasoning: boolean;
}

function shouldUseRpcProcessRuntime(): boolean {
	return process.env.PI_DASHBOARD_SESSION_RUNTIME !== "in-process" && process.env.VITEST !== "true";
}

function shouldStartEmbeddedSubagentsUi(): boolean {
	return process.env.PI_DASHBOARD_EMBEDDED_SUBAGENTS_UI !== "false" && process.env.VITEST !== "true";
}

function resolveCodingAgentCliPath(): string {
	const resolved = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
	const dir = dirname(resolved);
	if (resolved.endsWith("/src/index.ts")) {
		return join(dir, "..", "dist", "cli.js");
	}
	return join(dir, "cli.js");
}

export class LiveSession {
	readonly id: string;
	readonly sessionManager: SessionManager;
	readonly sessionType: "agent" | "lion";
	readonly eventPublisher = new EventPublisher<Record<string, AgentSessionEvent>>();

	private _status: SessionStatus = "created";
	private _agentSession: AgentSession | null = null;
	private _rpcClient: RpcClient | null = null;
	private _rpcState: RpcSessionState | null = null;
	private _embeddedUi: EmbeddedSubagentsUi | null = null;
	private _embeddedUiUrl: URL | null = null;
	private _eventUnsubscribe?: () => void;
	private _lastActivityAt: number;
	private readonly _createdAt: number;
	private _eventProvider: EventStreamProvider | null = null;
	private readonly _modelRegistry: ModelRegistry | undefined;
	private _externalEventSource?: {
		subscribe: (handler: (event: Record<string, unknown>) => void) => () => void;
	};
	private _subagents = new Map<string, { id: string; parentId?: string; name: string; status: string }>();

	constructor(
		sessionManager: SessionManager,
		eventProvider?: EventStreamProvider,
		modelRegistry?: ModelRegistry,
		sessionType: "agent" | "lion" = "agent",
	) {
		this.sessionManager = sessionManager;
		this.id = sessionManager.getSessionId();
		this.sessionType = sessionType;
		this._lastActivityAt = Date.now();
		this._eventProvider = eventProvider ?? null;
		this._modelRegistry = modelRegistry;

		const header = sessionManager.getHeader();
		this._createdAt = header?.timestamp ? new Date(header.timestamp).getTime() : Date.now();
	}

	/**
	 * Set or replace the EventStreamProvider for forwarding events.
	 */
	setEventProvider(provider: EventStreamProvider): void {
		this._eventProvider = provider;
	}

	// -------------------------------------------------------------------------
	// Read-only accessors
	// -------------------------------------------------------------------------

	get status(): SessionStatus {
		return this._status;
	}

	get lastActivityAt(): number {
		return this._lastActivityAt;
	}

	get cwd(): string {
		return this.sessionManager.getCwd();
	}

	get info(): LiveSessionInfo {
		const entries = this.sessionManager.getEntries();
		return {
			id: this.id,
			name: this.sessionManager.getSessionName(),
			status: this._status,
			isActive: this._status === "starting" || this._status === "idle" || this._status === "streaming",
			sessionFile: this.sessionManager.getSessionFile(),
			cwd: this.cwd,
			createdAt: this._createdAt,
			lastActivityAt: this._lastActivityAt,
			messageCount: this._rpcState?.messageCount ?? entries.filter((e) => e.type === "message").length,
			sessionType: this.sessionType,
			processId: this._rpcClient?.getPid(),
			uiUrl: this._embeddedUiUrl?.href,
		};
	}

	// -------------------------------------------------------------------------
	// Runtime lifecycle
	// -------------------------------------------------------------------------

	async start(options?: Omit<CreateAgentSessionOptions, "cwd" | "sessionManager">): Promise<void> {
		if (this._status === "starting" || this._status === "idle" || this._status === "streaming") {
			logger.debug("Session start skipped — already active", { sessionId: this.id, status: this._status });
			return;
		}

		if (this._status === "error") {
			logger.warn("Session start failed — error state", { sessionId: this.id });
			throw new Error(
				`Session ${this.id} is in error state from a previous start attempt. ` +
					"Resolve the error or remove the session before retrying.",
			);
		}

		// Lion sessions attach to an external event source instead of creating an AgentSession
		if (this.sessionType === "lion") {
			if (!this._externalEventSource) {
				logger.warn("Lion session start failed — no external event source", { sessionId: this.id });
				throw new Error(
					`Session ${this.id} is a Lion session but has no external event source. ` +
						"Call setExternalEventSource() before start().",
				);
			}
			this._status = "starting";
			logger.info("Starting lion session", { sessionId: this.id, cwd: this.cwd });

			this._eventUnsubscribe = this._externalEventSource.subscribe((event) => {
				const serverEvent = serializeLionEvent(event, this.id);
				if (this._eventProvider) {
					this._eventProvider.publish(serverEvent);
				}
				this._touch();

				// Track subagent state for tree queries
				if (serverEvent.type === "subagent_start") {
					this._subagents.set(serverEvent.id, {
						id: serverEvent.id,
						parentId: serverEvent.parentId,
						name: serverEvent.name,
						status: serverEvent.status,
					});
				} else if (serverEvent.type === "subagent_end") {
					const existing = this._subagents.get(serverEvent.id);
					if (existing) {
						existing.status = serverEvent.status;
					}
				} else if (serverEvent.type === "subagent_error") {
					const existing = this._subagents.get(serverEvent.id);
					if (existing) {
						existing.status = "failed";
					}
				}
			});

			this._status = "idle";
			this._touch();
			logger.info("Lion session started", { sessionId: this.id });
			return;
		}

		this._status = "starting";
		logger.info("Starting agent session", {
			sessionId: this.id,
			cwd: this.cwd,
			runtime: shouldUseRpcProcessRuntime() ? "rpc-process" : "in-process",
		});

		try {
			if (shouldUseRpcProcessRuntime()) {
				await this._startRpcProcess(options);
				return;
			}
			const result = await createAgentSession({
				cwd: this.cwd,
				sessionManager: this.sessionManager,
				...options,
				modelRegistry: this._modelRegistry,
			});

			this._agentSession = result.session;
			this._status = "idle";
			this._touch();
			logger.info("Agent session started", { sessionId: this.id });

			this._eventUnsubscribe = result.session.subscribe((event) => {
				// Forward to internal EventPublisher (for legacy consumers)
				this.eventPublisher.publish("*", event);

				// Forward to EventStreamProvider (for SSE subscribers)
				if (this._eventProvider) {
					const serverEvent = serializeAgentSessionEvent(event, this.id);
					this._eventProvider.publish(serverEvent);
				}

				this._touch();

				if (event.type === "agent_start") {
					this._status = "streaming";
				} else if (event.type === "agent_end") {
					this._status = "idle";
				}
			});
			await this._startEmbeddedUi();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error("Agent session start failed", { sessionId: this.id, error: message });
			this._status = "error";
			throw err;
		}
	}

	async stop(): Promise<void> {
		this._eventUnsubscribe?.();
		this._eventUnsubscribe = undefined;
		if (this._rpcClient) {
			await this._rpcClient.stop();
			this._rpcClient = null;
			this._rpcState = null;
		}
		if (this._embeddedUi) {
			await this._embeddedUi.stop();
			this._embeddedUi = null;
			this._embeddedUiUrl = null;
		}
		if (this._agentSession) {
			this._agentSession.dispose();
			this._agentSession = null;
		}
		this._status = "stopped";
	}

	// -------------------------------------------------------------------------
	// External event source (Lion sessions)
	// -------------------------------------------------------------------------

	/**
	 * Attach an external event source for Lion sessions.
	 * The source's `subscribe` method should return an unsubscribe function.
	 */
	setExternalEventSource(source: {
		subscribe: (handler: (event: Record<string, unknown>) => void) => () => void;
	}): void {
		this._externalEventSource = source;
	}

	/**
	 * Get the current flat list of tracked subagents.
	 */
	getSubagentTree(): Array<{ id: string; parentId?: string; name: string; status: string }> {
		return Array.from(this._subagents.values());
	}

	// -------------------------------------------------------------------------
	// Interaction (requires running runtime)
	// -------------------------------------------------------------------------

	async prompt(message: string, opts?: { streamingBehavior?: "steer" | "followUp" }): Promise<void> {
		logger.info("Prompt requested", { sessionId: this.id, status: this._status });
		this._requireRuntime();
		this._touch();
		try {
			if (this._rpcClient) {
				await this._rpcClient.prompt(message, { streamingBehavior: opts?.streamingBehavior });
				void this._refreshRpcState();
			} else {
				await this._agentSession!.prompt(message, {
					streamingBehavior: opts?.streamingBehavior,
					source: "rpc",
				});
			}
			logger.info("Prompt sent to agent", { sessionId: this.id });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error("Prompt failed in agent", { sessionId: this.id, error: errorMessage });
			throw err;
		}
	}

	async steer(message: string): Promise<void> {
		logger.info("Steer requested", { sessionId: this.id, status: this._status });
		this._requireRuntime();
		this._touch();
		try {
			if (this._rpcClient) {
				await this._rpcClient.steer(message);
				void this._refreshRpcState();
			} else {
				await this._agentSession!.steer(message);
			}
			logger.info("Steer sent to agent", { sessionId: this.id });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error("Steer failed in agent", { sessionId: this.id, error: errorMessage });
			throw err;
		}
	}

	async followUp(message: string): Promise<void> {
		logger.info("FollowUp requested", { sessionId: this.id, status: this._status });
		this._requireRuntime();
		this._touch();
		try {
			if (this._rpcClient) {
				await this._rpcClient.followUp(message);
				void this._refreshRpcState();
			} else {
				await this._agentSession!.followUp(message);
			}
			logger.info("FollowUp sent to agent", { sessionId: this.id });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error("FollowUp failed in agent", { sessionId: this.id, error: errorMessage });
			throw err;
		}
	}

	async abort(): Promise<void> {
		logger.info("Abort requested", { sessionId: this.id, status: this._status });
		this._requireRuntime();
		this._touch();
		try {
			if (this._rpcClient) {
				await this._rpcClient.abort();
				void this._refreshRpcState();
			} else {
				await this._agentSession!.abort();
			}
			logger.info("Abort sent to agent", { sessionId: this.id });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error("Abort failed in agent", { sessionId: this.id, error: errorMessage });
			throw err;
		}
	}

	// -------------------------------------------------------------------------
	// State access
	// -------------------------------------------------------------------------

	getMessages(): AgentMessage[] {
		if (!this._agentSession) {
			return this.sessionManager.buildSessionContext().messages;
		}
		return this._agentSession.messages;
	}

	async getMessagesAsync(): Promise<AgentMessage[]> {
		if (this._rpcClient) {
			return this._rpcClient.getMessages();
		}
		return this.getMessages();
	}

	getModel(): { provider: string; id: string; name: string } | undefined {
		if (this._rpcState?.model) {
			const model = this._rpcState.model;
			return { provider: model.provider, id: model.id, name: model.name };
		}
		if (!this._agentSession) return undefined;
		const model = this._agentSession.model;
		if (!model) return undefined;
		return { provider: model.provider, id: model.id, name: model.name };
	}

	async setModel(modelRegistry: ModelRegistry, provider: string, modelId: string): Promise<void> {
		this._requireRuntime();
		if (this._rpcClient) {
			await this._rpcClient.setModel(provider, modelId);
			await this._refreshRpcState();
			return;
		}
		const model = modelRegistry.find(provider, modelId);
		if (!model) {
			throw new Error(`Model ${provider}/${modelId} not found`);
		}
		if (!modelRegistry.hasConfiguredAuth(model)) {
			throw new Error(`Model ${provider}/${modelId} has no configured authentication`);
		}
		await this._agentSession!.setModel(model);
	}

	async setModelById(provider: string, modelId: string): Promise<void> {
		this._requireRuntime();
		if (this._rpcClient) {
			await this._rpcClient.setModel(provider, modelId);
			await this._refreshRpcState();
			return;
		}
		if (!this._modelRegistry) {
			throw new Error("Session has no model registry");
		}
		await this.setModel(this._modelRegistry, provider, modelId);
	}

	async getAvailableModels(): Promise<DashboardSessionModel[]> {
		this._requireRuntime();
		if (this._rpcClient) {
			return (await this._rpcClient.getAvailableModels()).map((model) => this._formatRpcModel(model));
		}
		if (!this._modelRegistry) return [];
		return this._modelRegistry.getAvailable().map((model) => ({
			provider: model.provider,
			id: model.id,
			name: model.name,
			api: model.api,
			reasoning: Boolean(model.reasoning),
		}));
	}

	async getCommands(): Promise<DashboardSessionCommand[]> {
		this._requireRuntime();
		if (this._rpcClient) {
			return (await this._rpcClient.getCommands()).map((command) => this._formatCommand(command));
		}
		const session = this._agentSession!;
		return [
			...session.extensionRunner.getRegisteredCommands().map((command) =>
				this._formatCommand({
					name: command.invocationName,
					description: command.description,
					source: "extension" as const,
					sourceInfo: command.sourceInfo,
				}),
			),
			...session.promptTemplates.map((template) =>
				this._formatCommand({
					name: template.name,
					description: template.description,
					source: "prompt" as const,
					sourceInfo: template.sourceInfo,
				}),
			),
			...session.resourceLoader.getSkills().skills.map((skill) =>
				this._formatCommand({
					name: `skill:${skill.name}`,
					description: skill.description,
					source: "skill" as const,
					sourceInfo: skill.sourceInfo,
				}),
			),
		];
	}

	getState(): {
		status: SessionStatus;
		isStreaming: boolean;
		isCompacting: boolean;
		pendingMessageCount: number;
		messageCount: number;
	} {
		if (!this._agentSession) {
			return {
				status: this._status,
				isStreaming: false,
				isCompacting: false,
				pendingMessageCount: 0,
				messageCount: this._rpcState?.messageCount ?? this.sessionManager.buildSessionContext().messages.length,
			};
		}
		return {
			status: this._status,
			isStreaming: this._agentSession.isStreaming,
			isCompacting: this._agentSession.isCompacting,
			pendingMessageCount: this._agentSession.pendingMessageCount,
			messageCount: this._agentSession.messages.length,
		};
	}

	// -------------------------------------------------------------------------
	// Internal
	// -------------------------------------------------------------------------

	private _requireRuntime(): void {
		if (!this._agentSession && !this._rpcClient) {
			logger.warn("Runtime required but not available", { sessionId: this.id, status: this._status });
			throw new Error(`Session ${this.id} has no active runtime. Call start() first.`);
		}
		if (this._status === "error") {
			logger.warn("Runtime required but session in error state", { sessionId: this.id });
			throw new Error(`Session ${this.id} is in error state.`);
		}
	}

	private _touch(): void {
		this._lastActivityAt = Date.now();
	}

	private async _startRpcProcess(options?: Omit<CreateAgentSessionOptions, "cwd" | "sessionManager">): Promise<void> {
		const sessionFile = this.sessionManager.getSessionFile();
		const args = sessionFile ? ["--session", sessionFile] : [];
		const rpcOptions: RpcClientOptions = {
			cliPath: resolveCodingAgentCliPath(),
			cwd: this.cwd,
			env: {
				LION_DASHBOARD_MODE: "true",
				PI_DASHBOARD_SESSION_ID: this.id,
			},
			args,
			provider: options?.model?.provider,
			model: options?.model?.id,
		};
		const client = new RpcClient(rpcOptions);
		await client.start();
		this._rpcClient = client;
		this._eventUnsubscribe = client.onEvent((event) => {
			this.eventPublisher.publish("*", event as AgentSessionEvent);
			if (this._eventProvider) {
				const serverEvent = serializeAgentSessionEvent(event as AgentSessionEvent, this.id);
				this._eventProvider.publish(serverEvent);
			}
			this._touch();
			if (event.type === "agent_start") {
				this._status = "streaming";
			} else if (event.type === "agent_end") {
				this._status = "idle";
				void this._refreshRpcState();
			}
		});
		await this._refreshRpcState();
		this._status = "idle";
		this._touch();
		await this._startEmbeddedUi();
		logger.info("Agent session process started", {
			sessionId: this.id,
			pid: client.getPid(),
			cwd: this.cwd,
		});
	}

	private async _refreshRpcState(): Promise<void> {
		if (!this._rpcClient) return;
		try {
			this._rpcState = await this._rpcClient.getState();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn("Failed to refresh RPC session state", { sessionId: this.id, error: message });
		}
	}

	private async _startEmbeddedUi(): Promise<void> {
		if (!shouldStartEmbeddedSubagentsUi()) return;
		if (this._embeddedUiUrl) return;
		this._embeddedUi = new EmbeddedSubagentsUi(this);
		this._embeddedUiUrl = await this._embeddedUi.start();
		logger.info("Embedded subagents UI started", {
			sessionId: this.id,
			url: this._embeddedUiUrl.href,
		});
	}

	private _formatCommand(command: SlashCommandInfo): DashboardSessionCommand {
		return {
			name: command.name,
			description: command.description,
			source: command.source,
		};
	}

	private _formatRpcModel(model: RpcModelPayload): DashboardSessionModel {
		return {
			provider: model.provider,
			id: model.id,
			name: model.name ?? model.id,
			api: model.api ?? model.provider,
			reasoning: model.reasoning,
		};
	}
}
