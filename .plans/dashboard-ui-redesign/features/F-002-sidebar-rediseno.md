# F-002: Sidebar rediseñado con navegación jerárquica

## Objective

Rehacer el sidebar para que se parezca al de ChatGPT: navegación jerárquica con secciones claras, agrupación temporal de chats, proyectos expandibles, y mejor estilo visual.

## Scope Boundaries

### In scope
- Reorganizar estructura del sidebar: acciones globales, chats recientes, proyectos, configuración.
- Agrupar sesiones por tiempo: Hoy, Ayer, Últimos 7 días, Últimos 30 días, Anteriores.
- Mejorar estilos: hover states, selección, tipografía, iconos.
- Agregar items estáticos de navegación: Nuevo chat, Buscar, Complementos, Automatizaciones.
- Mantener funcionalidad existente: crear sesión, seleccionar, colapsar.

### Out of scope
- Funcionalidad de búsqueda real — solo el UI placeholder.
- Funcionalidad de complementos/automatizaciones — solo el UI.
- Cambios en el store de sesiones (salvo helpers de agrupación temporal).

## Verified Context

- `Sidebar.tsx` actual usa `sessionsByCwd` del store Zustand.
- El store ya tiene `loadSessions`, `createSession`, `setActiveSession`.
- Las sesiones tienen `lastActivityAt` para agrupación temporal.

## Assumptions

- La agrupación temporal puede hacerse en el componente sin cambiar el store.
- Los iconos se pueden inlinear como SVG o usar una librería ligera.

## Likely Files

| Path | Action | Reason |
|------|--------|--------|
| `packages/dashboard/frontend/src/components/Sidebar.tsx` | Rewrite | Nueva estructura y estilos |
| `packages/dashboard/frontend/src/store/sessions.ts` | Modify | Agregar helper de agrupación temporal |

## Dependencies

- F-001 (Tema oscuro refinado) — para usar las variables CSS correctas.

## Parallelization

- Can be done in parallel with F-003, F-004, F-006 after F-001.

## Worktree Recommendation

- Use main worktree: `/Users/leobar37/code/opensource/pi`
- Branch: `feat/dashboard-ui-redesign`

## Suggested /plan mode

`structured` — cambios significativos en un componente principal.
