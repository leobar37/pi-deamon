import type { AnyEventCreator } from "@local/pi-subagents";
import type { LionEvent, LionEventMap, LionEventType } from "../types.js";

export class LionEventBus {
	private listeners = new Map<LionEventType | "*", Set<(event: LionEvent) => void>>();

	on<T extends LionEventType>(type: T, listener: (event: LionEventMap[T]) => void): () => void;
	on(type: "*", listener: (event: LionEvent) => void): () => void;
	on(type: LionEventType | "*", listener: (event: LionEvent) => void): () => void {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type)?.add(listener);
		return () => this.listeners.get(type)?.delete(listener);
	}

	emit<T extends LionEventType>(event: LionEventMap[T]): void {
		for (const listener of this.listeners.get(event.type) ?? []) {
			try {
				listener(event);
			} catch {
				// Best-effort event emission.
			}
		}
		for (const listener of this.listeners.get("*") ?? []) {
			try {
				listener(event);
			} catch {
				// Best-effort event emission.
			}
		}
	}

	publish<C extends AnyEventCreator>(creator: C, payload: Parameters<C>[0]): void {
		const event = creator(payload);
		const flatEvent = {
			...event.payload,
			type: event.type,
			timestamp: event.timestamp,
		} as LionEvent;
		this.emit(flatEvent);
	}

	/** Wildcard subscription compatible with GenericEventBus */
	subscribe(handler: (event: LionEvent) => void): () => void {
		return this.on("*", handler);
	}

	clear(): void {
		this.listeners.clear();
	}
}
