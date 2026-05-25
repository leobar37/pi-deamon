import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime } from "../runtime.js";

export function handleSessionStarted(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "session_started") return;
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, info: { ...entry.info, status: "idle", isActive: true } },
		});
	}
}

export function handleSessionStopped(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "session_stopped") return;
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: {
				...entry,
				info: { ...entry.info, status: "stopped", isActive: false },
				streaming: false,
			},
		});
	}
}

export function handleSessionRemoved(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "session_removed") return;
	runtime.store.set(runtime.maps.sessions.mapAtom, { type: "delete", key: event.sessionId });
}

export function handleSessionCreated(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "session_created") return;
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (!entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: {
				info: {
					id: event.sessionId,
					status: "created",
					isActive: false,
					cwd: "",
					createdAt: event.timestamp,
					lastActivityAt: event.timestamp,
					messageCount: 0,
				},
				streaming: false,
				compacting: false,
				pendingMessages: 0,
			},
		});
	}
}
