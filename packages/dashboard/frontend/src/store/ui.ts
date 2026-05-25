import { create } from "zustand";

interface UIState {
	activeSessionId: string | null;
	setActiveSession: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
	activeSessionId: null,
	setActiveSession: (id) => set({ activeSessionId: id }),
}));
