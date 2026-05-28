# Índice de Tareas

| ID | Título | Descripción | Dependencias |
|----|--------|-------------|-------------|
| T-001 | UI Provider con Jotai | Crear UIProvider con contexto Jotai, migrar de Zustand, hooks globales | — |
| T-002 | Mover ModelSelector al Composer | Mover componente de ChatHeader a ChatInput, toolbar sobre textarea | T-003 |
| T-003 | Refactor ChatInput → Composer modular | Dividir ChatInput en módulos composer/ | — |
| T-004 | Mock Setup (MSW + utilities) | Inicializar MSW, factories, mockORPC, renderWithProviders | — |
| T-005 | Component Tests | Tests de message list, send flow, model selector, UI state | T-001, T-002, T-004 |

## Dependencias
- T-001 es independiente (nuevo provider, no afecta componentes existentes)
- T-002 depende de T-003 (el composer debe existir antes de mover el selector)
- T-003 es independiente (refactor del ChatInput existente)
- T-004 es independiente (nueva infraestructura de testing)
- T-005 depende de T-001, T-002, T-004 (necesita UIProvider, composer refactorizado, y mocks)

## Orden de ejecución sugerido
1. T-003 (Refactor ChatInput) — cambios puramente estructurales, bajo riesgo
2. T-001 (UI Provider) — nuevo provider, no rompe nada
3. T-002 (Mover ModelSelector) — depende de T-003
4. T-004 (Mock Setup) — independiente, puede hacerse en paralelo con T-001/T-003
5. T-005 (Component Tests) — requiere todo lo anterior
