import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { queryClient } from "./lib/query-client.ts";
import { installDashboardDebugGlobal } from "./dev/debug-ledger.ts";
import "./index.css";

export function renderApp(): void {
	installDashboardDebugGlobal();
	const root = document.getElementById("root");
	if (root) {
		createRoot(root).render(
			<StrictMode>
				<QueryClientProvider client={queryClient}>
					<App />
				</QueryClientProvider>
			</StrictMode>,
		);
	}
}
