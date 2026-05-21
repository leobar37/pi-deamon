# T-008: Final check and cleanup

**Phase**: integration  
**Dependencies**: T-004, T-007  
**Requirements**: NFR-005, NFR-006

## Objective

Run the full check suite, fix any remaining issues, and clean up.

## Steps

1. **Update exports**: Ensure `packages/subagents/src/index.ts` exports the new primitives (`createEvent`, `TypedEventBus`, `SubAgentEvents`, etc.)
2. **Update type re-exports**: Ensure `packages/extensions/src/extensions/lion/events/types.ts` re-exports `LionEvents` and type helpers
3. **Remove dead code**: Delete `SubAgentEventMap`, `LionEventMap`, and old type aliases if no longer used
4. **Run check**: `bun run check` from repo root — fix all errors, warnings, infos
5. **Run subagent tests**: `cd packages/subagents && bun x tsx ../../node_modules/vitest/dist/cli.js --run test/...`
6. **Run lion tests**: `cd packages/extensions && bun x tsx ../../node_modules/vitest/dist/cli.js --run test/lion/...`
7. **Final review**: Ensure no breaking changes to public API surface

## Verification

- `bun run check` passes with zero errors, warnings, infos
- All tests pass
- Monorepo build succeeds
- No remaining `.emit({ type: string })` or `on(string, handler)` calls in migrated files
