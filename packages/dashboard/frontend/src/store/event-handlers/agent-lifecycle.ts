import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime } from "../runtime.js";
import { defaultStreamingState } from "./types.js";

export function handleAgentStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "agent_start") return;
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, streaming: true, info: { ...entry.info, status: "streaming" } },
		});
	}
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: { ...defaultStreamingState(), ...streamState, isStreaming: true },
	});
}

export function handleAgentEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "agent_end") return;
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, streaming: false, info: { ...entry.info, status: "idle" } },
		});
	}
	const streamState = runtime.store.get(runtime.maps.streaming.atomFor(event.sessionId));
	runtime.store.set(runtime.maps.streaming.mapAtom, {
		type: "set",
		key: event.sessionId,
		value: { ...defaultStreamingState(), ...streamState, isStreaming: false },
	});
}
