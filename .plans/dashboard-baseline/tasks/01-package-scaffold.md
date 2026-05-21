# T-001: Package scaffold

**Phase**: scaffold
**Dependencies**: none
**Requirements**: FR-008, NFR-001

## Objective

Create the `packages/dashboard/` directory with the minimal package structure.

## Files to Create

### `packages/dashboard/package.json`

```json
{
  "name": "@local/pi-dashboard",
  "version": "0.0.1",
  "description": "Real-time web dashboard for Pi showing orchestrator and sub-agent state",
  "type": "module",
  "private": true,
  "keywords": ["pi-package"],
  "scripts": {
    "build": "bun run build.ts",
    "watch": "bun run build.ts --watch",
    "build:frontend": "cd frontend && bun run build"
  },
  "dependencies": {
    "@orpc/server": "^1.14.3",
    "@local/pi-subagents": "workspace:*"
  },
  "peerDependencies": {
    "@earendil-works/pi-agent-core": "*",
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-tui": "*"
  }
}
```

### `packages/dashboard/build.ts`

Same pattern as `packages/subagents/build.ts`:
- Entrypoint: `src/index.ts`
- Output: `dist/index.js`
- Target: bun
- Format: esm
- External: all `@earendil-works/*`, `@local/*`, `@orpc/*`

### `packages/dashboard/tsconfig.build.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

### `packages/dashboard/.gitignore`

```
dist/
node_modules/
frontend/dist/
```

### `packages/dashboard/src/index.ts`

```typescript
export { DashboardDaemon } from "./daemon.js";
export type { DashboardConfig } from "./types.js";
```

## Verification

- `cd packages/dashboard && bun run build` produces `dist/index.js`
- The package can be imported: `import { DashboardDaemon } from "@local/pi-dashboard"`
