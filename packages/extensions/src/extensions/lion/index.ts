import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerLionCommands } from "./commands.js";
import { startLionDashboard } from "./dashboard.js";
import { buildPlanningSystemPrompt } from "./prompts/index.js";
import { LionRuntime } from "./runtime.js";
import { registerLionTools } from "./tools.js";
import { stopLionSubagentWidget } from "./ui/subagents-widget.js";

export default function lionExtension(pi: ExtensionAPI): void {
	const runtime = new LionRuntime(pi);
	let daemon: ReturnType<typeof startLionDashboard> | null = null;

	function restore(ctx: ExtensionContext): void {
		runtime.restore(ctx);
	}

	async function ensureDashboard(): Promise<void> {
		if (daemon) return;
		daemon = startLionDashboard(runtime);
		try {
			const url = await daemon.start();
			console.log(`[lion] dashboard at ${url.href}`);
		} catch (err) {
			console.error("[lion] dashboard start failed:", err);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		restore(ctx);
		if (runtime.state.active) {
			await ensureDashboard();
		}
	});
	pi.on("session_tree", async (_event, ctx) => restore(ctx));
	pi.on("session_shutdown", async () => {
		stopLionSubagentWidget(runtime);
		if (daemon) {
			daemon.stop();
			daemon = null;
		}
	});

	// Start dashboard when Lion activates via events from the bus
	runtime.events.on("lion.activate.complete", () => {
		ensureDashboard().catch((err) => console.error("[lion] dashboard ensure failed:", err));
	});

	pi.on("before_agent_start", async (event) => {
		if (!runtime.state.active) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${buildPlanningSystemPrompt(runtime.state)}` };
	});

	registerLionTools(runtime);
	registerLionCommands(pi, runtime);
}
