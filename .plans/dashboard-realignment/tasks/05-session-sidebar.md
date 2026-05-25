# Tarea 5: Sidebar de sesiones estilo TUI (frontend)

## Objetivo
Reemplazar la vista actual de sesiones por un sidebar que refleje la estructura de proyectos y sesiones de la TUI del coding-agent.

## Criterios de aceptación

- [ ] Sidebar izquierdo fijo con:
  - Header con logo "Pi" y botón "Nuevo chat".
  - Secciones globales: Buscar, Complementos, Automatizaciones, Estados, Configuración.
  - Agrupación por proyecto (cwd): cada proyecto es un grupo expandible con:
    - Nombre del directorio base como título del grupo.
    - Lista de sesiones con nombre/ID truncado.
    - Indicador de estado: punto verde (activo/streaming), gris (stopped).
    - Conteo de mensajes y timestamp relativo ("hace 2 min").
- [ ] Click en sesión navega a `/session/:id` y muestra el chat.
- [ ] Click en "Nuevo chat" crea nueva sesión en el cwd actual y navega a ella.
- [ ] Estado en tiempo real: cuando una sesión cambia de estado (idle → streaming → stopped), el indicador se actualiza via SSE sin polling.
- [ ] Barra de búsqueda para filtrar sesiones por nombre o contenido (client-side).
- [ ] Diseño responsive: en pantallas < 768px el sidebar es un drawer deslizable.
- [ ] Usar Tailwind v4 con tema oscuro (fondo `gray-950`, texto `gray-100`).

## Archivos a crear
- `packages/dashboard/frontend/src/components/Sidebar.tsx`
- `packages/dashboard/frontend/src/components/ProjectGroup.tsx`
- `packages/dashboard/frontend/src/components/SessionItem.tsx`
- `packages/dashboard/frontend/src/components/NewChatButton.tsx`
- `packages/dashboard/frontend/src/store/sessions.ts` (Zustand store para sesiones)

## Archivos a modificar
- `packages/dashboard/frontend/src/App.tsx` (layout con sidebar + área principal)
- `packages/dashboard/frontend/src/orpc.ts` (cliente tipado con endpoints de sesión)

## Notas
- Inspirarse visualmente en la TUI actual: fondo oscuro, tipografía monoespaciada para IDs, colores sutiles.
- Las sesiones deben agruparse por `cwd` (directorio de trabajo). Extraer el nombre del directorio con `basename(cwd)`.
- El store debe mantener un mapa `Map<string, SessionInfo>` para lookups O(1) y una lista ordenada para renderizado.
