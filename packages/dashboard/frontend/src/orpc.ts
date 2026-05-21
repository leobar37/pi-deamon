import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { DashboardEventPayload, DashboardState } from "./store/dashboard.js";

const link = new RPCLink({
	url: `${window.location.origin}/api`,
});

// Base untyped client from oRPC
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base = createORPCClient(link) as any;

/** Typed wrapper around the oRPC client */
export const orpc = {
	dashboard: {
		state: {
			get: (): Promise<DashboardState> => base.dashboard.state.get(),
		},
		events: {
			stream: (): Promise<AsyncIterableIterator<DashboardEventPayload>> => base.dashboard.events.stream(),
		},
	},
};
