# T-007: Lion integration

**Phase**: integration
**Dependencies**: T-002, T-004
**Requirements**: FR-007, NFR-006

## Objective

Wire the DashboardDaemon into the lion extension. Create the daemon during extension init, bridge lion events, and register the `/dashboard` command.

## Changes

### `packages/extensions/package.json`

Add dependency:
```json
"dependencies": {
  "@local/pi-dashboard": "workspace:*",
  "@local/pi-subagents": "workspace:*",
  "diff": "^8.0.2"
}
```

### `packages/extensions/src/extensions/lion/index.ts`

```typescript
import { DashboardDaemon } from "@local/pi-dashboard";
// ... existing imports

export default function lionExtension(pi: ExtensionAPI): void {
  const runtime = createLionRuntime();
  const dashboard = new DashboardDaemon();

  // Bridge lion events
  pi.on("session_start", (_event, ctx) => {
    restore(runtime, ctx);
    dashboard.bridge(runtime.events, "lion");
  });

  // Register /dashboard command
  pi.registerCommand("dashboard", {
    description: "Start Pi dashboard web UI",
    handler: async (args) => {
      if (dashboard.isRunning && args.trim() === "stop") {
        dashboard.stop();
        return "Dashboard stopped.";
      }
      
      const port = parseInt(args.trim(), 10) || 9393;
      const url = await dashboard.start(port);
      return `Dashboard running at ${url.href}`;
    },
  });

  // Stop on shutdown
  pi.on("session_shutdown", async () => {
    dashboard.stop();
  });

  // ... rest of existing lion extension setup
}
```

### Event Bridge Scope

The daemon bridges:
- `runtime.events` (LionEventBus) — all Lion orchestrator events
- `runtime.controllers.forEach(c => c.getEventBus())` — SubAgentEventBus for each active controller

Since controllers are created lazily during tool execution, we need to subscribe new controllers as they appear. The daemon's `bridge()` method handles this:

```typescript
// In tools.ts, after creating a controller
runtime.controllers.set(runId, controller);
dashboard.bridge(controller.getEventBus(), "subagent");
```

This requires either:
1. Exposing the `bridge` method on the daemon publicly
2. Having a hook in the daemon for new bus registration

Option 1 is simpler — we just call `dashboard.bridge()` after `controller.getEventBus()` is available.

## Verification

- `/dashboard` command starts the server and returns a URL
- Opening the URL in a browser connects to the dashboard
- Events from Lion and SubAgent buses appear in real-time
- `/dashboard stop` stops the server
- `session_shutdown` cleanly stops the daemon
