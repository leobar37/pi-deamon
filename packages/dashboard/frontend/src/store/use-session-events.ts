import { useEffect } from "react";
import { useSessionRuntime } from "./provider.js";

/**
 * Subscribes to SSE events for a session.
 * Thin hook — all connection logic lives in the runtime.
 */
export function useSessionEvents(sessionId: string | null) {
	const runtime = useSessionRuntime();

	useEffect(() => {
		if (!sessionId) return;
		return runtime.subscribeSession(sessionId);
	}, [sessionId, runtime]);
}
