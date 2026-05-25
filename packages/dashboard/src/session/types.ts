// ============================================================================
// Session domain types
// ============================================================================

export type SessionStatus = "created" | "starting" | "idle" | "streaming" | "error" | "stopped";

export interface LiveSessionInfo {
	id: string;
	name?: string;
	status: SessionStatus;
	/** Whether the session has an active agent runtime (starting, idle, or streaming) */
	isActive: boolean;
	sessionFile?: string;
	cwd: string;
	createdAt: number;
	lastActivityAt: number;
	messageCount: number;
}

export interface SessionHostConfig {
	/** Default working directory for new sessions */
	defaultCwd?: string;
	/** Custom sessions directory (default: derived from cwd) */
	sessionsDir?: string;
	/** Maximum concurrently running sessions (default: 10) */
	maxActiveSessions?: number;
	/** Auto-stop idle sessions after N ms (default: 30 min) */
	idleTimeoutMs?: number;
}
