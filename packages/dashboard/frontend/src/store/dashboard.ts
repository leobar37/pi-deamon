import { create } from "zustand";

// Local type mirror of the dashboard API contract
export interface DashboardEventPayload {
	id: string;
	type: string;
	source: "lion" | "subagent";
	payload: unknown;
	timestamp: number;
}

export interface DashboardState {
	uptime: number;
	bridgeCount: number;
	subscriberCount: number;
	recentEvents: DashboardEventPayload[];
}

interface DashboardStoreState {
	connected: boolean;
	error: string | null;
	events: DashboardEventPayload[];
	maxEvents: number;
	addEvent: (event: DashboardEventPayload) => void;
	clearEvents: () => void;
	uptime: number;
	bridgeCount: number;
	setConnected: (connected: boolean) => void;
	setServerInfo: (uptime: number, bridgeCount: number) => void;
	sourceFilter: "all" | "lion" | "subagent";
	setSourceFilter: (filter: "all" | "lion" | "subagent") => void;
	typeFilter: string | null;
	setTypeFilter: (type: string | null) => void;
}

export const useDashboardStore = create<DashboardStoreState>((set) => ({
	connected: false,
	error: null,
	events: [],
	maxEvents: 500,
	addEvent: (event) =>
		set((state) => {
			const next = [...state.events, event];
			if (next.length > state.maxEvents) {
				next.shift();
			}
			return { events: next };
		}),
	clearEvents: () => set({ events: [] }),
	uptime: 0,
	bridgeCount: 0,
	setConnected: (connected: boolean) => set({ connected }),
	setServerInfo: (uptime, bridgeCount) => set({ uptime, bridgeCount }),
	sourceFilter: "all",
	setSourceFilter: (filter) => set({ sourceFilter: filter }),
	typeFilter: null,
	setTypeFilter: (type) => set({ typeFilter: type }),
}));
