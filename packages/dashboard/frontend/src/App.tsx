import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPiSessionsSdk } from "@local/pi-dashboard/sdk";
import { AgentCanvas } from "./canvas/AgentCanvas.js";
import { SessionInspector } from "./sessions/SessionInspector.js";
import { SessionSidebar } from "./sessions/SessionSidebar.js";
import { getDashboardEnvironment } from "./environment.js";
import type { CanvasSession, CanvasSessionRuntime } from "./canvas/types.js";
import type { CanvasProject } from "./projects/types.js";

const LEFT_SIDEBAR_OPEN_KEY = "pi-dashboard:sidebar-left:open";
const RIGHT_SIDEBAR_OPEN_KEY = "pi-dashboard:sidebar-right:open";
const MOCK_SESSION_ID = "dashboard-mock-session";
const MOCK_THREAD_ID = "main:mock-session";

function isMockCanvasMode(): boolean {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).has("mock");
}

function loadSidebarOpen(key: string, defaultValue: boolean): boolean {
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? raw === "true" : defaultValue;
	} catch {
		return defaultValue;
	}
}

function saveSidebarOpen(key: string, value: boolean): void {
	try {
		window.localStorage.setItem(key, String(value));
	} catch {
		// best effort
	}
}

function directoryName(path: string): string {
	const normalized = path.replace(/\/+$/, "");
	const parts = normalized.split(/[\\/]/);
	return parts.at(-1) || normalized || "Project";
}

function matchesSessionSearch(session: CanvasSession, projects: CanvasProject[], query: string): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return true;

	const project = projects.find((item) => item.id === session.projectId);
	const values = [
		session.name,
		session.id,
		session.threadId ?? "",
		session.cwd ?? "",
		project?.name ?? "",
		project?.defaultCwd ?? "",
	];
	return values.some((value) => value.toLowerCase().includes(normalizedQuery));
}

function AppContent({ backendUrl, dashboardUrl }: { backendUrl: string; dashboardUrl: string }) {
	const environment = useMemo(() => getDashboardEnvironment(), []);
	const isElectronDarwin = environment.kind === "electron" && environment.platform === "darwin";
	const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
	const [sessions, setSessions] = useState<CanvasSession[]>([]);
	const [sessionRuntimes, setSessionRuntimes] = useState<Record<string, CanvasSessionRuntime>>({});
	const [projects, setProjects] = useState<CanvasProject[]>([]);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [leftOpen, setLeftOpen] = useState(() => loadSidebarOpen(LEFT_SIDEBAR_OPEN_KEY, true));
	const [rightOpen, setRightOpen] = useState(() => loadSidebarOpen(RIGHT_SIDEBAR_OPEN_KEY, true));
	const [sessionSearch, setSessionSearch] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);
	const [projectError, setProjectError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
	const [projectPathInput, setProjectPathInput] = useState("");
	const [isCreatingProject, setIsCreatingProject] = useState(false);
	const [isCreatingSession, setIsCreatingSession] = useState(false);
	const creatingSessionRef = useRef(isCreatingSession);

	useEffect(() => {
		creatingSessionRef.current = isCreatingSession;
	}, [isCreatingSession]);
	const sdk = useMemo(() => createPiSessionsSdk({ dashboardUrl }), [dashboardUrl]);

	// Load initial state from dashboard backend
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const [projectList, sessionList, runtimeList] = await Promise.all([
					sdk.projects.list(),
					sdk.sessions.list({}),
					sdk.runtime.list({}),
				]);
				if (!cancelled) {
					setProjects(projectList);
					setSessions(sessionList);
					setSessionRuntimes(Object.fromEntries(runtimeList.map((runtime) => [runtime.id, runtime])));
				}
			} catch (err) {
				console.error("Failed to load dashboard state:", err);
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [sdk]);

	useEffect(() => {
		return sdk.events.subscribe({
			projectId: selectedProjectId ?? undefined,
			onEvent: (event) => {
				switch (event.type) {
					case "project.created":
						setProjects((prev) => (prev.some((project) => project.id === event.project.id) ? prev : [event.project, ...prev]));
						break;
					case "project.updated":
						setProjects((prev) => prev.map((project) => (project.id === event.project.id ? event.project : project)));
						break;
					case "project.deleted":
						setProjects((prev) => prev.filter((project) => project.id !== event.projectId));
						break;
					case "session.created":
						setSessions((prev) => (prev.some((session) => session.id === event.session.id) ? prev : [...prev, event.session]));
						break;
					case "session.updated":
						setSessions((prev) => prev.map((session) => (session.id === event.session.id ? event.session : session)));
						break;
					case "session.deleted":
						setSessions((prev) => prev.filter((session) => session.id !== event.sessionId));
						setSessionRuntimes((prev) => {
							const next = { ...prev };
							delete next[event.sessionId];
							return next;
						});
						setFocusedSessionId((current) => (current === event.sessionId ? null : current));
						break;
					case "session.runtime":
						setSessionRuntimes((prev) => ({ ...prev, [event.runtime.id]: event.runtime }));
						break;
					case "session.action":
						break;
				}
			},
			onError: (error) => console.error("Dashboard event stream failed:", error),
		});
	}, [sdk, selectedProjectId]);

	useEffect(() => {
		if (sessions.length === 0) {
			setSessionRuntimes({});
			return;
		}

		let cancelled = false;
		async function refreshVisibleRuntimes() {
			try {
				const runtimeList = await sdk.runtime.list({ projectId: selectedProjectId ?? undefined });
				if (!cancelled) {
					setSessionRuntimes((prev) => ({
						...prev,
						...Object.fromEntries(runtimeList.map((runtime) => [runtime.id, runtime])),
					}));
				}
			} catch (error) {
				console.error("Failed to refresh session runtime state:", error);
			}
		}

		void refreshVisibleRuntimes();
		return () => {
			cancelled = true;
		};
	}, [sdk, selectedProjectId, sessions.length]);

	useEffect(() => {
		if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
			setSelectedProjectId(null);
		}
	}, [projects, selectedProjectId]);

	useEffect(() => {
		saveSidebarOpen(LEFT_SIDEBAR_OPEN_KEY, leftOpen);
	}, [leftOpen]);

	useEffect(() => {
		saveSidebarOpen(RIGHT_SIDEBAR_OPEN_KEY, rightOpen);
	}, [rightOpen]);

	const focusSession = useCallback((sessionId: string) => {
		setFocusedSessionId(sessionId);
	}, []);

	const selectProject = useCallback(
		(projectId: string | null) => {
			setSelectedProjectId(projectId);
			setFocusedSessionId((current) => {
				if (!current) return null;
				const focused = sessions.find((session) => session.id === current);
				if (!focused) return null;
				return projectId && focused.projectId !== projectId ? null : current;
			});
		},
		[sessions],
	);

	const createProjectFromDirectory = useCallback(
		async (directory: string) => {
			setIsCreatingProject(true);
			try {
				const project = await sdk.projects.create({
					name: directoryName(directory),
					defaultCwd: directory,
				});
				setProjects((prev) => (prev.some((item) => item.id === project.id) ? prev : [project, ...prev]));
				setSelectedProjectId(project.id);
				setProjectPathInput("");
				setIsProjectFormOpen(false);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setProjectError(message);
			} finally {
				setIsCreatingProject(false);
			}
		},
		[sdk],
	);

	const createProject = useCallback(async () => {
		setProjectError(null);
		if (environment.kind === "web") {
			setIsProjectFormOpen(true);
			return;
		}

		const directory = await environment.chooseProjectDirectory();
		if (directory) {
			await createProjectFromDirectory(directory);
		}
	}, [createProjectFromDirectory, environment]);

	const submitProjectPath = useCallback(async () => {
		setProjectError(null);
		const directory = projectPathInput.trim();
		if (!directory) {
			setProjectError("Enter a project directory path.");
			return;
		}
		await createProjectFromDirectory(directory);
	}, [createProjectFromDirectory, projectPathInput]);

	const createSession = useCallback(async () => {
		setCreateError(null);
		if (!selectedProjectId) {
			setCreateError("Select or create a project before adding a session.");
			return;
		}
		if (creatingSessionRef.current) {
			return;
		}

		setIsCreatingSession(true);
		try {
			const session = await sdk.sessions.create({ projectId: selectedProjectId });
			setSessions((prev) => (prev.some((item) => item.id === session.id) ? prev : [...prev, session]));
			setFocusedSessionId(session.id);
			const runtime = await sdk.runtime.get(session.id);
			setSessionRuntimes((prev) => ({ ...prev, [runtime.id]: runtime }));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setCreateError(message);
		} finally {
			setIsCreatingSession(false);
		}
	}, [sdk, selectedProjectId]);

	const removeSession = useCallback(
		async (sessionId: string) => {
			try {
				await sdk.sessions.delete(sessionId);
				setSessions((prev) => prev.filter((s) => s.id !== sessionId));
				setFocusedSessionId((current) => (current === sessionId ? null : current));
			} catch (err) {
				console.error("Failed to delete session:", err);
			}
		},
		[sdk],
	);

	const abortSession = useCallback(
		async (sessionId: string) => {
			try {
				const runtime = await sdk.actions.abort(sessionId);
				setSessionRuntimes((prev) => ({ ...prev, [runtime.id]: runtime }));
			} catch (err) {
				console.error("Failed to abort session:", err);
			}
		},
		[sdk],
	);

	const focusedSession = sessions.find((session) => session.id === focusedSessionId);
	const projectSessions = selectedProjectId ? sessions.filter((session) => session.projectId === selectedProjectId) : sessions;
	const visibleSessions = projectSessions.filter((session) => matchesSessionSearch(session, projects, sessionSearch));
	const canCreateSession = selectedProjectId ? projects.some((project) => project.id === selectedProjectId) : false;

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-bg-base text-text-primary">
				<div className="text-center">
					<div className="text-base font-semibold">Loading dashboard...</div>
				</div>
			</div>
		);
	}

	return (
		<div className={`relative flex h-screen overflow-hidden bg-bg-base text-text-primary ${isElectronDarwin ? "pt-window-drag" : ""}`}>
			{isElectronDarwin ? <div className="electron-window-drag-region" aria-hidden="true" /> : null}
			<SessionSidebar
				isOpen={leftOpen}
				onToggle={() => setLeftOpen((open) => !open)}
				projects={projects}
				sessions={sessions}
				visibleSessions={visibleSessions}
				sessionSearch={sessionSearch}
				selectedProjectId={selectedProjectId}
				focusedSessionId={focusedSessionId}
				projectError={projectError}
				isProjectFormOpen={isProjectFormOpen}
				projectPathInput={projectPathInput}
				isCreatingProject={isCreatingProject}
				sessionRuntimes={sessionRuntimes}
				onSessionSearchChange={setSessionSearch}
				onSelectProject={selectProject}
				onCreateProject={createProject}
				onProjectPathChange={setProjectPathInput}
				onSubmitProjectPath={submitProjectPath}
				onCancelProjectPath={() => {
					setProjectPathInput("");
					setProjectError(null);
					setIsProjectFormOpen(false);
				}}
				onFocusSession={focusSession}
				onCreateSession={createSession}
				canCreateSession={canCreateSession}
				isCreatingSession={isCreatingSession}
				onRemoveSession={removeSession}
				onAbortSession={abortSession}
			/>
			<main className="relative min-w-0 flex-1">
				<AgentCanvas
					sessions={visibleSessions}
					backendUrl={backendUrl}
					dashboardUrl={dashboardUrl}
					focusedSessionId={focusedSessionId}
					onFocusSession={focusSession}
					onOpenSession={focusSession}
					onCreateSession={createSession}
					canCreateSession={canCreateSession}
					isCreatingSession={isCreatingSession}
					onRemoveSession={removeSession}
					sessionRuntimes={sessionRuntimes}
					onAbortSession={abortSession}
				/>
				{createError ? (
					<div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error shadow-md">
						<span>Failed to create session: {createError}</span>
						<button
							type="button"
							onClick={() => setCreateError(null)}
							className="rounded px-1.5 py-0.5 hover:bg-error/20"
						>
							Dismiss
						</button>
					</div>
				) : null}
			</main>
			<SessionInspector
				isOpen={rightOpen}
				onToggle={() => setRightOpen((open) => !open)}
				session={focusedSession}
				backendUrl={backendUrl}
				runtime={focusedSession ? sessionRuntimes[focusedSession.id] : undefined}
				onAbortSession={abortSession}
				onClose={() => setFocusedSessionId(null)}
			/>
		</div>
	);
}

function MockCanvasContent() {
	const params = new URLSearchParams(window.location.search);
	const backendUrl = params.get("backendUrl") ?? "http://127.0.0.1:5174";
	const mockMode = params.get("mock");
	const dashboardUrl = window.location.origin;
	const [focusedSessionId, setFocusedSessionId] = useState<string | null>(MOCK_SESSION_ID);
	const runtime: CanvasSessionRuntime = {
		id: MOCK_SESSION_ID,
		threadId: MOCK_THREAD_ID,
		state: "idle",
		isLive: true,
		isRunning: false,
		canPrompt: true,
		canFollowUp: true,
		canSteer: false,
		canAbort: false,
		canResume: false,
		canCancel: false,
		canKill: false,
		lastActivityAt: Date.now(),
		error: null,
		turnCount: 4,
		toolCount: 7,
		durationMs: 51000,
		modelProvider: "openai-codex",
		modelId: "gpt-5.5",
	};
	const session: CanvasSession = {
		id: MOCK_SESSION_ID,
		name: mockMode === "todos" ? "Todos session" : "Canvas preview",
		createdAt: Date.now(),
		projectId: "mock-project",
		cwd: "/mock/project",
		threadId: MOCK_THREAD_ID,
		runtime,
	};

	return (
		<div className="relative flex h-screen overflow-hidden bg-bg-base text-text-primary">
			<main className="relative min-w-0 flex-1">
				<AgentCanvas
					sessions={[session]}
					backendUrl={backendUrl}
					dashboardUrl={dashboardUrl}
					focusedSessionId={focusedSessionId}
					onFocusSession={setFocusedSessionId}
					onOpenSession={setFocusedSessionId}
					onCreateSession={() => undefined}
					canCreateSession={false}
					onRemoveSession={() => undefined}
					sessionRuntimes={{ [MOCK_SESSION_ID]: runtime }}
					onAbortSession={() => undefined}
				/>
			</main>
		</div>
	);
}

export default function App() {
	if (isMockCanvasMode()) {
		return <MockCanvasContent />;
	}

	return <ConnectedApp />;
}

function ConnectedApp() {
	const environment = useMemo(() => getDashboardEnvironment(), []);
	const [backendUrl, setBackendUrl] = useState<string | null>(null);
	const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		Promise.all([environment.resolveBackendUrl(), environment.resolveDashboardUrl()])
			.then(([backend, dashboard]) => {
				if (backend && dashboard) {
					setBackendUrl(backend);
					setDashboardUrl(dashboard);
				} else if (!backend) {
					setError("No backend URL available. Open this app through Electron or provide ?backendUrl=.");
				} else {
					setError("No dashboard URL available.");
				}
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : String(err));
			});
	}, [environment]);

	if (error) {
		return (
			<div className="flex h-screen items-center justify-center bg-bg-base text-text-primary">
				<div className="max-w-md text-center">
					<div className="text-base font-semibold text-error">Failed to connect</div>
					<div className="mt-2 text-sm text-text-secondary">{error}</div>
				</div>
			</div>
		);
	}

	if (!backendUrl || !dashboardUrl) {
		return (
			<div className="flex h-screen items-center justify-center bg-bg-base text-text-primary">
				<div className="text-center">
					<div className="text-base font-semibold">Connecting...</div>
					<div className="mt-2 text-sm text-text-secondary">Waiting for backends to start.</div>
				</div>
			</div>
		);
	}

	return <AppContent backendUrl={backendUrl} dashboardUrl={dashboardUrl} />;
}
