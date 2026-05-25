import { describe, expect, it } from "vitest";
import { EventStreamProvider } from "../src/events/provider.js";

describe("EventStreamProvider", () => {
	it("publishes events to subscribers", async () => {
		const provider = new EventStreamProvider();
		const sub = provider.subscribe({});
		const event = { sessionId: "s1", timestamp: 1000, type: "agent_start" as const };

		provider.publish(event);

		const result = await sub.next();
		expect(result.done).toBe(false);
		expect(result.value).toMatchObject({ sessionId: "s1", type: "agent_start" });
	});

	it("filters by sessionId", async () => {
		const provider = new EventStreamProvider();
		const sub = provider.subscribe({ sessionId: "s1" });

		provider.publish({ sessionId: "s1", timestamp: 1, type: "agent_start" });
		provider.publish({ sessionId: "s2", timestamp: 2, type: "agent_start" });

		const result = await sub.next();
		expect(result.value).toMatchObject({ sessionId: "s1" });
		// s2 event should not be delivered
	});

	it("filters by eventTypes", async () => {
		const provider = new EventStreamProvider();
		const sub = provider.subscribe({ eventTypes: ["agent_start"] });

		provider.publish({ sessionId: "s1", timestamp: 1, type: "agent_start" });
		provider.publish({ sessionId: "s1", timestamp: 2, type: "message_start", message: "test" });

		const result = await sub.next();
		expect(result.value).toMatchObject({ type: "agent_start" });
	});

	it("emits ping events at interval", async () => {
		const provider = new EventStreamProvider(10); // Fast pings
		const sub = provider.subscribe({});

		// Wait for ping
		await new Promise((r) => setTimeout(r, 30));
		const result = await sub.next();

		expect(result.done).toBe(false);
		expect(result.value).toMatchObject({ type: "ping" });
	});

	it("tracks subscriber count", () => {
		const provider = new EventStreamProvider();
		expect(provider.getSubscriberCount()).toBe(0);

		provider.subscribe({});
		expect(provider.getSubscriberCount()).toBe(1);

		provider.subscribe({});
		expect(provider.getSubscriberCount()).toBe(2);
	});

	it("cleanup on return", async () => {
		const provider = new EventStreamProvider();
		const sub = provider.subscribe({});
		expect(provider.getSubscriberCount()).toBe(1);

		await sub.return?.(undefined);
		expect(provider.getSubscriberCount()).toBe(0);
	});

	it("clear removes all subscribers", () => {
		const provider = new EventStreamProvider();
		provider.subscribe({});
		provider.subscribe({});
		expect(provider.getSubscriberCount()).toBe(2);

		provider.clear();
		expect(provider.getSubscriberCount()).toBe(0);
	});
});
