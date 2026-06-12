/**
 * Helpers for interacting with the Electron preload API.
 */

export interface CanvasSession {
	id: string;
	name: string;
	createdAt: number;
}

export interface ElectronApi {
	readonly platform: string;
	readonly versions: {
		readonly electron: string;
		readonly chrome: string;
		readonly node: string;
	};
	getBackendUrl(): Promise<string>;
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
