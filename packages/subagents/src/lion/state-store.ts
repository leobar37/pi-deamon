import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createLionCore, type LionCore } from "./core.js";
import type { LionState } from "./types.js";

const LION_STATE_FILE = ".pi/lion/state.json";
const LION_DOCUMENT_VERSION = 5;

export interface PersistedLionDocument {
	version: number;
	state: LionState;
	core: LionCore;
	updatedAt: number;
	// sessionId is no longer used for ownership checks. Kept optional for
	// backward compatibility when reading older version 4 documents.
	sessionId?: string | null;
}

export interface LionStateStoreResult {
	state: LionState;
	core: LionCore;
	updatedAt: number;
}

export interface LionWriteResult {
	ok: boolean;
	updatedAt?: number;
	conflict?: boolean;
	error?: string;
}

/**
 * Reads Lion state from a dedicated file on disk.
 * Falls back to legacy session entries if the file does not exist.
 * Returns null if neither source has valid state.
 */
export function readLionState(cwd: string, ctx?: ExtensionContext): LionStateStoreResult | null {
	const path = getLionStatePath(cwd);

	// 1. Try dedicated file first
	if (existsSync(path)) {
		try {
			const raw = readFileSync(path, "utf-8");
			const doc = JSON.parse(raw) as PersistedLionDocument;
			if (
				(doc.version === LION_DOCUMENT_VERSION || doc.version === 4) &&
				isValidState(doc.state) &&
				isValidCore(doc.core)
			) {
				return { state: doc.state, core: doc.core, updatedAt: doc.updatedAt };
			}
			if (doc.version === 3 && isValidState(doc.state) && isValidCore(doc.core)) {
				return { state: doc.state, core: doc.core, updatedAt: doc.updatedAt ?? Date.now() };
			}
		} catch {
			// Corrupted file — fall through to legacy or initial state
		}
	}

	// 2. Fallback: legacy session entries (one-time migration path)
	if (ctx) {
		const legacy = readLegacyLionState(ctx);
		if (legacy) {
			// Migrate to new file format for next time
			writeLionState(cwd, legacy.state, legacy.core);
			return { ...legacy, updatedAt: Date.now() };
		}
	}

	return null;
}

/**
 * Writes Lion state atomically to disk.
 *
 * If `expectedUpdatedAt` is provided, the write succeeds only when the current
 * file either does not exist or has the same `updatedAt`. This prevents lost
 * updates when multiple runtime instances share the same working directory.
 */
export function writeLionState(
	cwd: string,
	state: LionState,
	core: LionCore,
	expectedUpdatedAt?: number,
): LionWriteResult {
	const path = getLionStatePath(cwd);
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	let currentUpdatedAt: number | null = null;
	// Optimistic concurrency check.
	if (expectedUpdatedAt !== undefined && existsSync(path)) {
		try {
			const currentRaw = readFileSync(path, "utf-8");
			const currentDoc = JSON.parse(currentRaw) as PersistedLionDocument;
			if (isValidState(currentDoc.state) && isValidCore(currentDoc.core)) {
				currentUpdatedAt = currentDoc.updatedAt;
			}
			if (currentUpdatedAt !== null && currentUpdatedAt !== expectedUpdatedAt) {
				return {
					ok: false,
					conflict: true,
					error: `Lion state was modified by another session (expected ${expectedUpdatedAt}, found ${currentUpdatedAt}).`,
				};
			}
		} catch {
			// If the current file is unreadable, proceed with the write so that
			// a corrupted file does not permanently block state updates.
		}
	} else if (existsSync(path)) {
		try {
			const currentRaw = readFileSync(path, "utf-8");
			const currentDoc = JSON.parse(currentRaw) as PersistedLionDocument;
			if (isValidState(currentDoc.state) && isValidCore(currentDoc.core)) {
				currentUpdatedAt = currentDoc.updatedAt;
			}
		} catch {
			// If the current file is unreadable, proceed with a fresh timestamp.
		}
	}

	const updatedAt = Math.max(Date.now(), (currentUpdatedAt ?? 0) + 1);
	const doc: PersistedLionDocument = {
		version: LION_DOCUMENT_VERSION,
		state,
		core,
		updatedAt,
	};

	const tempPath = `${path}.tmp`;
	try {
		writeFileSync(tempPath, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");
		renameSync(tempPath, path);
		return { ok: true, updatedAt };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		try {
			if (existsSync(tempPath)) {
				unlinkSync(tempPath);
			}
		} catch {
			/* ignore cleanup errors */
		}
		return { ok: false, error: message };
	}
}

export function getLionStatePath(cwd: string): string {
	return join(cwd, LION_STATE_FILE);
}

// ============================================================================
// Legacy migration helpers
// ============================================================================

const LION_STATE_ENTRY_TYPE_LEGACY = "lion-state";
const LION_CORE_ENTRY_TYPE_LEGACY = "lion-core";

interface LegacyPersistedLionState extends LionState {
	action: string;
	updatedAt: number;
}

interface LegacyPersistedLionCore {
	version: number;
	action: string;
	activeRun: LionCore["activeRun"];
	runHistory: LionCore["runHistory"];
	updatedAt: number;
}

function readLegacyLionState(ctx: ExtensionContext): LionStateStoreResult | null {
	const branch = ctx.sessionManager?.getBranch?.() ?? [];

	const states = branch
		.filter((entry) => entry.type === "custom" && entry.customType === LION_STATE_ENTRY_TYPE_LEGACY)
		.map((entry) => (entry as { data: LegacyPersistedLionState }).data)
		.sort((a, b) => a.updatedAt - b.updatedAt);

	const cores = branch
		.filter((entry) => entry.type === "custom" && entry.customType === LION_CORE_ENTRY_TYPE_LEGACY)
		.map((entry) => (entry as { data: LegacyPersistedLionCore }).data)
		.sort((a, b) => a.updatedAt - b.updatedAt);

	const lastState = states[states.length - 1];
	const lastCore = cores[cores.length - 1];

	if (!lastState || lastState.version !== 2) {
		return null;
	}

	const { action: _action, updatedAt: _updatedAt, ...state } = lastState;

	const core: LionCore =
		lastCore && lastCore.version === 1
			? {
					activeRun: lastCore.activeRun,
					runHistory: lastCore.runHistory,
				}
			: createLionCore();

	return { state: state as LionState, core, updatedAt: Date.now() };
}

// ============================================================================
// Validation
// ============================================================================

function isValidState(value: unknown): value is LionState {
	if (!value || typeof value !== "object") return false;
	const s = value as Record<string, unknown>;
	return (
		s.version === 2 &&
		typeof s.active === "boolean" &&
		typeof s.strategy === "string" &&
		typeof s.phase === "string" &&
		typeof s.maxAttempts === "number" &&
		(s.activePlanPath === null || typeof s.activePlanPath === "string") &&
		(s.activePlanSlug === null || typeof s.activePlanSlug === "string") &&
		(s.activeTaskId === null || typeof s.activeTaskId === "string") &&
		(s.lastRunId === null || typeof s.lastRunId === "string")
	);
}

function isValidCore(value: unknown): value is LionCore {
	if (!value || typeof value !== "object") return false;
	const c = value as Record<string, unknown>;
	return Array.isArray(c.runHistory) && (c.activeRun === null || typeof c.activeRun === "object");
}
