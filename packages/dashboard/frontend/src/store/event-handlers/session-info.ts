import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime } from "../runtime.js";

export function handleSessionInfoChanged(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "session_info_changed") return;
	const entry = runtime.store.get(runtime.maps.sessions.atomFor(event.sessionId));
	if (entry) {
		runtime.store.set(runtime.maps.sessions.mapAtom, {
			type: "set",
			key: event.sessionId,
			value: { ...entry, info: { ...entry.info, name: event.name } },
		});
	}
}
