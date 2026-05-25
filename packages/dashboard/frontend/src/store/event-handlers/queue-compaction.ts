import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime } from "../runtime.js";
import { defaultStreamingState } from "./types.js";

export function handleQueueUpdate(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "queue_update") return;
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: {
			...defaultStreamingState(),
			...streamState,
			pendingSteering: event.steering,
			pendingFollowUp: event.followUp,
		},
	});
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, pendingMessages: event.steering.length + event.followUp.length },
		});
	}
}

export function handleCompactionStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "compaction_start") return;
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: { ...defaultStreamingState(), ...streamState, isCompacting: true },
	});
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, compacting: true },
		});
	}
}

export function handleCompactionEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "compaction_end") return;
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: { ...defaultStreamingState(), ...streamState, isCompacting: false },
	});
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, compacting: false },
		});
	}
}

export function handleAutoRetryStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "auto_retry_start") return;
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: {
			...defaultStreamingState(),
			...streamState,
			isRetrying: true,
			retryInfo: `Retrying (${event.attempt}/${event.maxAttempts})...`,
		},
	});
}

export function handleAutoRetryEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "auto_retry_end") return;
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: { ...defaultStreamingState(), ...streamState, isRetrying: false, retryInfo: null },
	});
}
