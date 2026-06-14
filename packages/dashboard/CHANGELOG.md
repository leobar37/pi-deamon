# Changelog

## [Unreleased]

### Added

- **SessionHost** — active session orchestrator for the dashboard server. Manages multiple `LiveSession` instances with lifecycle control (`create`, `start`, `stop`), resource limits (`maxActiveSessions`, `idleTimeoutMs`), and per-session SSE event streaming. Sessions expose an `isActive` flag for quick client-side filtering.
- **Session router** — oRPC endpoints under `/api/sessions.*` for full session CRUD + real-time interaction (`create`, `open`, `continueRecent`, `start`, `stop`, `prompt`, `steer`, `followUp`, `abort`, `state.get`, `messages.get`, `events.stream`).
- **Typed oRPC contract** — exported from `contract.ts` for type-safe client consumption via `@orpc/client`.
- **Backend tests** — tests covering `SessionHost`, `LiveSession` lifecycle, interaction methods, state access, resource limits, idle cleanup, and error paths.
- Collapsible left sessions sidebar and right session inspector with persisted open/close state.
- Double-clicking a canvas session node now focuses and centers the node on the canvas.
- "Add session" now creates a real backend thread via the subagents API and stores the returned `threadId`.
- Project-scoped dashboard sessions with folder selection from Electron and sidebar filtering.
- Session runtime snapshots and abort controls for dashboard-managed sessions.
- Typed dashboard event bus with `/events` SSE streaming and `events.list` replay.
- Declarative Pi sessions SDK for catalog, runtime, actions, batch operations, and typed event subscriptions.

### Changed

- The right session inspector is now hidden entirely when no session is focused instead of showing a "No focused session" placeholder.
- "Add session" buttons now show a loading spinner while the backend thread is being created.

### Fixed

- Fixed Electron startup healthcheck: `waitForUrl` now uses `GET` because the subagents HTTP server does not handle `HEAD /`, which caused the 30s timeout shown in the logs.
- Fixed invalid nested `<button>` markup in `SessionSidebar` by converting session rows to `<div role="button">` and keeping the remove action as a real `<button>`, eliminating React hydration/ancestry warnings.
- Fixed session creation allowing rapid repeated clicks by centralizing `isCreatingSession` state and disabling both creation buttons until the backend call completes.
