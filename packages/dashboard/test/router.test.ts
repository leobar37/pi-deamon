import { describe, expect, it } from "vitest";
import { EventStreamProvider } from "../src/events/provider.js";
import { createDashboardRouter } from "../src/procedures/index.js";

describe("createDashboardRouter", () => {
	it("creates base router with events.stream and state.get", () => {
		const provider = new EventStreamProvider();
		const router = createDashboardRouter(provider, () => 5000);

		expect(router).toHaveProperty("state");
		expect(router).toHaveProperty("events");
	});

	it("includes sessions when sessionHost is provided", async () => {
		const { SessionHost } = await import("../src/session/host.js");
		const provider = new EventStreamProvider();
		const sessionHost = new SessionHost();
		const router = createDashboardRouter(provider, () => 5000, sessionHost);

		expect(router).toHaveProperty("sessions");
	});

	it("procedures have correct shape", async () => {
		const { createDashboardProcedures } = await import("../src/procedures/dashboard.js");
		const provider = new EventStreamProvider();
		const startTime = Date.now();
		const procs = createDashboardProcedures(provider, () => startTime);

		expect(procs).toHaveProperty("state");
		expect(procs).toHaveProperty("events");
	});
});
