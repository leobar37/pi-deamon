# Changelog

## [Unreleased]

### Added

- **SessionHost** — active session orchestrator for the dashboard server. Manages multiple `LiveSession` instances with lifecycle control (`create`, `start`, `stop`), resource limits (`maxActiveSessions`, `idleTimeoutMs`), and per-session SSE event streaming. Sessions expose an `isActive` flag for quick client-side filtering.
- **Session router** — oRPC endpoints under `/api/sessions.*` for full session CRUD + real-time interaction (`create`, `open`, `continueRecent`, `start`, `stop`, `prompt`, `steer`, `followUp`, `abort`, `state.get`, `messages.get`, `events.stream`).
- **Typed oRPC contract** — exported from `contract.ts` for type-safe client consumption via `@orpc/client`.
- **Backend tests** — 29 tests covering `SessionHost` and `LiveSession` lifecycle, interaction methods, state access, resource limits, idle cleanup, and error paths.
