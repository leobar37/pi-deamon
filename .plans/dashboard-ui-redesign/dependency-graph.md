# Dependency Graph

```
F-001 (Tema oscuro refinado y estilos base)
├──→ F-002 (Sidebar rediseñado)
├──→ F-003 (Header de conversación)
├──→ F-004 (Markdown en mensajes)
└──→ F-006 (ChatInput rediseñado)

F-004 (Markdown en mensajes)
└──→ F-005 (Bloques de código y HTTP)

F-003 (Header de conversación) ──┐
                                 ├──→ F-007 (Estados sutiles)
F-006 (ChatInput rediseñado) ────┘
```

## Orden de ejecución sugerido

1. **F-001** — Foundation visual. Debe ir primero.
2. **F-002, F-003, F-004, F-006** — Paralelizables entre sí tras F-001.
3. **F-005** — Depende de F-004 (markdown renderer base).
4. **F-007** — Depende de F-003 y F-006 (necesita header e input listos para integrar estados).

## Justificación de dependencias

- F-001 es foundation: define variables CSS, paleta, tipografía. Todo lo demás la usa.
- F-002, F-003, F-004, F-006 son componentes independientes que solo necesitan los estilos base.
- F-005 extiende el renderer de F-004 con componentes específicos.
- F-007 integra estados en componentes ya existentes (header + input area).
