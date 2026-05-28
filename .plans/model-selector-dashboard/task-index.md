# Índice de Tareas

| ID | Título | Descripción |
|----|--------|-------------|
| T-001 | Backend: endpoints de modelos | Agregar `models.list` y `models.set` a session procedures, schemas, LiveSession y SessionHost |
| T-002 | Frontend: estado y eventos | Agregar estado de modelo al store, hooks, actions, y handler de `model_select` |
| T-003 | Frontend: UI selector | Crear componente `ModelSelector` e integrar en `ChatHeader` |

## Dependencias
- T-001 debe completarse antes de T-002 y T-003 (define la interfaz API)
- T-002 y T-003 pueden ejecutarse en paralelo