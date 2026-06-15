/**
 * Runtime environment adapter for the dashboard frontend.
 *
 * Electron and browser builds share the same React canvas and oRPC HTTP
 * client. Electron only provides native capabilities that browsers do not have,
 * such as opening a directory picker and discovering locally spawned backend
 * URLs through preload IPC.
 */

import { createDashboardClient } from "./api/dashboard-client.js";

export type DashboardEnvironmentKind = "electron" | "web";

export interface ElectronApi {
	readonly platform: string;
	readonly versions: {
		readonly electron: string;
		readonly chrome: string;
		readonly node: string;
	};
	getBackendUrl(): Promise<string>;
	getDashboardUrl(): Promise<string | null>;
	chooseProjectDirectory(): Promise<string | null>;
}

export interface DashboardEnvironment {
	readonly kind: DashboardEnvironmentKind;
	readonly platform: string | null;
	resolveBackendUrl(): Promise<string | null>;
	resolveDashboardUrl(): Promise<string | null>;
	chooseProjectDirectory(): Promise<string | null>;
}

declare global {
	interface Window {
		readonly __PI_ELECTRON__?: ElectronApi;
	}
}

function getQueryParam(name: string): string | null {
	return new URLSearchParams(window.location.search).get(name);
}

function createElectronEnvironment(api: ElectronApi): DashboardEnvironment {
	return {
		kind: "electron",
		platform: api.platform,
		resolveBackendUrl: async () => api.getBackendUrl(),
		resolveDashboardUrl: async () => api.getDashboardUrl(),
		chooseProjectDirectory: async () => api.chooseProjectDirectory(),
	};
}

function createWebEnvironment(): DashboardEnvironment {
	return {
		kind: "web",
		platform: null,
		resolveBackendUrl: async () => {
			const queryUrl = getQueryParam("backendUrl");
			if (queryUrl) return queryUrl;

			const dashboardUrl = getQueryParam("dashboardUrl") ?? window.location.origin;
			try {
				const environment = await createDashboardClient(dashboardUrl).environment.get();
				return environment.subagentsUrl;
			} catch {
				return null;
			}
		},
		resolveDashboardUrl: async () => getQueryParam("dashboardUrl") ?? window.location.origin,
		chooseProjectDirectory: async () => null,
	};
}

export function getDashboardEnvironment(): DashboardEnvironment {
	if (typeof window !== "undefined" && window.__PI_ELECTRON__) {
		return createElectronEnvironment(window.__PI_ELECTRON__);
	}
	return createWebEnvironment();
}
