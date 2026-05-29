import { worker } from "./mocks/browser.ts";
import { renderApp } from "./render-app.tsx";

await worker.start({
	onUnhandledRequest: "bypass",
});

renderApp();
