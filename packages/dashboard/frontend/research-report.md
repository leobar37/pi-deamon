# Research Report: Markdown Rendering & Agent Event UI Best Practices

## 1. Estado Actual del Repositorio

### 1.1 Librerías de Markdown ya en uso

| Paquete | Versión | Ubicación | Uso |
|---------|---------|-----------|-----|
| `react-markdown` | ^10.1.0 | `packages/dashboard/frontend` | Renderizado de markdown en mensajes del asistente |
| `highlight.js` | ^11.11.1 | `packages/dashboard/frontend` | Syntax highlighting en bloques de código |
| `marked` | ^15.0.12 | `packages/coding-agent` (export HTML) | Exportación a HTML estático |
| `highlight.js` | ^11.11.1 | `packages/web-ui` | Syntax highlighting en artifacts |

### 1.2 Componentes existentes en el dashboard frontend

```
packages/dashboard/frontend/src/components/
├── MarkdownRenderer.tsx    # react-markdown con custom components
├── CodeBlock.tsx           # highlight.js con copy button
├── HttpBlock.tsx           # Bloques HTTP formateados
├── blocks/
│   ├── BlockRenderer.tsx   # Dispatcher por tipo de bloque
│   ├── TextBlock.tsx       # Markdown via MarkdownRenderer
│   ├── ThinkingBlock.tsx   # Collapsible thinking content
│   ├── ToolCallBlock.tsx   # Expandable tool call args
│   ├── ToolResultBlock.tsx # Tool result con error state
│   └── ImageBlock.tsx      # Imagen base64
├── MessageItem.tsx         # Renderizado por rol (user/assistant/tool/custom)
├── ChatView.tsx            # Contenedor con scroll + SSE subscription
└── ChatInput.tsx           # Input con auto-resize
```

### 1.3 Arquitectura de estado (Jotai-based)

```
store/
├── provider.tsx       # SessionRuntimeProvider (JotaiProvider + context)
├── runtime.ts         # SessionRuntime: maps + indexes + SSE subscription
├── atoms.ts           # Atom factories con WeakMap caching
├── event-bridge.ts    # Dispatcher de ServerEvent -> state mutations
├── message-blocks.ts  # Normalización de bloques + merge deltas
├── optimistic.ts      # Optimistic UI para mensajes del usuario
├── actions.ts         # API calls via oRPC client
└── hooks.ts           # useSession, useSessionMessages, etc.
```

**Eventos SSE manejados:** `session_started/stopped/removed`, `agent_start/end`, `message_start/update/end`, `thinking_start/delta/end`, `text_delta`, `tool_execution_start/end`, `queue_update`, `compaction_start/end`, `auto_retry_start/end`, `session_info_changed`, `session_created`.

### 1.4 Patrón de renderizado por bloques

El sistema ya usa un **block-based rendering** que normaliza el contenido del agente en `MessageBlock`:

```typescript
type MessageBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string; redacted?: boolean }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "toolResult"; toolCallId: string; content: string; isError: boolean }
  | { type: "image"; data: string; mimeType: string };
```

`BlockRenderer` hace dispatch por `switch` a componentes específicos. Este patrón es correcto y alineado con las mejores prácticas.

---

## 2. Mejores Prácticas: Markdown Rendering en React

### 2.1 Opciones de librerías evaluadas

| Librería | Pros | Cons | Recomendación |
|----------|------|------|---------------|
| **react-markdown** (ya en uso) | Ecosistema remark/rehype maduro, custom components, GFM, seguro contra XSS | Re-parsea todo el markdown en cada token de streaming — puede causar flicker en streaming | **Mantener** — es el estándar de facto |
| **marked** | Rápido, ligero, parser directo | No es React-native; requiere `dangerouslySetInnerHTML` | Solo para exportación estática (ya se usa así) |
| **@m2d/react-markdown** | Benchmarks muestran ~19x más rápido que react-markdown | Menos maduro, menor ecosistema | Evaluar si el performance es crítico |
| **streaming-markdown** (thetarnav) | Optimizado para streaming incremental | Muy nuevo, API inestable | Monitorear |

### 2.2 Syntax Highlighting: Comparativa

| Librería | Gramáticas | Bundle (aprox) | SSR | Calidad | Recomendación |
|----------|-----------|----------------|-----|---------|---------------|
| **highlight.js** (ya en uso) | Heurísticas regex | ~30KB (core + 5 langs) | Sí | Buena | **Mantener por ahora** — suficiente para lenguajes populares |
| **Prism.js / refractor** | Regex | ~15-40KB | Sí (refractor) | Buena | Alternativa viable |
| **Shiki** | TextMate (VS Code) | ~200KB+ (con wasm) | Sí | Excelente | **Recomendado a futuro** si se necesita calidad VS Code-level y el bundle es aceptable |

**Nota:** Shiki v1+ soporta `shiki/core` con lazy-loading de lenguajes, reduciendo el bundle inicial. Para un dashboard de agente, la calidad del highlighting mejora la percepción de profesionalismo.

### 2.3 Recomendación técnica para markdown

**Stack recomendado:**

```
react-markdown          # ^10.1.0 (ya instalado)
remark-gfm              # GitHub Flavored Markdown (tablas, strikethrough, etc.)
rehype-highlight        # Integración highlight.js con rehype
highlight.js            # ^11.11.1 (ya instalado)
```

**Configuración óptima:**

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Para streaming: envolver en React.memo con comparación de contenido
const StreamingMarkdown = React.memo(function StreamingMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) return <code className="inline-code">{children}</code>;
          return <CodeBlock code={String(children)} language={className?.replace("language-", "")} />;
        },
        // ... otros overrides
      }}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);
```

**Problema de streaming con react-markdown:**

Cada token nuevo fuerza un re-parse completo del AST de remark. Para mitigar:

1. **Memoización agresiva** del componente Markdown (ya parcialmente implementado)
2. **Debounce de 50-100ms** en la actualización del texto durante streaming
3. **Considerar `react-fast-marquee` o solución incremental** si el performance se degrada
4. **Alternativa avanzada:** Usar `react-markdown` solo para el renderizado final (cuando `streaming=false`) y mostrar texto plano durante el stream

---

## 3. Patrones de Componentes para Eventos de Agente

### 3.1 Análisis de proyectos de referencia

#### Vercel AI SDK (`useChat`)
- **Modelo de mensajes:** Array de `Message { id, role, content, parts? }`
- **Streaming:** El hook maneja el estado interno; el componente consume `messages` y `isLoading`
- **Tool calls:** Renderizados como mensajes intermedios con estado `pending` / `completed`
- **Patrón clave:** Separación entre `Message` (datos) y `MessageRenderer` (UI)

#### Claude Interface (Anthropic)
- **Thinking blocks:** Collapsible por defecto, shimmer effect durante streaming
- **Tool calls:** Tarjeta expandible con nombre, args, y resultado
- **Errores:** Banner inline con icono y mensaje
- **Patrón clave:** Cada bloque tiene su propio estado de UI (expanded/collapsed)

#### OpenAI Playground
- **Event stream:** Server-sent events con eventos tipados (`content.delta`, `tool_calls.function.arguments.delta`)
- **Renderizado:** Mensajes se construyen incrementalmente a partir de deltas
- **Patrón clave:** Acumulación de deltas en el estado, no reemplazo

### 3.2 Patrón recomendado: "Event Stream UI"

```
ServerEvent (SSE)
    |
    v
[event-bridge.ts]  --->  State Mutation (Jotai atoms)
    |
    v
[React Components]  --->  UI Rendering
```

**Principios:**

1. **Eventos son la fuente de verdad** — El estado UI se deriva del stream de eventos
2. **Inmutabilidad** — Cada evento produce un nuevo estado, nunca mutación directa
3. **Idempotencia** — Reprocesar el mismo evento no debe cambiar el estado
4. **Deltas, no reemplazos** — `text_delta` agrega texto, no reemplaza el mensaje completo

### 3.3 Estructura de componentes recomendada

```
components/
├── messages/
│   ├── MessageList.tsx           # Lista virtualizada o scrollable
│   ├── MessageItem.tsx           # Dispatcher por rol
│   ├── UserMessage.tsx           # Mensaje del usuario
│   ├── AssistantMessage.tsx      # Mensaje del asistente (con bloques)
│   ├── ToolMessage.tsx           # Wrapper para tool call + result
│   └── SystemMessage.tsx         # Mensajes del sistema (info, errores)
├── blocks/
│   ├── BlockRenderer.tsx         # Dispatcher por tipo de bloque
│   ├── TextBlock.tsx             # Markdown rendering
│   ├── ThinkingBlock.tsx         # Collapsible thinking
│   ├── ToolCallBlock.tsx         # Tool call con expand/collapse
│   ├── ToolResultBlock.tsx       # Resultado de tool
│   ├── CodeBlock.tsx             # Syntax highlighting
│   └── ImageBlock.tsx            # Imagen
├── streaming/
│   ├── StreamingCursor.tsx       # Cursor parpadeante
│   ├── StreamingIndicator.tsx    # "Thinking..." shimmer
│   └── StreamingText.tsx         # Texto que se actualiza con debounce
└── strategies/                    # Strategy pattern (ver sección 4)
    ├── index.ts
    ├── types.ts
    └── renderers/
```

---

## 4. Strategy Pattern para Renderizado

### 4.1 Problema con el código actual

El `event-bridge.ts` tiene un dispatcher con funciones separadas por tipo de evento. Esto es **bueno**. Sin embargo, el manejo de mensajes duplicados (`handleMessageStart`) mezcla responsabilidades:

```typescript
// PROBLEMA: SRP violation + alta complejidad ciclomática
function handleMessageStart(runtime, event) {
  // ... lógica de deduplicación mezclada con creación de mensaje
  if (role === "user") {
    for (const id of msgIds) {
      const existing = runtime.store.get(...);
      if (existing && existing.role === "user" && !existing.optimistic) {
        const existingText = existing.blocks.map(...).join("");
        const newText = blocks.map(...).join("");
        if (existingText.trim() === newText.trim()) {
          return; // Duplicate
        }
      }
    }
  }
  // ... creación del mensaje
}
```

### 4.2 Principios violados

| Principio | Violación |
|-----------|-----------|
| **SRP** | `handleMessageStart` crea mensajes Y deduplica mensajes del usuario |
| **OCP** | Agregar un nuevo tipo de deduplicación requiere modificar la función |
| **Complejidad ciclomática** | 4 niveles de anidamiento + múltiples condiciones |
| **DRY** | La lógica de extracción de texto se repite (`existingText` / `newText`) |

### 4.3 Refactorización propuesta

**Paso 1:** Extraer la deduplicación a una función pura:

```typescript
// store/deduplication.ts
export function findDuplicateUserMessage(
  runtime: SessionRuntime,
  sessionId: string,
  blocks: MessageBlock[],
): string | undefined {
  const msgIds = runtime.store.get(runtime.indexes.messagesBySession.atomFor(sessionId));
  const newText = extractTextFromBlocks(blocks);

  for (const id of msgIds) {
    const msg = runtime.store.get(runtime.maps.messages.atomFor(id));
    if (msg?.role === "user" && !msg.optimistic) {
      const existingText = extractTextFromBlocks(msg.blocks);
      if (existingText === newText) {
        return id;
      }
    }
  }
  return undefined;
}

function extractTextFromBlocks(blocks: MessageBlock[]): string {
  return blocks
    .filter((b): b is Extract<MessageBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
```

**Paso 2:** Simplificar `handleMessageStart`:

```typescript
function handleMessageStart(runtime: SessionRuntime, event: ServerEvent): void {
  if (event.type !== "message_start") return;

  const msg = event.message as Record<string, unknown> | undefined;
  const role = (msg?.role as string) ?? "assistant";
  const blocks = normalizeMessageContent(msg);

  // Deduplicación delegada
  if (role === "user") {
    const duplicateId = findDuplicateUserMessage(runtime, event.sessionId, blocks);
    if (duplicateId) return;
  }

  const chatMsg: ChatMessage = {
    id: generateMessageId(),
    sessionId: event.sessionId,
    role: role as ChatMessage["role"],
    blocks,
    timestamp: event.timestamp,
    streaming: role === "assistant",
    partial: true,
  };
  runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: chatMsg.id, value: chatMsg });
}
```

### 4.4 Strategy Pattern completo para renderizado

```typescript
// strategies/types.ts
export interface BlockRendererStrategy {
  readonly type: string;
  canRender(block: MessageBlock): boolean;
  render(block: MessageBlock): React.ReactNode;
}

// strategies/registry.ts
class BlockRendererRegistry {
  private strategies = new Map<string, BlockRendererStrategy>();

  register(strategy: BlockRendererStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  render(block: MessageBlock): React.ReactNode {
    const strategy = this.strategies.get(block.type);
    if (!strategy) {
      console.warn(`No renderer for block type: ${block.type}`);
      return null;
    }
    return strategy.render(block);
  }
}

// strategies/renderers/TextBlockRenderer.ts
export const textBlockRenderer: BlockRendererStrategy = {
  type: "text",
  canRender: (block): block is Extract<MessageBlock, { type: "text" }> => block.type === "text",
  render: (block) => <MarkdownRenderer content={block.text} />,
};

// strategies/renderers/ThinkingBlockRenderer.ts
export const thinkingBlockRenderer: BlockRendererStrategy = {
  type: "thinking",
  canRender: (block) => block.type === "thinking",
  render: (block) => <ThinkingBlock thinking={block.thinking} signature={block.signature} redacted={block.redacted} />,
};

// strategies/index.ts
import { BlockRendererRegistry } from "./registry.js";
import { textBlockRenderer } from "./renderers/TextBlockRenderer.js";
import { thinkingBlockRenderer } from "./renderers/ThinkingBlockRenderer.js";
// ... otros renderers

export const blockRegistry = new BlockRendererRegistry();
blockRegistry.register(textBlockRenderer);
blockRegistry.register(thinkingBlockRenderer);
// ... registrar todos

// Uso en componente:
// <BlockRenderer block={block} />  ->  blockRegistry.render(block)
```

**Ventajas del Strategy Pattern:**
- **OCP:** Nuevos tipos de bloque = nuevo renderer, sin tocar código existente
- **SRP:** Cada renderer hace una sola cosa
- **Testabilidad:** Cada renderer se puede testear aisladamente
- **Descubribilidad:** Todos los renderers están en `strategies/renderers/`

---

## 5. Librerías Recomendadas

### 5.1 Markdown Rendering

| Librería | Versión | Propósito | Prioridad |
|----------|---------|-----------|-----------|
| `react-markdown` | ^10.1.0 | Renderizado principal | **Ya instalado** |
| `remark-gfm` | ^4.0.0 | Tablas, task lists, strikethrough | **Alta** — agregar |
| `rehype-highlight` | ^7.0.0 | Integración highlight.js con rehype | **Media** — opcional |
| `remark-breaks` | ^4.0.0 | Saltos de línea estilo GitHub | **Baja** |

### 5.2 Syntax Highlighting

| Librería | Propósito | Prioridad |
|----------|-----------|-----------|
| `highlight.js` (actual) | Syntax highlighting básico | **Mantener** |
| `shiki` | Syntax highlighting VS Code-level | **Evaluar a futuro** |

### 5.3 Streaming UI

| Librería | Propósito | Prioridad |
|----------|-----------|-----------|
| `react-use` | Hooks utilitarios (`useDebounce`, `useThrottle`) | **Media** — para debounce en streaming |
| `@tanstack/react-virtual` | Virtualización de listas largas | **Media** — si hay muchos mensajes |

### 5.4 Manejo de Eventos de Agente

| Librería | Propósito | Prioridad |
|----------|-----------|-----------|
| `jotai` (actual) | State management atómico | **Mantener** |
| `zustand` (mencionado en docs) | Alternative state management | **No necesario** — Jotai funciona bien |

---

## 6. Plan de Migración Sugerido

### Fase 1: Refactorización inmediata (sin nuevas dependencias)

1. **Extraer deduplicación** de `handleMessageStart` a `store/deduplication.ts`
2. **Extraer `extractTextFromBlocks`** a utilidad compartida
3. **Agregar `remark-gfm`** a `MarkdownRenderer` para tablas y GFM
4. **Mejorar `ThinkingBlock`** con shimmer effect durante streaming
5. **Agregar debounce** (50ms) en `handleTextDelta` para reducir re-renders

### Fase 2: Mejoras de arquitectura

6. **Implementar Strategy Pattern** para `BlockRenderer`
   - Crear `strategies/` con registry + renderers individuales
   - Migrar `BlockRenderer.tsx` a usar el registry
7. **Separar `event-bridge.ts`** en módulos por dominio:
   ```
   event-handlers/
   ├── session-lifecycle.ts
   ├── agent-lifecycle.ts
   ├── message-lifecycle.ts
   ├── block-streaming.ts
   ├── tool-execution.ts
   ├── queue-compaction.ts
   └── index.ts   # export HANDLERS
   ```
8. **Agregar virtualización** a `ChatView` si hay >100 mensajes

### Fase 3: Mejoras de calidad (evaluar)

9. **Evaluar migración a Shiki** para syntax highlighting
   - Probar bundle size con `shiki/core` + lazy loading
   - Comparar calidad de highlighting con highlight.js
10. **Implementar renderizado híbrido para streaming:**
    - Texto plano durante streaming (sin re-parseo de markdown)
    - `react-markdown` solo cuando `streaming=false`

### Fase 4: Testing

11. **Tests unitarios** para cada strategy renderer
12. **Tests de integración** para `event-bridge` con eventos de ejemplo
13. **Tests de performance** para streaming (medir FPS durante stream)

---

## 7. Ejemplo de Arquitectura Ideal

```typescript
// ============================================================
// ESTRUCTURA DE ARCHIVOS RECOMENDADA
// ============================================================

frontend/src/
├── components/
│   ├── messages/
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx          # Dispatcher por rol
│   │   ├── UserMessage.tsx
│   │   ├── AssistantMessage.tsx
│   │   └── ToolMessage.tsx
│   ├── blocks/
│   │   ├── BlockRenderer.tsx        # Usa strategy registry
│   │   ├── TextBlock.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── ToolCallBlock.tsx
│   │   ├── ToolResultBlock.tsx
│   │   ├── CodeBlock.tsx
│   │   └── ImageBlock.tsx
│   ├── streaming/
│   │   ├── StreamingCursor.tsx
│   │   └── StreamingIndicator.tsx
│   ├── ChatView.tsx
│   ├── ChatInput.tsx
│   ├── ChatHeader.tsx
│   └── Sidebar.tsx
├── strategies/
│   ├── types.ts
│   ├── registry.ts
│   └── renderers/
│       ├── TextBlockRenderer.ts
│       ├── ThinkingBlockRenderer.ts
│       ├── ToolCallBlockRenderer.ts
│       ├── ToolResultBlockRenderer.ts
│       ├── CodeBlockRenderer.ts
│       └── ImageBlockRenderer.ts
├── store/
│   ├── provider.tsx
│   ├── runtime.ts
│   ├── atoms.ts
│   ├── hooks.ts
│   ├── actions.ts
│   ├── optimistic.ts
│   ├── deduplication.ts           # NUEVO
│   ├── message-blocks.ts
│   └── event-handlers/            # NUEVO (reemplaza event-bridge.ts)
│       ├── index.ts
│       ├── session-lifecycle.ts
│       ├── agent-lifecycle.ts
│       ├── message-lifecycle.ts
│       ├── block-streaming.ts
│       ├── tool-execution.ts
│       └── queue-compaction.ts
└── utils/
    ├── text-extraction.ts         # NUEVO (extractTextFromBlocks)
    └── id-generator.ts

// ============================================================
// EJEMPLO: AssistantMessage con strategy pattern
// ============================================================

function AssistantMessage({ message }: { message: ChatMessage }) {
  const hasContent = message.blocks.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-1 py-1">
        {hasContent ? (
          <div className="text-sm text-text-primary">
            {message.blocks.map((block, i) => (
              <BlockRenderer key={`${message.id}-block-${i}`} block={block} />
            ))}
          </div>
        ) : message.streaming ? (
          <StreamingIndicator />
        ) : (
          <div className="text-sm text-text-muted italic">Empty response</div>
        )}
        {message.streaming && <StreamingCursor />}
      </div>
    </div>
  );
}

// ============================================================
// EJEMPLO: Event handler modular
// ============================================================

// store/event-handlers/message-lifecycle.ts
export function handleMessageStart(runtime: SessionRuntime, event: ServerEvent): void {
  if (event.type !== "message_start") return;

  const { role, blocks } = parseMessageEvent(event);

  if (role === "user" && isDuplicateUserMessage(runtime, event.sessionId, blocks)) {
    return;
  }

  const chatMsg = createChatMessage({ sessionId: event.sessionId, role, blocks, timestamp: event.timestamp });
  runtime.store.set(runtime.maps.messages.mapAtom, { type: "set", key: chatMsg.id, value: chatMsg });
}

// store/event-handlers/index.ts
import { handleSessionStarted } from "./session-lifecycle.js";
import { handleAgentStart } from "./agent-lifecycle.js";
import { handleMessageStart } from "./message-lifecycle.js";
// ...

export const eventHandlers: Record<string, EventHandler> = {
  session_started: handleSessionStarted,
  agent_start: handleAgentStart,
  message_start: handleMessageStart,
  // ...
};
```

---

## 8. Conclusiones

### Lo que ya está bien hecho

1. **Block-based rendering** — La normalización a `MessageBlock` es arquitecturalmente sólida
2. **Jotai + atoms** — El manejo de estado con atom caching es performante
3. **Event bridge dispatcher** — El patrón de mapeo `event.type -> handler` es correcto
4. **Optimistic UI** — El manejo de mensajes del usuario con confirmación/rollback es robusto
5. **Componentes separados** — Cada tipo de bloque tiene su propio componente

### Lo que necesita mejora

1. **SRP en `handleMessageStart`** — Deduplicación mezclada con creación de mensajes
2. **Falta `remark-gfm`** — No hay soporte para tablas ni otros features GFM
3. **Strategy pattern** — El `switch` en `BlockRenderer` funciona pero no escala bien
4. **Modularización de event handlers** — Un solo archivo de 491 líneas es difícil de mantener
5. **Debounce en streaming** — Cada `text_delta` fuerza un re-render inmediato

### Próximos pasos recomendados

1. **Inmediato:** Extraer deduplicación y agregar `remark-gfm`
2. **Corto plazo:** Implementar strategy pattern + modularizar event handlers
3. **Mediano plazo:** Evaluar Shiki y optimizar rendering de streaming
