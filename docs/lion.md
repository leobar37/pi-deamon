# Lion Extension

Extension de orquestacion para pi coding agent. Proporciona planificacion estructurada y delegacion de tareas a subagentes. El orquestador (agente principal) mantiene el control total del flujo.

## Principio de Diseno

Lion no toma decisiones por el orquestador. Es un mecanismo de delegacion: el orquestador decide que hacer, construye los prompts, y usa Lion para lanzar subagentes. Lion solo ejecuta lo que el orquestador le pide.

## Flujo de Uso

```mermaid
sequenceDiagram
    participant Orquestador
    participant Lion
    participant Subagentes

    Orquestador->>Lion: lion_activate_plan("mi-plan")
    Lion-->>Orquestador: Plan activado

    Orquestador->>Orquestador: Leer checklist, decidir tarea
    Orquestador->>Lion: lion_tasks({ tasks: [{ definition: "executor", ... }] })
    Lion->>Subagentes: Delegar tarea
    Subagentes-->>Lion: Resultado
    Lion-->>Orquestador: Resultados + subagents retenidos

    Orquestador->>Orquestador: Analizar resultado, decidir siguiente paso
    Orquestador->>Lion: lion_prompt_subagent({ task_id, message })
    Lion->>Subagentes: Follow-up
    Subagentes-->>Lion: Respuesta
    Lion-->>Orquestador: Feedback

    Orquestador->>Orquestador: Marcar checklist como complete/retryable
```

## Tools

### Plan Management

| Tool | Proposito |
|------|-----------|
| `lion_activate_plan` | Activar un plan por referencia (slug, path, o nombre) |
| `lion_validate_plan` | Validar plan con analyzer read-only |
| `lion_retry_task` | Resetear tarea blocked/failed a retryable |

### Task Execution

| Tool | Proposito |
|------|-----------|
| `lion_tasks` | Delegar tareas explicitas a subagents. Requiere array `tasks` |
| `lion_prompt_subagent` | Enviar follow-up a subagent retenido |

### Observability

| Tool | Proposito |
|------|-----------|
| `lion_subagent_status` | Status de subagents (con/sin task_id) |
| `lion_cancel_subagent` | Cancelar subagent atascado |

## Ejemplo de Uso

```typescript
// 1. Activar plan
lion_activate_plan({ reference: "mi-plan" })

// 2. Delegar tarea explicita
lion_tasks({
  strategy: "sequential",
  tasks: [
    {
      definition: "executor",
      title: "Implementar feature X",
      prompt: "Implementa la feature X segun el brief en tasks/T-001.md..."
    }
  ]
})

// 3. El orquestador recibe resultados y decide:
//    - Si esta bien: marcar checklist como complete
//    - Si necesita ajustes: lion_prompt_subagent para follow-up
//    - Si fallo: lion_retry_task y reintentar
```

## Modelo de Datos

```mermaid
classDiagram
    class LionState {
        +version: 1
        +active: boolean
        +mode: LionMode
        +activePlanPath: string
        +activePlanSlug: string
        +planKind: LionPlanKind
        +activeTaskId: string
        +maxAttempts: number
        +lastRunId: string
        +lastBuild: LionBuildResult
    }

    class LionCore {
        +activeRun: LionRun
        +runHistory: LionRun[]
    }

    class LionRun {
        +runId: string
        +planSlug: string
        +taskId: string
        +taskTitle: string
        +status: LionRunStatus
        +attempts: number
        +maxAttempts: number
        +executorSummary: string
        +reviewerSummary: string
        +verdict: LionReviewVerdict
        +subagents: LionRunSubagent[]
        +createdAt: number
        +updatedAt: number
    }

    class LionPlan {
        +kind: LionPlanKind
        +slug: string
        +rootPath: string
        +tasks: LionTask[]
    }

    class LionTask {
        +id: string
        +title: string
        +file: string
        +status: LionTaskStatus
        +dependencies: string[]
        +requirements: string[]
        +phase: string
    }

    class LionEventBus {
        +emit(event: LionEvent)
        +on(type, handler)
    }

    class LionRuntime {
        +pi: ExtensionAPI
        +state: LionState
        +core: LionCore
        +events: LionEventBus
        +controllers: Map
        +subagentJobs: Map
        +subagentUi: Map
    }

    LionState --> LionBuildResult
    LionCore --> LionRun
    LionRun --> LionRunSubagent
    LionPlan --> LionTask
    LionRuntime --> LionState
    LionRuntime --> LionCore
    LionRuntime --> LionEventBus
```

## Estados de Tarea (LionTaskStatus)

| Estado | Descripcion |
|--------|-------------|
| `pending` | Tarea pendiente de ejecucion |
| `in_progress` | Tarea en ejecucion |
| `complete` | Tarea completada |
| `blocked` | Tarea bloqueada por dependencias fallidas |
| `retryable` | Tarea que fallo pero puede reintentarse |
