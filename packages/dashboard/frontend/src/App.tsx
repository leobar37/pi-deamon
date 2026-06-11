import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentCanvas } from "./canvas/AgentCanvas.js";
import { SessionInspector } from "./sessions/SessionInspector.js";
import { SessionSidebar } from "./sessions/SessionSidebar.js";
import { createActions } from "./store/actions.js";
import { createOptimisticManager } from "./store/optimistic.js";
import { SessionRuntimeProvider, useSessionList, useSessionRuntime } from "./store/index.js";

function getHashSessionId(): string | null {
	const hash = window.location.hash;
	return hash.startsWith("#/session/") ? hash.slice("#/session/".length) : null;
}

function useHashSessionId(): string | null {
	const [sessionId, setSessionId] = useState(() => getHashSessionId());

	useEffect(() => {
		const handler = () => setSessionId(getHashSessionId());
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}, []);

	return sessionId;
}

export function navigateToSession(id: string | null) {
	window.location.hash = id ? `#/session/${id}` : "#/";
}

function AppContent() {
	const activeSessionId = useHashSessionId();
	const [focusedSessionId, setFocusedSessionId] = useState<string | null>(activeSessionId);
	const runtime = useSessionRuntime();
	const sessions = useSessionList();
	const actions = useMemo(() => {
		const optimistic = createOptimisticManager(runtime);
		return createActions(runtime, optimistic);
	}, [runtime]);

	useEffect(() => {
		actions.loadSessions().catch(() => {});
		const unsubscribe = runtime.subscribeGlobal();
		return unsubscribe;
	}, [actions, runtime]);

	useEffect(() => {
		if (activeSessionId) {
			setFocusedSessionId(activeSessionId);
		}
	}, [activeSessionId]);

	const focusedSession = useMemo(
		() => sessions.find((session) => session.info.id === focusedSessionId),
		[sessions, focusedSessionId],
	);

	const focusSession = useCallback((sessionId: string) => {
		setFocusedSessionId(sessionId);
		navigateToSession(sessionId);
	}, []);

	const createSession = useCallback(async () => {
		const session = await actions.createSession();
		if (session) {
			await actions.startSession(session.id);
			await actions.loadSessions();
			setFocusedSessionId(session.id);
			navigateToSession(session.id);
		}
	}, [actions]);

	return (
		<div className="flex h-screen overflow-hidden bg-bg-base text-text-primary">
			<SessionSidebar
				sessions={sessions}
				activeSessionId={activeSessionId}
				focusedSessionId={focusedSessionId}
				onFocusSession={focusSession}
				onCreateSession={createSession}
			/>
			<main className="min-w-0 flex-1">
				<AgentCanvas
					sessions={sessions}
					activeSessionId={activeSessionId}
					focusedSessionId={focusedSessionId}
					onFocusSession={focusSession}
					onOpenSession={focusSession}
					onCreateSession={createSession}
				/>
			</main>
			<SessionInspector session={focusedSession} onClose={() => setFocusedSessionId(null)} />
		</div>
	);
}

export default function App() {
	return (
		<SessionRuntimeProvider>
			<AppContent />
		</SessionRuntimeProvider>
	);
}
