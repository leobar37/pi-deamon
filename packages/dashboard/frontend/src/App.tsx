import { useCallback, useEffect, useState } from "react";
import { AgentCanvas } from "./canvas/AgentCanvas.js";
import { SessionInspector } from "./sessions/SessionInspector.js";
import { SessionSidebar } from "./sessions/SessionSidebar.js";
import { getElectronBackendUrl, type CanvasSession } from "./electron.js";

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

function AppContent({ backendUrl }: { backendUrl: string }) {
	const activeSessionId = useHashSessionId();
	const [focusedSessionId, setFocusedSessionId] = useState<string | null>(activeSessionId);
	const [sessions, setSessions] = useState<CanvasSession[]>([]);

	useEffect(() => {
		if (activeSessionId) {
			setFocusedSessionId(activeSessionId);
		}
	}, [activeSessionId]);

	const focusSession = useCallback((sessionId: string) => {
		setFocusedSessionId(sessionId);
		navigateToSession(sessionId);
	}, []);

	const createSession = useCallback(() => {
		const id = crypto.randomUUID();
		setSessions((prev) => [
			...prev,
			{
				id,
				name: `Session ${prev.length + 1}`,
				createdAt: Date.now(),
			},
		]);
		focusSession(id);
	}, [focusSession]);

	const focusedSession = sessions.find((session) => session.id === focusedSessionId);

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
					backendUrl={backendUrl}
					activeSessionId={activeSessionId}
					focusedSessionId={focusedSessionId}
					onFocusSession={focusSession}
					onOpenSession={focusSession}
					onCreateSession={createSession}
				/>
			</main>
			<SessionInspector session={focusedSession} backendUrl={backendUrl} onClose={() => setFocusedSessionId(null)} />
		</div>
	);
}

export default function App() {
	const [backendUrl, setBackendUrl] = useState<string | null>(null);

	useEffect(() => {
		getElectronBackendUrl()
			.then((url) => setBackendUrl(url))
			.catch(() => setBackendUrl(null));
	}, []);

	if (!backendUrl) {
		return (
			<div className="flex h-screen items-center justify-center bg-bg-base text-text-primary">
				<div className="text-center">
					<div className="text-base font-semibold">Connecting to agent backend...</div>
					<div className="mt-2 text-sm text-text-secondary">Waiting for Electron to spawn the subagents process.</div>
				</div>
			</div>
		);
	}

	return <AppContent backendUrl={backendUrl} />;
}
