import { useEffect, useRef } from "react";
import { useSubAgentStore } from "../store/use-subagent-store.ts";
import { useSessionMessagesStore } from "../store/session-messages.ts";
import type { SubAgentEvent, SubAgentInstanceState } from "../types.ts";
import { convertAgentMessages } from "../utils/message-converter.ts";
import { generateNextEvent } from "../mocks/sse-emitter.ts";
import { advanceMockTodoProgress } from "../mocks/tasks.ts";
import { dashboardDebugLedger } from "../dev/debug-ledger.ts";
import { queryClient } from "../lib/query-client.ts";
import { invalidateTaskQueries } from "../lib/task-query-cache.ts";
import { setThreadMessagesCache } from "../lib/thread-message-cache.ts";

function isDev(): boolean {
	return (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;
}

export function useSseEvents(instanceId?: string, enabled = true) {
	const storeRef = useRef(useSubAgentStore.getState());
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		let retryCount = 0;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let lastEventTime = Date.now();
		let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

		const getBackoffMs = () => {
			const base = Math.min(1000 * 2 ** retryCount, 30000);
			const jitter = Math.random() * 1000;
			return base + jitter;
		};

		const INACTIVITY_TIMEOUT_MS = 45000;

		const scheduleInactivityCheck = () => {
			if (inactivityTimer) clearTimeout(inactivityTimer);
			inactivityTimer = setTimeout(() => {
				if (cancelled) return;
				const elapsed = Date.now() - lastEventTime;
				if (elapsed >= INACTIVITY_TIMEOUT_MS) {
					console.warn("[SSE] Inactivity timeout, reconnecting...");
					retryCount++;
					connect();
				}
			}, INACTIVITY_TIMEOUT_MS);
		};

		// In dev mode with MSW, use a local mock emitter instead of fetch SSE
		// because MSW Service Workers don't support ReadableStream responses well.
		let mockInterval: ReturnType<typeof setInterval> | null = null;
		let mockTimeout: ReturnType<typeof setTimeout> | null = null;

		const startMockEmitter = async () => {
			if (!isDev()) return false;
			if (isTodoMockMode()) {
				storeRef.current.setConnected(true);
				lastEventTime = Date.now();
				scheduleInactivityCheck();

				const emit = () => {
					if (cancelled) return;
					const events = advanceMockTodoProgress();
					dashboardDebugLedger.recordEvent(events.sessionEvent);
					storeRef.current.addEvent(events.sessionEvent);
					handleSessionEvent(events.sessionEvent);
					dashboardDebugLedger.recordEvent(events.taskEvent);
					storeRef.current.addEvent(events.taskEvent);
					syncDashboardQueries(events.taskEvent);
					lastEventTime = Date.now();
					scheduleInactivityCheck();
					mockTimeout = setTimeout(emit, 3000);
				};

				mockTimeout = setTimeout(emit, 1800);
				return true;
			}
			// Only emit for the running mock agent
			if (instanceId && instanceId !== "subagent-task-1-abc123") return false;

			const agent = {
				instanceId: "subagent-task-1-abc123",
				taskId: "task-1",
				definitionName: "executor",
				parentThreadId: "main:mock-session",
				parentToolCallId: "main-tool-lion-tasks",
				runId: "mock-run-1",
				runIndex: 0,
				state: "running" as const,
				turnCount: 3,
				toolCount: 5,
				currentTool: null as string | null,
			};

			storeRef.current.setConnected(true);
			lastEventTime = Date.now();
			scheduleInactivityCheck();

			const emit = () => {
				if (cancelled) return;
				const event = generateNextEvent(agent);
				dashboardDebugLedger.recordEvent(event);
				storeRef.current.addEvent(event);
				syncDashboardQueries(event);
				handleSessionEvent(event);
				lastEventTime = Date.now();
				scheduleInactivityCheck();
				mockTimeout = setTimeout(emit, 2000 + Math.random() * 3000);
			};

			mockTimeout = setTimeout(emit, 1500);
			return true;
		};

		const connect = () => {
			if (cancelled) return;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}

			// Try mock emitter first in dev mode
			startMockEmitter().then((usedMock) => {
				if (usedMock) return;

				// Fall back to real SSE fetch -- filter by instanceId if provided
				const url = new URL("/events", window.location.origin);
				if (instanceId) {
					url.searchParams.set("instanceId", instanceId);
				}

				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;

				fetch(url.href, { signal: controller.signal })
					.then(async (res) => {
						if (!res.ok || !res.body) {
							throw new Error(`HTTP ${res.status}`);
						}
						dashboardDebugLedger.log("info", "sse", "connected", { url: url.href }, instanceId);
						retryCount = 0;
						lastEventTime = Date.now();
						storeRef.current.setConnected(true);
						void queryClient.invalidateQueries({ refetchType: "active" });
						scheduleInactivityCheck();

						const reader = res.body.getReader();
						const decoder = new TextDecoder();
						let buffer = "";

						try {
							while (!cancelled) {
								const { done, value } = await reader.read();
								if (done) break;
								if (cancelled) break;

								buffer += decoder.decode(value, { stream: true });
								lastEventTime = Date.now();
								scheduleInactivityCheck();

								const lines = buffer.split("\n\n");
								buffer = lines.pop() ?? "";

								for (const chunk of lines) {
									const dataLine = chunk
										.split("\n")
										.find((l) => l.startsWith("data:"));
									if (!dataLine) continue;
									const json = dataLine.slice(5).trim();
									if (!json) continue;
									try {
										const event = JSON.parse(json) as SubAgentEvent;
										dashboardDebugLedger.recordEvent(event);
										storeRef.current.addEvent(event);
										syncDashboardQueries(event);
										handleSessionEvent(event);
									} catch {
										/* ignore malformed */
									}
								}
							}
						} catch (err) {
							if (!cancelled) {
								console.error("[SSE] Stream error:", err);
							}
						}

						if (!cancelled) {
							dashboardDebugLedger.log("warn", "sse", "reconnect", { retryCount }, instanceId);
							storeRef.current.setConnected(false);
							retryCount++;
							reconnectTimer = setTimeout(connect, getBackoffMs());
						}
					})
					.catch((err) => {
						if (!cancelled) {
							dashboardDebugLedger.log("error", "sse", "connection-error", err, instanceId);
							console.error("[SSE] Connection error:", err);
							storeRef.current.setConnected(false);
							retryCount++;
							reconnectTimer = setTimeout(connect, getBackoffMs());
						}
					});
			});
		};

		connect();

		return () => {
			cancelled = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (inactivityTimer) clearTimeout(inactivityTimer);
			if (mockInterval) clearInterval(mockInterval);
			if (mockTimeout) clearTimeout(mockTimeout);
			abortRef.current?.abort();
		};
	}, [enabled, instanceId]);

	function handleSessionEvent(event: SubAgentEvent): void {
		applySessionMessageEvent(event);
	}
}

function isTodoMockMode(): boolean {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("mock") === "todos";
}

export function applySessionMessageEvent(event: SubAgentEvent): void {
	if (event.type === "session.snapshot") {
		if (!event.instanceId || !Array.isArray(event.messages)) return;
		const messages = convertAgentMessages(event.instanceId, event.messages as Array<Record<string, unknown>>);
		useSessionMessagesStore.getState().setMessages(event.instanceId, messages);
		useSessionMessagesStore.getState().setStreaming(event.instanceId, false);
		syncMessageQuery(event.instanceId);
		return;
	}
	if (event.type === "session.message.complete") {
		if (!event.instanceId || typeof event.message !== "object" || event.message === null) return;
		const [message] = convertAgentMessages(event.instanceId, [event.message as Record<string, unknown>]);
		if (!message) return;
		useSessionMessagesStore.getState().finishMessage(event.instanceId, message);
		useSessionMessagesStore.getState().setStreaming(event.instanceId, false);
		syncMessageQuery(event.instanceId);
		return;
	}
	if (event.type !== "session.event") return;
	if (!event.instanceId) return;
	const sessionEvent = event.sessionEvent as { type?: string; message?: Record<string, unknown> } | undefined;
	if (!sessionEvent?.type) return;
	if (sessionEvent.type === "message_start" && sessionEvent.message) {
		const [message] = convertAgentMessages(event.instanceId, [sessionEvent.message]);
		if (message) useSessionMessagesStore.getState().startMessage(event.instanceId, message);
		useSessionMessagesStore.getState().setStreaming(event.instanceId, message?.role === "assistant");
		syncMessageQuery(event.instanceId);
		return;
	}
	if (sessionEvent.type === "message_update" && sessionEvent.message) {
		const [message] = convertAgentMessages(event.instanceId, [sessionEvent.message]);
		if (message) useSessionMessagesStore.getState().updatePartialMessage(event.instanceId, message);
		useSessionMessagesStore.getState().setStreaming(event.instanceId, message?.role === "assistant");
		syncMessageQuery(event.instanceId);
		return;
	}
	if (sessionEvent.type !== "message_end" || !sessionEvent.message) return;
	const [message] = convertAgentMessages(event.instanceId, [sessionEvent.message]);
	if (message) {
		useSessionMessagesStore.getState().finishMessage(event.instanceId, message);
		useSessionMessagesStore.getState().setStreaming(event.instanceId, false);
		syncMessageQuery(event.instanceId);
	}
}

export function syncDashboardQueries(event: SubAgentEvent): void {
	if (event.type === "task.changed") {
		invalidateTaskQueries(queryClient);
		return;
	}

	const instanceId = event.instanceId;
	if (!instanceId) return;

	if (event.type === "instance.created") {
		void queryClient.invalidateQueries({ refetchType: "active" });
		return;
	}

	if (event.type === "instance.state") {
		if (!readThreadState(event)) return;
		void queryClient.invalidateQueries({ refetchType: "active" });
		return;
	}

	if (event.type === "lifecycle.change") {
		const current = event.current;
		if (typeof current !== "string") return;
		void queryClient.invalidateQueries({ refetchType: "active" });
		return;
	}

	if (event.type === "task.end" || event.type === "error") {
		if (event.type === "task.end") readTaskEndState(event);
		setTimeout(() => {
			void queryClient.invalidateQueries({ refetchType: "active" });
		}, 50);
	}
}

export function syncMessageQuery(instanceId: string): void {
	const messages = useSessionMessagesStore.getState().getMessages(instanceId);
	setThreadMessagesCache(queryClient, instanceId, messages);
}

function readThreadState(event: SubAgentEvent): SubAgentInstanceState | null {
	const state = event.state;
	if (!state || typeof state !== "object" || !("instanceId" in state)) return null;
	const candidate = state as Partial<SubAgentInstanceState>;
	if (typeof candidate.instanceId !== "string") return null;
	if (typeof candidate.taskId !== "string") return null;
	if (typeof candidate.definitionName !== "string") return null;
	if (typeof candidate.state !== "string") return null;
	return candidate as SubAgentInstanceState;
}

function readTaskEndState(event: SubAgentEvent): SubAgentInstanceState["state"] {
	const result = event.result;
	if (result && typeof result === "object" && "status" in result) {
		const status = (result as { status?: unknown }).status;
		if (status === "completed" || status === "blocked" || status === "timed_out" || status === "cancelled") {
			return status;
		}
	}
	return "failed";
}
