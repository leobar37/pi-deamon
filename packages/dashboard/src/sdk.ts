import type { ContractRouterClient } from "@orpc/contract";
import { createDashboardClient } from "./api/dashboard-client.js";
import type { dashboardContract } from "./contract.js";
import type { DashboardEvent } from "./events.js";
import type { DashboardSessionRuntime } from "./types.js";

export type DashboardClient = ContractRouterClient<typeof dashboardContract>;
export type SessionDefinition = Awaited<ReturnType<DashboardClient["sessions"]["get"]>>;
export type ProjectDefinition = Awaited<ReturnType<DashboardClient["projects"]["create"]>>;
export type PromptInput = {
	message: string;
	images?: Array<{ type: "image"; data: string; mimeType: string; name?: string }>;
};
export type SessionActionReceipt = Awaited<ReturnType<DashboardClient["sessions"]["prompt"]>>;
export type DashboardCommand = Awaited<ReturnType<DashboardClient["sessions"]["commands"]>>[number];
export type DashboardModel = Awaited<ReturnType<DashboardClient["sessions"]["models"]>>[number];
export type DashboardRawMessage = Awaited<ReturnType<DashboardClient["sessions"]["messages"]>>[number];
export type DashboardRawThreadEvent = Awaited<ReturnType<DashboardClient["sessions"]["threadEvents"]>>[number];

export interface BatchResult<T> {
	ok: Array<{ sessionId: string; value: T }>;
	errors: Array<{ sessionId: string; error: string }>;
}

export interface PiSessionsSdk {
	projects: {
		list(): Promise<ProjectDefinition[]>;
		create(input: { name: string; defaultCwd: string }): Promise<ProjectDefinition>;
		update(id: string, patch: { name?: string }): Promise<ProjectDefinition>;
		delete(id: string): Promise<{ id: string }>;
	};
	sessions: {
		list(input?: { projectId?: string }): Promise<SessionDefinition[]>;
		get(sessionId: string): Promise<SessionDefinition>;
		create(input: { projectId: string; name?: string }): Promise<SessionDefinition>;
		update(sessionId: string, patch: { name?: string }): Promise<SessionDefinition>;
		delete(sessionId: string): Promise<{ id: string }>;
		snapshot(sessionId: string): Promise<{ definition: SessionDefinition; runtime: DashboardSessionRuntime }>;
		snapshots(input?: {
			projectId?: string;
		}): Promise<Array<{ definition: SessionDefinition; runtime: DashboardSessionRuntime }>>;
	};
	runtime: {
		get(sessionId: string): Promise<DashboardSessionRuntime>;
		list(input?: { projectId?: string }): Promise<DashboardSessionRuntime[]>;
		messages(sessionId: string): Promise<DashboardRawMessage[]>;
		events(sessionId: string): Promise<DashboardRawThreadEvent[]>;
		commands(sessionId: string): Promise<DashboardCommand[]>;
		models(sessionId: string): Promise<DashboardModel[]>;
	};
	actions: {
		prompt(sessionId: string, input: PromptInput): Promise<SessionActionReceipt>;
		followUp(sessionId: string, input: PromptInput): Promise<SessionActionReceipt>;
		steer(sessionId: string, input: PromptInput): Promise<SessionActionReceipt>;
		abort(sessionId: string): Promise<DashboardSessionRuntime>;
		resume(sessionId: string): Promise<DashboardSessionRuntime>;
		cancel(sessionId: string): Promise<DashboardSessionRuntime>;
		kill(sessionId: string): Promise<DashboardSessionRuntime>;
		selectModel(sessionId: string, model: { provider: string; modelId: string }): Promise<SessionActionReceipt>;
	};
	events: {
		list(input?: {
			sessionId?: string;
			projectId?: string;
			type?: string;
			limit?: number;
		}): Promise<DashboardEvent[]>;
		subscribe(input: {
			sessionId?: string;
			projectId?: string;
			type?: string;
			signal?: AbortSignal;
			onEvent: (event: DashboardEvent) => void;
			onError?: (error: Error) => void;
		}): () => void;
	};
	batch: {
		status(sessionIds: string[]): Promise<BatchResult<DashboardSessionRuntime>>;
		abort(sessionIds: string[]): Promise<BatchResult<DashboardSessionRuntime>>;
		resume(sessionIds: string[]): Promise<BatchResult<DashboardSessionRuntime>>;
		cancel(sessionIds: string[]): Promise<BatchResult<DashboardSessionRuntime>>;
		kill(sessionIds: string[]): Promise<BatchResult<DashboardSessionRuntime>>;
		prompt(inputs: Array<{ sessionId: string; input: PromptInput }>): Promise<BatchResult<SessionActionReceipt>>;
	};
}

export interface PiSessionsSdkOptions {
	dashboardUrl: string;
	client?: DashboardClient;
	fetch?: typeof fetch;
}

export function createPiSessionsSdk(options: PiSessionsSdkOptions): PiSessionsSdk {
	const client = options.client ?? createDashboardClient(options.dashboardUrl);
	const fetchImpl = options.fetch ?? fetch;

	return {
		projects: {
			list: () => client.projects.list(),
			create: (input) => client.projects.create(input),
			update: (id, patch) => client.projects.update({ id, ...patch }),
			delete: (id) => client.projects.delete({ id }),
		},
		sessions: {
			list: (input = {}) => client.sessions.list(input),
			get: (sessionId) => client.sessions.get({ id: sessionId }),
			create: (input) => client.sessions.create(input),
			update: (sessionId, patch) => client.sessions.update({ id: sessionId, ...patch }),
			delete: (sessionId) => client.sessions.delete({ id: sessionId }),
			snapshot: async (sessionId) => {
				const [definition, runtime] = await Promise.all([
					client.sessions.get({ id: sessionId }),
					client.sessions.status({ id: sessionId }),
				]);
				return { definition, runtime };
			},
			snapshots: async (input = {}) => {
				const [definitions, runtimes] = await Promise.all([
					client.sessions.list(input),
					client.sessions.statuses(input),
				]);
				const runtimeBySessionId = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
				return definitions.map((definition) => ({
					definition,
					runtime: runtimeBySessionId.get(definition.id) ?? offlineRuntime(definition),
				}));
			},
		},
		runtime: {
			get: (sessionId) => client.sessions.status({ id: sessionId }),
			list: (input = {}) => client.sessions.statuses(input),
			messages: (sessionId) => client.sessions.messages({ id: sessionId }),
			events: (sessionId) => client.sessions.threadEvents({ id: sessionId }),
			commands: (sessionId) => client.sessions.commands({ id: sessionId }),
			models: (sessionId) => client.sessions.models({ id: sessionId }),
		},
		actions: {
			prompt: (sessionId, input) => client.sessions.prompt({ id: sessionId, ...input }),
			followUp: (sessionId, input) => client.sessions.followUp({ id: sessionId, ...input }),
			steer: (sessionId, input) => client.sessions.steer({ id: sessionId, ...input }),
			abort: (sessionId) => client.sessions.abort({ id: sessionId }),
			resume: (sessionId) => client.sessions.resume({ id: sessionId }),
			cancel: (sessionId) => client.sessions.cancel({ id: sessionId }),
			kill: (sessionId) => client.sessions.kill({ id: sessionId }),
			selectModel: (sessionId, model) => client.sessions.model({ id: sessionId, ...model }),
		},
		events: {
			list: (input = {}) => client.events.list(input),
			subscribe: (input) => subscribeToDashboardEvents(options.dashboardUrl, fetchImpl, input),
		},
		batch: {
			status: (sessionIds) => collectBatch(sessionIds, (sessionId) => client.sessions.status({ id: sessionId })),
			abort: (sessionIds) => collectBatch(sessionIds, (sessionId) => client.sessions.abort({ id: sessionId })),
			resume: (sessionIds) => collectBatch(sessionIds, (sessionId) => client.sessions.resume({ id: sessionId })),
			cancel: (sessionIds) => collectBatch(sessionIds, (sessionId) => client.sessions.cancel({ id: sessionId })),
			kill: (sessionIds) => collectBatch(sessionIds, (sessionId) => client.sessions.kill({ id: sessionId })),
			prompt: (inputs) =>
				collectBatch(
					inputs.map((input) => input.sessionId),
					(sessionId) => {
						const item = inputs.find((input) => input.sessionId === sessionId);
						if (!item) throw new Error(`Missing batch input for session "${sessionId}"`);
						return client.sessions.prompt({ id: sessionId, ...item.input });
					},
				),
		},
	};
}

function offlineRuntime(definition: SessionDefinition): DashboardSessionRuntime {
	return {
		id: definition.id,
		threadId: definition.threadId,
		state: definition.threadId ? "unknown" : "offline",
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

async function collectBatch<T>(sessionIds: string[], run: (sessionId: string) => Promise<T>): Promise<BatchResult<T>> {
	const results = await Promise.all(
		sessionIds.map(async (sessionId) => {
			try {
				return { sessionId, value: await run(sessionId), error: null };
			} catch (error) {
				return {
					sessionId,
					value: null,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}),
	);

	return {
		ok: results.flatMap((result) =>
			result.error === null ? [{ sessionId: result.sessionId, value: result.value as T }] : [],
		),
		errors: results.flatMap((result) =>
			result.error === null ? [] : [{ sessionId: result.sessionId, error: result.error }],
		),
	};
}

function subscribeToDashboardEvents(
	dashboardUrl: string,
	fetchImpl: typeof fetch,
	input: {
		sessionId?: string;
		projectId?: string;
		type?: string;
		signal?: AbortSignal;
		onEvent: (event: DashboardEvent) => void;
		onError?: (error: Error) => void;
	},
): () => void {
	const controller = new AbortController();
	const signal = input.signal ? AbortSignal.any([input.signal, controller.signal]) : controller.signal;
	const url = new URL("/events", dashboardUrl);
	if (input.sessionId) url.searchParams.set("sessionId", input.sessionId);
	if (input.projectId) url.searchParams.set("projectId", input.projectId);
	if (input.type) url.searchParams.set("type", input.type);

	void readEventStream(url, fetchImpl, signal, input.onEvent, input.onError);
	return () => controller.abort();
}

async function readEventStream(
	url: URL,
	fetchImpl: typeof fetch,
	signal: AbortSignal,
	onEvent: (event: DashboardEvent) => void,
	onError?: (error: Error) => void,
): Promise<void> {
	try {
		const response = await fetchImpl(url, {
			headers: { Accept: "text/event-stream" },
			signal,
		});
		if (!response.ok || !response.body) {
			throw new Error(`Dashboard events stream failed with HTTP ${response.status}`);
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const chunks = buffer.split("\n\n");
			buffer = chunks.pop() ?? "";
			for (const chunk of chunks) {
				const event = parseSseEvent(chunk);
				if (event) onEvent(event);
			}
		}
	} catch (error) {
		if (!signal.aborted) {
			onError?.(error instanceof Error ? error : new Error(String(error)));
		}
	}
}

function parseSseEvent(chunk: string): DashboardEvent | null {
	const data = chunk
		.split("\n")
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice("data:".length).trimStart())
		.join("\n");
	if (!data) return null;
	return JSON.parse(data) as DashboardEvent;
}
