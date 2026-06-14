import { describe, expect, it } from "vitest";
import { createDashboardEvent, DashboardEventBus } from "../../src/events.js";
import { DashboardEventStream } from "../../src/server/events.js";

async function readFirstSseEvent(response: Response): Promise<string> {
	const reader = response.body!.getReader();
	const decoder = new TextDecoder();
	const { value } = await reader.read();
	reader.cancel().catch(() => undefined);
	return decoder.decode(value);
}

describe("DashboardEventStream", () => {
	it("serves replayed typed SSE events with filters", async () => {
		const bus = new DashboardEventBus();
		const stream = new DashboardEventStream(bus);
		stream.start();
		bus.emit(
			createDashboardEvent("session.action", {
				sessionId: "session-1",
				threadId: "thread-1",
				projectId: "project-1",
				action: "prompt",
			}),
		);

		const response = stream.serve(new Request("http://dashboard.test/events?sessionId=session-1"));
		expect(response?.headers.get("Content-Type")).toBe("text/event-stream");
		const payload = await readFirstSseEvent(response!);
		expect(payload).toContain('"type":"session.action"');
		expect(payload).toContain('"sessionId":"session-1"');
		stream.stop();
	});

	it("ignores non-event requests", () => {
		const stream = new DashboardEventStream(new DashboardEventBus());
		expect(stream.serve(new Request("http://dashboard.test/rpc"))).toBeUndefined();
	});
});
