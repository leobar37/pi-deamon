import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSession, SessionHost } from "../src/session/index.js";

// ============================================================================
// Helpers
// ============================================================================

let tempDir: string;
let testCounter = 0;

function getTempDir(): string {
	return join(tempDir, `session-host-test-${testCounter++}`);
}

function createMockAgentSession(overrides: Partial<AgentSession> = {}): AgentSession {
	return {
		prompt: vi.fn().mockResolvedValue(undefined),
		steer: vi.fn().mockResolvedValue(undefined),
		followUp: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
		subscribe: vi.fn((_listener: (event: AgentSessionEvent) => void) => {
			return () => {};
		}),
		dispose: vi.fn(),
		isStreaming: false,
		isCompacting: false,
		pendingMessageCount: 0,
		messages: [],
		...overrides,
	} as unknown as AgentSession;
}

vi.mock("@earendil-works/pi-coding-agent", async () => {
	const actual = await vi.importActual("@earendil-works/pi-coding-agent");
	return {
		...actual,
		createAgentSession: vi.fn(),
	};
});

import { createAgentSession } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Setup / Teardown
// ============================================================================

beforeEach(() => {
	tempDir = join(tmpdir(), `pi-dashboard-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });
	vi.clearAllMocks();
});

afterEach(() => {
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch {}
});

// ============================================================================
// SessionHost Tests
// ============================================================================

describe("SessionHost", () => {
	describe("create", () => {
		it("creates a new session and registers it", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, sessionsDir: join(cwd, ".test-sessions") });

			const session = await host.create(cwd);
			expect(session).toBeInstanceOf(LiveSession);
			expect(session.status).toBe("created");
			expect(host.get(session.id)).toBe(session);
			const sessions = await host.list(cwd);
			expect(sessions).toHaveLength(1);
		});

		it("uses defaultCwd when no cwd provided", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const session = await host.create();
			expect(session.cwd).toBe(cwd);
		});
	});

	describe("discover", () => {
		it("discovers all sessions on disk for a project", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const sessionsDir = join(cwd, ".test-sessions");
			mkdirSync(sessionsDir, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, sessionsDir });

			// Write a minimal valid session file on disk
			const now = new Date().toISOString();
			writeFileSync(
				join(sessionsDir, `2026-01-01T00-00-00-000Z_test-a.jsonl`),
				`${JSON.stringify({ type: "session", id: "test-a", cwd, timestamp: now })}\n`,
			);

			const sessions = await host.list(cwd);
			expect(sessions).toHaveLength(1);
			expect(sessions[0].id).toBe("test-a");
			expect(sessions[0].status).toBe("stopped");
			expect(sessions[0].isActive).toBe(false);
		});

		it("reports live runtime status for sessions also in the host", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const sessionsDir = join(cwd, ".test-sessions");
			mkdirSync(sessionsDir, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, sessionsDir });

			// Write a session file on disk
			const now = new Date().toISOString();
			const filePath = join(sessionsDir, `2026-01-01T00-00-00-000Z_test-b.jsonl`);
			writeFileSync(filePath, `${JSON.stringify({ type: "session", id: "test-b", cwd, timestamp: now })}\n`);

			// Now also open it into the host and start it
			const live = await host.open(filePath, cwd);

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});
			await host.start(live.id);

			const sessions = await host.list(cwd);
			const found = sessions.find((s) => s.id === live.id);
			expect(found).toBeDefined();
			expect(found!.isActive).toBe(true);
			expect(found!.status).toBe("idle");
		});

		it("includes host-only sessions not yet persisted to disk", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, sessionsDir: join(cwd, ".test-sessions") });

			const session = await host.create(cwd);
			const sessions = await host.list(cwd);
			const found = sessions.find((s) => s.id === session.id);
			expect(found).toBeDefined();
		});
	});

	describe("get / list", () => {
		it("returns undefined for unknown session", () => {
			const host = new SessionHost();
			expect(host.get("nonexistent")).toBeUndefined();
		});

		it("lists all registered sessions", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, sessionsDir: join(cwd, ".test-sessions") });

			await host.create(cwd);
			await host.create(cwd);

			const sessions = await host.list(cwd);
			expect(sessions.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("remove", () => {
		it("stops and removes a session", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });
			const session = await host.create(cwd);

			const result = await host.remove(session.id);
			expect(result).toBe(true);
			expect(host.get(session.id)).toBeUndefined();
		});

		it("returns false for unknown session", async () => {
			const host = new SessionHost();
			const result = await host.remove("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("maxActiveSessions", () => {
		it("rejects start when at capacity", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, maxActiveSessions: 2 });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const s1 = await host.create(cwd);
			const s2 = await host.create(cwd);
			const s3 = await host.create(cwd);

			await host.start(s1.id);
			await host.start(s2.id);

			await expect(host.start(s3.id)).rejects.toThrow("Max active sessions reached");
		});
	});

	describe("cleanupIdleSessions", () => {
		it("evicts idle sessions past timeout", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({
				defaultCwd: cwd,
				idleTimeoutMs: 100,
				sessionsDir: join(cwd, ".test-sessions"),
			});

			vi.useFakeTimers();
			const session = await host.create(cwd);
			const before = await host.list(cwd);
			expect(before).toHaveLength(1);

			// Advance past timeout
			vi.advanceTimersByTime(200);

			const removed = host.cleanupIdleSessions();
			expect(removed).toContain(session.id);
			const after = await host.list(cwd);
			expect(after).toHaveLength(0);

			vi.useRealTimers();
		});

		it("does not evict active sessions", async () => {
			vi.useFakeTimers();

			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, idleTimeoutMs: 100 });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);

			vi.advanceTimersByTime(200);

			const removed = host.cleanupIdleSessions();
			expect(removed).toHaveLength(0);

			vi.useRealTimers();
		});

		it("evicts sessions in error state", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, idleTimeoutMs: 100 });

			vi.mocked(createAgentSession).mockRejectedValue(new Error("auth error"));

			const session = await host.create(cwd);
			await expect(host.start(session.id)).rejects.toThrow("auth error");

			vi.useFakeTimers();
			vi.advanceTimersByTime(200);

			const removed = host.cleanupIdleSessions();
			expect(removed).toContain(session.id);

			vi.useRealTimers();
		});
	});

	describe("dispose", () => {
		it("stops all sessions and clears registry", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd, sessionsDir: join(cwd, ".test-sessions") });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const s1 = await host.create(cwd);
			const s2 = await host.create(cwd);
			await host.start(s1.id);
			await host.start(s2.id);

			await host.dispose();
			const sessions = await host.list(cwd);
			expect(sessions).toHaveLength(0);
			expect(mockSession.dispose).toHaveBeenCalledTimes(2);
		});
	});
});

// ============================================================================
// LiveSession Tests
// ============================================================================

describe("LiveSession", () => {
	describe("lifecycle transitions", () => {
		it("transitions created -> starting -> idle on successful start", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			expect(session.status).toBe("created");

			await host.start(session.id);
			expect(session.status).toBe("idle");
		});

		it("transitions to error on failed start", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			vi.mocked(createAgentSession).mockRejectedValue(new Error("no auth"));

			const session = await host.create(cwd);
			await expect(host.start(session.id)).rejects.toThrow("no auth");
			expect(session.status).toBe("error");
		});

		it("transitions to stopped on stop()", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			await host.stop(session.id);
			expect(session.status).toBe("stopped");
			expect(mockSession.dispose).toHaveBeenCalled();
		});

		it("rejects start when in error state", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			vi.mocked(createAgentSession).mockRejectedValue(new Error("fail"));

			const session = await host.create(cwd);
			await expect(host.start(session.id)).rejects.toThrow("fail");
			expect(session.status).toBe("error");

			// Second start attempt should throw about error state
			await expect(host.start(session.id)).rejects.toThrow("error state");
		});

		it("no-ops start when already running", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			expect(session.status).toBe("idle");

			// Second start should be no-op
			await host.start(session.id);
			expect(session.status).toBe("idle");
			expect(createAgentSession).toHaveBeenCalledTimes(1);
		});
	});

	describe("interaction methods", () => {
		it("prompt delegates to AgentSession", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			await host.prompt(session.id, "hello");

			expect(mockSession.prompt).toHaveBeenCalledWith("hello", {
				streamingBehavior: undefined,
				source: "rpc",
			});
		});

		it("prompt with streamingBehavior", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			await host.prompt(session.id, "hello", { streamingBehavior: "steer" });

			expect(mockSession.prompt).toHaveBeenCalledWith("hello", {
				streamingBehavior: "steer",
				source: "rpc",
			});
		});

		it("prompt auto-starts an idle session", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			// Session is "created" — prompt should auto-start it
			await host.prompt(session.id, "hello");

			expect(mockSession.prompt).toHaveBeenCalledWith("hello", {
				streamingBehavior: undefined,
				source: "rpc",
			});
		});

		it("prompt fails on session in error state", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			vi.mocked(createAgentSession).mockRejectedValue(new Error("auth failed"));

			const session = await host.create(cwd);
			// First start fails, putting session in error state
			await expect(host.start(session.id)).rejects.toThrow("auth failed");
			expect(session.status).toBe("error");

			// Prompt should fail because session is in error state
			await expect(host.prompt(session.id, "hello")).rejects.toThrow("error state");
		});

		it("steer delegates to AgentSession", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			await host.steer(session.id, "stop");

			expect(mockSession.steer).toHaveBeenCalledWith("stop");
		});

		it("followUp delegates to AgentSession", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			await host.followUp(session.id, "continue");

			expect(mockSession.followUp).toHaveBeenCalledWith("continue");
		});

		it("abort delegates to AgentSession", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			await host.abort(session.id);

			expect(mockSession.abort).toHaveBeenCalled();
		});
	});

	describe("state access", () => {
		it("getMessages returns messages from runtime when active", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockMessages = [{ role: "user", content: "hi" }] as any;
			const mockSession = createMockAgentSession({ messages: mockMessages });
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);

			expect(session.getMessages()).toBe(mockMessages);
		});

		it("getMessages returns messages from disk when stopped", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const session = await host.create(cwd);
			// Session has no runtime, getMessages() should query SessionManager
			const messages = session.getMessages();
			expect(Array.isArray(messages)).toBe(true);
		});

		it("getState returns correct state with runtime", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession({
				isStreaming: true,
				isCompacting: false,
				pendingMessageCount: 3,
				messages: [{ role: "user", content: "a" }] as any,
			});
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);

			const state = session.getState();
			expect(state.isStreaming).toBe(true);
			expect(state.pendingMessageCount).toBe(3);
			expect(state.messageCount).toBe(1);
		});

		it("getState returns default state without runtime", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const session = await host.create(cwd);
			const state = session.getState();

			expect(state.isStreaming).toBe(false);
			expect(state.isCompacting).toBe(false);
			expect(state.pendingMessageCount).toBe(0);
		});
	});

	describe("info", () => {
		it("returns session metadata", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const session = await host.create(cwd);
			const info = session.info;

			expect(info.id).toBe(session.id);
			expect(info.status).toBe("created");
			expect(info.isActive).toBe(false);
			expect(info.cwd).toBe(cwd);
			expect(info.messageCount).toBeGreaterThanOrEqual(0);
		});

		it("reports isActive true for running sessions", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);
			expect(session.info.isActive).toBe(true);

			await host.stop(session.id);
			expect(session.info.isActive).toBe(false);
		});
	});

	describe("event publishing", () => {
		it("subscribes to AgentSession events on start", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			const mockSession = createMockAgentSession();
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);

			expect(mockSession.subscribe).toHaveBeenCalled();
		});

		it("tracks streaming state from agent_start/agent_end events", async () => {
			const cwd = getTempDir();
			mkdirSync(cwd, { recursive: true });
			const host = new SessionHost({ defaultCwd: cwd });

			let capturedListener: ((event: AgentSessionEvent) => void) | null = null;
			const subscribeSpy = vi.fn((listener: (event: AgentSessionEvent) => void) => {
				capturedListener = listener;
				return () => {};
			});
			const mockSession = createMockAgentSession({
				subscribe: subscribeSpy,
			} as any);
			vi.mocked(createAgentSession).mockResolvedValue({
				session: mockSession,
				extensionsResult: { extensions: [], errors: [], runtime: {} as any },
			});

			const session = await host.create(cwd);
			await host.start(session.id);

			expect(capturedListener).not.toBeNull();

			// Simulate agent_start event
			capturedListener!({ type: "agent_start" });
			expect(session.status).toBe("streaming");

			// Simulate agent_end event
			capturedListener!({ type: "agent_end", messages: [] });
			expect(session.status).toBe("idle");
		});
	});
});
