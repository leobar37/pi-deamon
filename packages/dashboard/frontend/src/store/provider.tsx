import React, { createContext, useContext, useMemo, useEffect } from "react";
import { Provider as JotaiProvider } from "jotai";
import { createSessionRuntime, type SessionRuntime } from "./runtime.js";
import { createOptimisticManager } from "./optimistic.js";
import { createActions } from "./actions.js";

const SessionRuntimeCtx = createContext<SessionRuntime | null>(null);

export function useSessionRuntime(): SessionRuntime {
	const ctx = useContext(SessionRuntimeCtx);
	if (!ctx) throw new Error("useSessionRuntime must be used within SessionRuntimeProvider");
	return ctx;
}

export function SessionRuntimeProvider({ children }: { children: React.ReactNode }) {
	const runtime = useMemo(() => createSessionRuntime(), []);

	// Load sessions on mount
	useEffect(() => {
		const optimistic = createOptimisticManager(runtime);
		const actions = createActions(runtime, optimistic);
		actions.loadSessions().catch(() => {});
	}, [runtime]);

	return (
		<JotaiProvider store={runtime.store}>
			<SessionRuntimeCtx.Provider value={runtime}>{children}</SessionRuntimeCtx.Provider>
		</JotaiProvider>
	);
}
