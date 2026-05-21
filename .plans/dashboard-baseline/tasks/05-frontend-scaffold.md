# T-005: Frontend scaffold

**Phase**: frontend
**Dependencies**: none (parallel to server tasks)
**Requirements**: FR-006, NFR-005, NFR-007

## Objective

Create a Vite + React project under `packages/dashboard/frontend/` with Tailwind CSS and the oRPC client pre-configured.

## Files to Create

### `packages/dashboard/frontend/package.json`

```json
{
  "name": "@local/pi-dashboard-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@orpc/client": "^1.14.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

### `packages/dashboard/frontend/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:9393",
    },
  },
  build: {
    outDir: "dist",
  },
});
```

### `packages/dashboard/frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

### `packages/dashboard/frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pi Dashboard</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### `packages/dashboard/frontend/src/main.tsx`

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### `packages/dashboard/frontend/src/index.css`

```css
@import "tailwindcss";
```

### `packages/dashboard/frontend/src/App.tsx`

Simple placeholder:
```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <h1 className="text-xl font-bold">Pi Dashboard</h1>
      <p className="text-gray-400 mt-2">Connecting to server...</p>
    </div>
  );
}
```

### `packages/dashboard/frontend/src/orpc.ts`

```typescript
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

// In dev, Vite proxy handles /api → localhost:9393
// In production, same origin
const link = new RPCLink({
  url: `${window.location.origin}/api`,
});

export const orpc = createORPCClient(link);
```

## Verification

- `cd packages/dashboard/frontend && bun install && bun run build` succeeds
- `bun run dev` starts Vite dev server
- The built output goes to `frontend/dist/`
