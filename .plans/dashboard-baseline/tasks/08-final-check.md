# T-008: Final check + cleanup

**Phase**: integration
**Dependencies**: T-004, T-006, T-007
**Requirements**: NFR-001, NFR-003, NFR-004

## Objective

Run the full check suite, fix issues, verify the package builds correctly.

## Steps

1. **Install deps**: `bun install` from repo root (registers the new workspace package)
2. **Build server**: `cd packages/dashboard && bun run build`
3. **Build frontend**: `cd packages/dashboard/frontend && bun install && bun run build`
4. **Build extensions**: `cd packages/extensions && bun run build`
5. **Run check**: `bun run check` from repo root — fix all errors, warnings, infos
6. **Verify no circular deps**: Check import graph
7. **Manual test**:
   - Start Pi with lion extension
   - Run `/dashboard` command
   - Open browser to the URL
   - Verify event stream works
   - Run `/dashboard stop` to verify shutdown

## Cleanup

- Remove any unused imports
- Ensure public API surface is minimal and documented
- Verify `packages/dashboard/.gitignore` covers all generated files

## Verification

- `bun run check` passes with zero errors, warnings, infos
- `packages/dashboard/dist/index.js` exists and is loadable
- `packages/dashboard/frontend/dist/` exists with HTML/CSS/JS
- No `any` types in dashboard source
