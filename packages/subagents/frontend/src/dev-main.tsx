import { worker } from "./mocks/browser.ts";
import { renderApp } from "./render-app.tsx";

try {
	await worker.start({
		onUnhandledRequest: "bypass",
	});
} catch (err) {
	console.warn("[dev] MSW worker failed to start:", err);
}

renderApp();
