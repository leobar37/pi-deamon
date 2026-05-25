# Worktree Recommendations

## Opción recomendada: Single worktree

Todas las features son frontend-only y tocan archivos en un solo directorio (`packages/dashboard/frontend/src/`). No hay riesgo de conflicto con otros paquetes ni con el backend.

```yaml
branch: feat/dashboard-ui-redesign
worktree: /Users/leobar37/code/opensource/pi  # worktree principal
```

## Justificación

- Scope acotado: solo componentes React + CSS.
- Sin cambios de backend: no hay riesgo de romper API.
- Fácil validación: `bun run check` en `packages/dashboard`.
- Features pequeñas y secuenciales: no justifica múltiples worktrees.

## Alternativa: Worktree dedicado (si se prefiere aislamiento)

```yaml
branch: feat/dashboard-ui-redesign
worktree: /Users/leobar37/code/opensource/pi-worktrees/dashboard-ui-redesign
bootstrap:
  - cd /Users/leobar37/code/opensource/pi && git worktree add ../pi-worktrees/dashboard-ui-redesign feat/dashboard-ui-redesign
  - cd /Users/leobar37/code/opensource/pi-worktrees/dashboard-ui-redesign && bun install
```
