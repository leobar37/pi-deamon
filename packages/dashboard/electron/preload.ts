/**
 * Electron preload script.
 *
 * Exposes a minimal, typed API to the renderer process via contextBridge.
 * All exposed APIs are read-only and safe.
 */

import { contextBridge, ipcRenderer } from "electron";

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

const api: ElectronApi = {
	platform: process.platform,
	versions: {
		electron: process.versions.electron,
		chrome: process.versions.chrome,
		node: process.versions.node,
	},
	getBackendUrl: () => ipcRenderer.invoke("get-backend-url"),
	getDashboardUrl: () => ipcRenderer.invoke("get-dashboard-url"),
	chooseProjectDirectory: () => ipcRenderer.invoke("choose-project-directory"),
	dashboard: {
		createProject: (input) => ipcRenderer.invoke("dashboard:create-project", input),
		listProjects: () => ipcRenderer.invoke("dashboard:list-projects"),
		updateProject: (input) => ipcRenderer.invoke("dashboard:update-project", input),
		deleteProject: (input) => ipcRenderer.invoke("dashboard:delete-project", input),
		createSession: (input) => ipcRenderer.invoke("dashboard:create-session", input),
		listSessions: (input) => ipcRenderer.invoke("dashboard:list-sessions", input),
		updateSession: (input) => ipcRenderer.invoke("dashboard:update-session", input),
		deleteSession: (input) => ipcRenderer.invoke("dashboard:delete-session", input),
		getSessionStatus: (input) => ipcRenderer.invoke("dashboard:get-session-status", input),
		updateLayout: (input) => ipcRenderer.invoke("dashboard:update-layout", input),
		getLayout: (input) => ipcRenderer.invoke("dashboard:get-layout", input),
	},
};

contextBridge.exposeInMainWorld("__PI_ELECTRON__", api);

// Augment the global Window interface for TypeScript in the renderer
declare global {
	interface Window {
		readonly __PI_ELECTRON__?: ElectronApi;
	}
}
