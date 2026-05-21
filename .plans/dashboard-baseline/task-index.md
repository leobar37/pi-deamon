# Task Index: Dashboard Package Baseline

## Plan

- **Slug**: dashboard-baseline
- **Mode**: structured
- **Phases**: scaffold → server → frontend → integration

## Tasks

| ID | Title | Phase | Dependencies | Requirements |
|---|---|---|---|---|
| T-001 | Package scaffold | scaffold | — | FR-008, NFR-001 |
| T-002 | DashboardDaemon class | server | T-001 | FR-001, FR-003, NFR-002, NFR-003 |
| T-003 | oRPC router | server | T-002 | FR-004, FR-005 |
| T-004 | Event bridge | server | T-003 | FR-002, NFR-004 |
| T-005 | Frontend scaffold | frontend | — | FR-006, NFR-005, NFR-007 |
| T-006 | Frontend store + components | frontend | T-005 | FR-006 |
| T-007 | Lion integration | integration | T-002, T-004 | FR-007, NFR-006 |
| T-008 | Final check + cleanup | integration | T-004, T-006, T-007 | NFR-001, NFR-003, NFR-004 |

## Phases

1. **scaffold**: Create the package directory, package.json, build.ts, tsconfig
2. **server**: Implement DashboardDaemon, oRPC router, event bridge
3. **frontend**: Vite + React app with Zustand store and components
4. **integration**: Wire into lion extension, run build, verify everything works
