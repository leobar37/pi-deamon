import type { ServerEvent } from "@local/pi-dashboard";
import type { SessionRuntime, SubagentEntry } from "../runtime.js";

export function handleSubagentStart(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "subagent_start") return;
	const entry: SubagentEntry = {
		id: event.id,
		parentId: event.parentId ?? null,
		sessionId: event.sessionId,
		name: event.name,
		status: event.status === "running" ? "running" : "completed",
		startedAt: event.timestamp,
	};
	runtime.store.set(runtime.maps.subagents.mapAtom, { type: "set", key: event.id, value: entry });
}

export function handleSubagentEnd(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "subagent_end") return;
	const existing = runtime.store.get(runtime.maps.subagents.atomFor(event.id));
	if (!existing) return;
	const status =
		event.status === "completed"
			? "completed"
			: event.status === "failed"
				? "failed"
				: event.status === "cancelled"
					? "cancelled"
					: existing.status;
	runtime.store.set(runtime.maps.subagents.mapAtom, {
		type: "set",
		key: event.id,
		value: {
			...existing,
			status,
			result: event.result,
			endedAt: event.timestamp,
		},
	});
}

export function handleSubagentProgress(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "subagent_progress") return;
	const existing = runtime.store.get(runtime.maps.subagents.atomFor(event.id));
	if (!existing) return;
	runtime.store.set(runtime.maps.subagents.mapAtom, {
		type: "set",
		key: event.id,
		value: {
			...existing,
			message: event.message,
			progress: event.progress,
		},
	});
}

export function handleSubagentError(runtime: SessionRuntime, event: ServerEvent): void {
	if (event.type !== "subagent_error") return;
	const existing = runtime.store.get(runtime.maps.subagents.atomFor(event.id));
	if (!existing) return;
	runtime.store.set(runtime.maps.subagents.mapAtom, {
		type: "set",
		key: event.id,
		value: {
			...existing,
			status: "failed",
			error: event.error,
			endedAt: event.timestamp,
		},
	});
}
