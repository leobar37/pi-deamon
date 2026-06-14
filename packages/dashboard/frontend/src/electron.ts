/**
 * Helpers for interacting with the Electron preload API.
 */

export interface ElectronApi {
	readonly platform: string;
	readonly versions: {
		readonly electron: string;
		readonly chrome: string;
		readonly node: string;
	};
	/**
	 * Resolves with the subagents backend URL once it is available.
	 */
	getBackendUrl(): Promise<string>;
	/**
	 * Resolves with the dashboard backend URL.
	 */
	getDashboardUrl(): Promise<string | null>;
	chooseProjectDirectory(): Promise<string | null>;
	dashboard: {
		createProject(input: { name: string; defaultCwd: string }): Promise<unknown>;
		listProjects(): Promise<unknown>;
		updateProject(input: { id: string; name?: string }): Promise<unknown>;
		deleteProject(input: { id: string }): Promise<unknown>;
		createSession(input: { projectId: string; name?: string }): Promise<unknown>;
		listSessions(input?: { projectId?: string }): Promise<unknown>;
		updateSession(input: { id: string; name?: string }): Promise<unknown>;
		deleteSession(input: { id: string }): Promise<unknown>;
		getSessionStatus(input: { id: string }): Promise<unknown>;
		updateLayout(input: { sessionId: string; x: number; y: number; width: number; height: number }): Promise<unknown>;
		getLayout(input: { sessionId: string }): Promise<unknown>;
	};
}

declare global {
	interface Window {
		readonly __PI_ELECTRON__?: ElectronApi;
	}
}

export async function getElectronBackendUrl(): Promise<string | null> {
	if (typeof window !== "undefined" && window.__PI_ELECTRON__) {
		try {
			return await window.__PI_ELECTRON__.getBackendUrl();
		} catch (err) {
			console.error("Failed to get backend URL from Electron:", err);
		}
	}
	return null;
}

export async function getElectronDashboardUrl(): Promise<string | null> {
	if (typeof window !== "undefined" && window.__PI_ELECTRON__) {
		try {
			return await window.__PI_ELECTRON__.getDashboardUrl();
		} catch (err) {
			console.error("Failed to get dashboard URL from Electron:", err);
		}
	}
	return null;
}

export function getElectronApi(): ElectronApi | null {
	if (typeof window !== "undefined" && window.__PI_ELECTRON__) {
		return window.__PI_ELECTRON__;
	}
	return null;
}

/**
 * Resolve a backend URL for a canvas session. In Electron this comes from the
 * preload API. Outside Electron it can be provided via the ?backendUrl= query
 * param for local development.
 */
export async function resolveBackendUrl(): Promise<string | null> {
	const electronUrl = await getElectronBackendUrl();
	if (electronUrl) return electronUrl;

	const params = new URLSearchParams(window.location.search);
	const queryUrl = params.get("backendUrl");
	if (queryUrl) return queryUrl;

	return null;
}

/**
 * Resolve the dashboard backend URL. In Electron this comes from the preload
 * API. Outside Electron it can be provided via the ?dashboardUrl= query param.
 */
export async function resolveDashboardUrl(): Promise<string | null> {
	const electronUrl = await getElectronDashboardUrl();
	if (electronUrl) return electronUrl;

	const params = new URLSearchParams(window.location.search);
	const queryUrl = params.get("dashboardUrl");
	if (queryUrl) return queryUrl;

	return null;
}
