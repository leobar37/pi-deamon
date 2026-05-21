export interface DashboardConfig {
	host?: string;
	port?: number;
	frontendDir?: string;
}

export interface GenericEventBus {
	subscribe(handler: (event: unknown) => void): () => void;
}
