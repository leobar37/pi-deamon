import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { queryClient } from "./lib/query-client.ts";
import "./index.css";

async function enableMocking(): Promise<void> {
	const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
	if (!isDev) return;
	const { worker } = await import("./mocks/browser.ts");
	await worker.start({
		onUnhandledRequest: "bypass",
	});
}

enableMocking().then(() => {
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
});
