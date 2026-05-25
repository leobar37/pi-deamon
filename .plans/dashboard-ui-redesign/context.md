# Contexto: Rediseño UI del Dashboard Pi Web

## Estado Actual

El dashboard web (`packages/dashboard/frontend/`) tiene una implementación funcional completa post-realignment:

- **Sidebar**: Lista de sesiones agrupadas por proyecto (cwd), con botón de nuevo chat, búsqueda, y colapso.
- **ChatView**: Área de chat con mensajes (user, assistant, tool, custom), streaming en vivo via SSE, auto-scroll.
- **MessageItem**: Renderizado básico de mensajes con burbujas de chat.
- **ChatInput**: Textarea auto-expandible con modo steer/abort.
- **StatusIndicators**: Barra de estado sobre el chat (streaming, compaction, retry, queue).
- **Stores**: Zustand para sesiones (`sessions.ts`) y chat (`chat.ts`).
- **Cliente oRPC**: Tipado, en `orpc.ts`.

### Problemas visuales actuales
1. **Diseño genérico**: Paleta gris/azul genérica, sin personalidad. Se parece a un dashboard admin genérico, no a una interfaz de chat moderna.
2. **Sidebar poco refinado**: Agrupación por cwd es técnica, no amigable. Falta jerarquía visual clara.
3. **Mensajes sin formato**: Sin soporte para markdown, código, o bloques HTTP. Todo es texto plano.
4. **Status bar intrusiva**: Ocupa espacio vertical constante sobre el chat.
5. **Falta header de conversación**: No hay título editable ni controles de sesión en el área de chat.
6. **Input básico**: Sin controles de modelo, sin accesos rápidos.

## Diseño Objetivo

Interfaz inspirada en ChatGPT/Claude:
- **Tema oscuro refinado**: Negro puro base (#000000), grises sutiles, acentos mínimos.
- **Sidebar izquierdo** con navegación jerárquica clara:
  - Acciones globales: Nuevo chat, Buscar, Complementos, Automatizaciones
  - Chats recientes agrupados por tiempo (Hoy, Ayer, Últimos 7 días, etc.)
  - Proyectos expandibles con sub-items
  - Configuración al final
- **Área de chat principal**:
  - Header con título de conversación editable
  - Mensajes con formato rico: markdown, listas, bloques de código, bloques HTTP
  - Input limpio en la parte inferior con placeholder y botón de enviar
  - Estados integrados sutilmente (no barra intrusiva)

## Referencias

- Imagen actual del dashboard: screenshot con tema oscuro azulado, navegación superior, panel de orchestrator, log de eventos.
- Imagen objetivo: screenshot con sidebar tipo ChatGPT, área de chat con mensajes formateados, input inferior.
