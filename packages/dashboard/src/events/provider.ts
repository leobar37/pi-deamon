/**
 * EventStreamProvider — declarative SSE subscription provider.
 *
 * Replaces the old `DashboardEventBridge` and ad-hoc streaming loops.
 * Supports filtering by sessionId and/or eventTypes.
 *
 * Usage:
 * ```ts
 * const provider = new EventStreamProvider();
 *
 * // Subscribe to all events
 * const sub = provider.subscribe({});
 *
 * // Subscribe to events for a specific session
 * const sub = provider.subscribe({ sessionId: "abc123" });
 *
 * // Publish an event
 * provider.publish(event);
 * ```
 */

import { createPingEvent } from "./serialize.js";
import type { ServerEvent } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface EventStreamFilter {
	sessionId?: string;
	eventTypes?: string[];
}

export interface EventSubscription {
	[Symbol.asyncIterator](): AsyncIterator<ServerEvent>;
}

interface SubscriberEntry {
	filter: EventStreamFilter;
	controller: AbortController;
	queue: ServerEvent[];
	waiting: ((value: IteratorResult<ServerEvent>) => void) | null;
}

// ============================================================================
// EventStreamProvider
// ============================================================================

export class EventStreamProvider {
	private subscribers = new Map<string, SubscriberEntry>();
	private subscriberIdCounter = 0;
	private pingIntervalMs: number;

	constructor(pingIntervalMs = 5000) {
		this.pingIntervalMs = pingIntervalMs;
	}

	/**
	 * Subscribe to events matching the given filter.
	 * Returns an AsyncIterableIterator that yields ServerEvent objects.
	 * The subscription is automatically cleaned up when the iterator is
	 * returned or the caller's AbortSignal fires.
	 */
	subscribe(filter: EventStreamFilter, signal?: AbortSignal): AsyncIterableIterator<ServerEvent> {
		const id = `sub-${++this.subscriberIdCounter}`;
		const controller = new AbortController();

		// Wire external abort to internal controller
		if (signal) {
			const onAbort = () => {
				controller.abort();
				signal.removeEventListener("abort", onAbort);
			};
			signal.addEventListener("abort", onAbort);
			if (signal.aborted) {
				onAbort();
			}
		}

		const entry: SubscriberEntry = {
			filter,
			controller,
			queue: [],
			waiting: null,
		};
		this.subscribers.set(id, entry);

		// When the controller aborts (client disconnects), resolve any pending
		// waiters so the for-await loop terminates instead of hanging forever.
		controller.signal.addEventListener("abort", () => {
			if (entry.waiting) {
				const resolve = entry.waiting;
				entry.waiting = null;
				resolve({ value: undefined, done: true });
			}
			cleanupSub();
		});

		let pingTimer: ReturnType<typeof setInterval> | null = null;

		const iterable: AsyncIterableIterator<ServerEvent> = {
			[Symbol.asyncIterator]() {
				return this;
			},
			next: async () => {
				// Set up ping interval on first call
				if (!pingTimer) {
					const provider = this;
					pingTimer = setInterval(() => {
						if (!controller.signal.aborted) {
							provider._enqueue(id, createPingEvent(filter.sessionId ?? ""));
						}
					}, provider.pingIntervalMs);
				}

				if (controller.signal.aborted) {
					cleanupSub();
					return { value: undefined, done: true };
				}

				// If there's a queued event, return it immediately
				const queued = entry.queue.shift();
				if (queued) {
					return { value: queued, done: false };
				}

				// Otherwise wait for the next event
				return new Promise<IteratorResult<ServerEvent>>((resolve) => {
					entry.waiting = resolve;
				});
			},
			return: async () => {
				cleanupSub();
				return { value: undefined, done: true };
			},
			throw: async (err) => {
				cleanupSub();
				throw err;
			},
		};

		const cleanupSub = () => {
			if (pingTimer) {
				clearInterval(pingTimer);
				pingTimer = null;
			}
			this.subscribers.delete(id);
			controller.abort();
		};

		return iterable;
	}

	/**
	 * Publish an event to all matching subscribers.
	 */
	publish(event: ServerEvent): void {
		for (const [id, entry] of this.subscribers) {
			if (entry.controller.signal.aborted) {
				this.subscribers.delete(id);
				continue;
			}

			// Check sessionId filter
			if (entry.filter.sessionId && entry.filter.sessionId !== event.sessionId) {
				continue;
			}

			// Check eventTypes filter
			if (entry.filter.eventTypes && entry.filter.eventTypes.length > 0) {
				if (!entry.filter.eventTypes.includes(event.type)) {
					continue;
				}
			}

			this._enqueue(id, event);
		}
	}

	/**
	 * Enqueue an event for a subscriber. If the subscriber is waiting
	 * for an event, resolve immediately; otherwise queue it.
	 */
	private _enqueue(subscriberId: string, event: ServerEvent): void {
		const entry = this.subscribers.get(subscriberId);
		if (!entry || entry.controller.signal.aborted) {
			this.subscribers.delete(subscriberId);
			return;
		}

		if (entry.waiting) {
			const resolve = entry.waiting;
			entry.waiting = null;
			resolve({ value: event, done: false });
		} else {
			// Prevent unbounded queue growth — drop oldest events if consumer is slow
			if (entry.queue.length >= 1000) {
				entry.queue.shift();
			}
			entry.queue.push(event);
		}
	}

	/**
	 * Publish a batch of events to all matching subscribers.
	 */
	publishBatch(events: ServerEvent[]): void {
		for (const event of events) {
			this.publish(event);
		}
	}

	/**
	 * Get the number of active subscribers.
	 */
	getSubscriberCount(): number {
		let count = 0;
		for (const [id, entry] of this.subscribers) {
			if (entry.controller.signal.aborted) {
				this.subscribers.delete(id);
				continue;
			}
			count++;
		}
		return count;
	}

	/**
	 * Clean up all subscribers.
	 */
	clear(): void {
		for (const [, entry] of this.subscribers) {
			entry.controller.abort();
		}
		this.subscribers.clear();
	}
}
