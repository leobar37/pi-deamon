# Pi Web Dashboard - Progress Tracker

## Overview

Redesign of the Pi Web dashboard frontend to match a ChatGPT-like interface with refined dark theme, hierarchical sidebar, markdown rendering, and improved UX.

## Completed Features

### F-001: Tema oscuro refinado y estilos base
**Status:** ✅ Complete

**Files changed:**
- `src/index.css` - Added `@theme` block with refined dark theme CSS variables
- `src/App.tsx` - Updated root layout to use new CSS variables (`bg-bg-base`, `text-text-primary`)
- `src/components/MessageItem.tsx` - Fixed pre-existing TypeScript type error

**Palette defined:**
- Pure black base (`#000000`)
- Subtle grays for surfaces, borders, text
- Minimal accent blue
- Status colors: green, red, yellow, orange, purple
- Typography and spacing variables

---

### F-002: Sidebar rediseñado con navegación jerárquica
**Status:** ✅ Complete

**Files changed:**
- `src/components/Sidebar.tsx` - Full rewrite
- `src/store/sessions.ts` - Exported `SessionEntry` interface for reuse

**Implemented:**
- ChatGPT-style layout with global actions (Nuevo chat, Buscar, Complementos, Automatizaciones)
- Temporal grouping: Hoy, Ayer, Últimos 7 días, Últimos 30 días, Anteriores
- Expandable Proyectos section with CWD groups
- Collapsible sidebar
- Connection status indicator
- Streaming pulse indicator on active sessions

---

### F-003: Header de conversación editable
**Status:** ✅ Complete

**Files changed:**
- `src/components/ChatHeader.tsx` - New component
- `src/components/ChatView.tsx` - Integrated ChatHeader, removed StatusIndicators import

**Implemented:**
- Editable conversation title (click to edit, Enter to confirm, Escape to cancel)
- Status dot and label (idle, streaming, error, stopped)
- Subtle state indicators: compacting, retry, queue count
- Model selector placeholder (Auto dropdown)
- Start/Stop runtime buttons

---

### F-004: Renderizado de markdown en mensajes
**Status:** ✅ Complete

**Files changed:**
- `src/components/MarkdownRenderer.tsx` - New component
- `src/components/MessageItem.tsx` - Uses MarkdownRenderer for assistant messages
- `package.json` - Added `react-markdown` dependency

**Implemented:**
- Paragraphs, strong, emphasis
- Unordered and ordered lists
- Inline code with background
- Links with accent color
- Blockquotes
- Horizontal rules
- Headings (h1, h2, h3)

---

### F-005: Bloques de código y HTTP formateados
**Status:** ✅ Complete

**Files changed:**
- `src/components/CodeBlock.tsx` - New component
- `src/components/HttpBlock.tsx` - New component
- `src/components/MarkdownRenderer.tsx` - Integrated custom code renderer
- `package.json` - Added `highlight.js` dependency

**Implemented:**
- Syntax highlighting for: javascript, typescript, json, bash, html/xml
- Copy button with "Copied" feedback
- Language label in code block header
- HTTP block parsing: method, URL, status, headers, body
- JSON body formatting
- Expandable/collapsible body section

---

### F-006: ChatInput rediseñado con controles
**Status:** ✅ Complete

**Files changed:**
- `src/components/ChatInput.tsx` - Full rewrite

**Implemented:**
- Rounded input container with focus ring
- Attach file placeholder button
- Subtle steer mode indicator (blue dot + text)
- Queue chips with accent colors
- Abort button integrated in input area
- Send button with accent-blue background when active
- Auto-resize textarea maintained

---

### F-007: Integración de estados sutiles en chat
**Status:** ✅ Complete

**Files changed:**
- `src/components/StatusIndicators.tsx` - Removed (obsolete)
- `src/components/ChatHeader.tsx` - Already has integrated status indicators
- `src/components/ChatInput.tsx` - Already has steer indicator

**Implemented:**
- Status indicators moved from separate bar to ChatHeader
- Streaming indicator in header with animated dot
- Compacting/retry/queue indicators in header
- Steer mode indicator in ChatInput
- Cleaner vertical space usage

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `react-markdown` | ^10.1.0 | Markdown rendering in assistant messages |
| `highlight.js` | ^11.11.1 | Syntax highlighting for code blocks |

## Build Status

- `bun run build` (frontend): ✅ Passing (0 errors, 0 warnings)
- Bundle size: ~412KB JS, ~15KB CSS (gzipped: 127KB + 4.3KB)

## Remaining Work

None. All 7 features from the dashboard-ui-redesign initiative are complete.

---

## Backend Architecture Overhaul (Session Runtime + Logging)

### F-008: Jotai-based granular state management
**Status:** Complete

**Files changed:**
- `src/store/reactive-map.ts` - Reactive map primitive with per-key atoms
- `src/store/derived-index.ts` - Derived index for grouped views (sessionsByCwd)
- `src/store/runtime.ts` - SessionRuntime with Jotai store, maps, indexes
- `src/store/atoms.ts` - Cached derived atoms per session
- `src/store/hooks.ts` - Thin React hook wrappers
- `src/store/provider.tsx` - SessionRuntimeProvider with loadSessions on mount
- `src/store/event-bridge.ts` - ServerEvent application logic
- `src/store/optimistic.ts` - Optimistic manager with auto-rollback
- `src/store/actions.ts` - High-level CRUD actions
- `src/store/use-session-events.ts` - SSE subscription hook

**Implemented:**
- Replaced monolithic Zustand stores with granular Jotai atoms
- Reactive maps with per-key atoms for fine-grained re-renders
- Derived indexes for sessionsByCwd and messagesBySession
- Event bridge applying ServerEvent deltas to runtime maps
- Optimistic updates for user messages with 30s auto-rollback
- Actions pattern with stable instances via useMemo

### F-009: ORPC native typing
**Status:** Complete

**Files changed:**
- `src/orpc.ts` - Native ORPC typing with DashboardRouter
- `tsconfig.json` - Path mapping for @local/pi-dashboard

**Implemented:**
- createORPCClient<DashboardRouter> with proper typing
- Fallback to `as any` for ORPC v1.14 compatibility

### F-010: Server logging system
**Status:** Complete

**Files changed:**
- `src/logging.ts` (server) - DashboardLogger with circular buffer
- `src/server/daemon.ts` - Integrated logger, direct /api/logs endpoint
- `src/procedures/session.ts` - Try/catch in all handlers with logging
- `src/session/host.ts` - Logging in CRUD and lifecycle
- `src/session/live-session.ts` - Logging in prompts and errors

**Implemented:**
- DashboardLogger with 1000-entry circular buffer
- Levels: debug, info, warn, error with priority filtering
- Context support (sessionId, requestId, etc.)
- Direct HTTP endpoint `/api/logs` (bypasses ORPC routing)
- Query params: level, limit, sessionId
- Request/response logging in DashboardDaemon.fetch
- Error capture with stack traces

**Usage:**
```bash
# All logs
curl http://127.0.0.1:9393/api/logs

# Error level only
curl http://127.0.0.1:9393/api/logs?level=error

# Filter by session
curl http://127.0.0.1:9393/api/logs?sessionId=019e...

# Limit results
curl 'http://127.0.0.1:9393/api/logs?limit=50'
```

### F-011: Bug fixes
**Status:** Complete

**Fixed:**
- Sessions not listing by project: oRPC client was calling `.list()` without arguments, causing BAD_REQUEST. Now passes `{}`.
- Prompt 500 error: Improved error messages in LiveSession._requireRuntime() and SessionHost handlers
- Event bridge message_update/message_end: Now finds most recent partial message instead of blindly taking last
- subscribeSession: Wrapped for await in try/catch with auto-reconnect
- ChatHeader duplicate variables: Removed duplicate hasQueue/queueCount declarations
- All components: Uses useMemo for stable actions instances

### F-012: Frontend component migration
**Status:** Complete

**Files changed:**
- `src/App.tsx` - Hash-based routing, SessionRuntimeProvider
- `src/components/Sidebar.tsx` - Uses new hooks (useSessionList, useSessionsByCwd)
- `src/components/ChatView.tsx` - Uses new hooks, loads messages, subscribes SSE
- `src/components/ChatHeader.tsx` - Uses actions for start/stop
- `src/components/ChatInput.tsx` - Uses actions with optimistic
- `src/components/MessageItem.tsx` - Imports ChatMessage from new store

**Deleted:**
- `src/store/sessions.ts`
- `src/store/chat.ts`
- `src/store/dashboard.ts`

### Build Status

- `bun run build` (frontend): Passing (0 errors, 0 warnings)
- `bun run build` (backend): Passing (0 errors, 0 warnings)
- Bundle size: ~426KB JS, ~17KB CSS (gzipped: 132KB + 4.6KB)

## Notes

- The `packages/dashboard/package.json` name was changed from `@earendil-works/pi-web` to `@local/pi-dashboard` to fix workspace resolution for `bun install`.
- All components use the new CSS theme variables defined in F-001.
- No backend changes were required for this redesign.
