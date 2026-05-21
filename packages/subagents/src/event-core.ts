import { randomUUID } from "node:crypto";

// =============================================================================
// Types
// =============================================================================

export interface TypedEvent<Type extends string = string, Payload = unknown> {
	type: Type;
	payload: Payload;
	timestamp: number;
	id: string;
}

export interface EventCreator<Type extends string, Payload> {
	readonly type: Type;
	(payload: Payload): TypedEvent<Type, Payload>;
	match(event: { type: string }): event is TypedEvent<Type, Payload>;
}

// =============================================================================
// Creator factory
// =============================================================================

export function createEvent<Type extends string, Payload>(type: Type): EventCreator<Type, Payload> {
	const creator = Object.assign(
		(payload: Payload): TypedEvent<Type, Payload> => ({
			type,
			payload,
			timestamp: Date.now(),
			id: randomUUID(),
		}),
		{
			type,
			match(event: { type: string }): event is TypedEvent<Type, Payload> {
				return event.type === type;
			},
		},
	) as EventCreator<Type, Payload>;

	return creator;
}

// =============================================================================
// Typed Event Bus
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEventCreator = EventCreator<string, any>;
type EventHandler<Event = TypedEvent> = (event: Event) => void;

export class TypedEventBus {
	private listeners = new Map<string, Set<EventHandler>>();

	publish<C extends AnyEventCreator>(creator: C, payload: Parameters<C>[0]): void {
		const event = creator(payload);
		this.dispatch(event.type, event);
		this.dispatch("*", event);
	}

	// subscribe(handler) — wildcard
	subscribe(handler: (event: TypedEvent) => void): () => void;

	// subscribe(creator, handler) — typed: handler receives typed event
	subscribe<C extends AnyEventCreator>(
		creator: C,
		handler: (event: TypedEvent<C["type"], Parameters<C>[0]>) => void,
	): () => void;

	subscribe(
		creatorOrHandler: AnyEventCreator | ((event: TypedEvent) => void),
		handler?: (event: TypedEvent) => void,
	): () => void {
		if (!handler && typeof creatorOrHandler === "function") {
			return this.addListener("*", creatorOrHandler);
		}
		return this.addListener((creatorOrHandler as AnyEventCreator).type, handler!);
	}

	clear(): void {
		this.listeners.clear();
	}

	get size(): number {
		let count = 0;
		for (const set of this.listeners.values()) {
			count += set.size;
		}
		return count;
	}

	// =====================================================================
	// Internal (protected so subclasses can reuse dispatch)
	// =====================================================================

	protected addListener(key: string, handler: EventHandler): () => void {
		if (!this.listeners.has(key)) {
			this.listeners.set(key, new Set());
		}
		this.listeners.get(key)!.add(handler);

		return () => {
			this.listeners.get(key)?.delete(handler);
		};
	}

	protected dispatch(type: string, event: TypedEvent): void {
		const handlers = this.listeners.get(type);
		if (!handlers) return;

		for (const handler of handlers) {
			try {
				handler(event);
			} catch {
				// Best-effort event emission; swallow listener errors
			}
		}
	}
}
