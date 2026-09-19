# ProjectDocument Hydration — Architecture Guide

Target audience: contributors working on the host-side data pipeline.

## Overview

A `.ganttee` file is plain JSON on disk. The host reads that text, validates it, and turns it into
an in-memory model before it can be rendered or mutated. In the current codebase, the persisted
shape is `ProjectDocument`, and the host-only hydrated shape is `ProjectModel`.

```mermaid
---
config:
  layout: elk
---
flowchart LR
    F[".ganttee\nraw file"]
    P["parseDocument\nread validate"]
    H["hydrateDocument\ndate hydrate"]
    A["assertAcyclicGraph\ngraph validate"]
    E["evaluateScheduleGraph\ndiag check"]
    S["schedule\ncompute dates"]
    U["serializeDocument\nwrite json"]
    HOST["GanttEditorController\nhost document coordinator"]
    WV["Webview\nApp.tsx"]
    SB["Sidebar\nTreeview"]

    F -->|ProjectDocument| P
    P -->|ProjectDocument| H
    H -->|ProjectModel| A
    A -->|ProjectDependencyGraph| E
    H -->|ProjectModel| S
    S -->|ProjectSchedule| WV
    P -->|ProjectDocument| U
    U -->|ProjectDocument| HOST
    HOST -->|ProjectDocument\npostMessage| WV
    HOST -->|ProjectDocument\nexpose| SB
```

The `ProjectDocument` object is the persisted wire format. It is written to disk, sent to the
webview, and used as the source of truth for the host. The `ProjectModel` is a host-only computed
view built from that plain document and never serialized to the webview with `postMessage`.

---

## The Three Layers

### 1. `documentService` — parse, validate, migrate

**File:** `src/services/document/documentService.ts`

- Parses raw text with `JSON.parse`.
- Applies migration logic before validation.
- Validates document shape and cross-entity relations.
- Throws `GanttParseError` on malformed input.
- Returns `ProjectDocument`, which is plain data with ISO date strings and no `Date` objects.

This module is the boundary between raw file text and the persisted JSON shape. It does not build
`ProjectModel` objects or schedule state.

### 2. `projectModelService` — hydrate + DAG validation

**File:** `src/services/model/projectModelService.ts`

- Converts ISO date strings into `Date` instances.
- Wraps records in the `Task`, `Milestone`, and `Group` model classes.
- Runs dependency validation through `assertAcyclicGraph`.
- Throws typed errors for self-loops, parallel edges, or cycles.
- Returns a `ProjectModel` whose `.graph` is the host-side dependency graph.
- Also owns the reverse conversion through `toDocument(model)`.

The plain document is still the persisted object. The hydrated model is an in-memory host view built
from it on each reparse.

### 3. `DependencyGraph` — graph algorithms

**File:** `src/services/dependency-graph/dependencyGraphService.ts` and the model graph types under
`src/common/models/`

- Builds a graph from the plain dependency list.
- Checks for cycles and invalid graph structure.
- Supplies the algorithms used during validation and scheduling.
- Is host-owned and reusable for model-level logic, schedule evaluation, and graph sanitization.

This is not a separate document format. It is the graph algorithm substrate beneath the hydrated
model.

---

## Sequence: global host/webview flow

```mermaid
sequenceDiagram
    actor User
    participant VSC as VS Code TextDocument
    participant Provider as GanttEditorProvider
    participant Ctrl as GanttEditorController
    participant Parse as parseDocument
    participant Hydrate as hydrateDocument
    participant Model as ProjectModel
    participant Store as GanttStore
    participant Tree as GanttExplorerProvider
    participant App as App.tsx

    User->>VSC: open .ganttee file
    VSC->>Provider: resolveCustomTextEditor(document, panel)
    Provider->>Ctrl: new GanttEditorController(document, panel, iconBaseUri)
    Ctrl->>Parse: parseDocument(document.text)
    Parse-->>Ctrl: ProjectDocument
    Ctrl->>Hydrate: hydrateDocument(document)
    Hydrate-->>Ctrl: ProjectModel
    Ctrl-->>Model: cache _document + _model + _scheduledModel
    Provider->>Store: setActive(controller)
    Store-->>Tree: active editor changed

    App->>Ctrl: ready
    Ctrl-->>App: init { document, revision, iconBaseUri }
    App->>App: createGanttViewState(document)
    Store-->>Tree: refresh tree
    Tree->>Ctrl: getProjectDocument()
```

This is the top-level lifecycle: file text becomes `ProjectDocument`, then `ProjectModel`, then the
webview receives the plain document payload and the sidebar reads the same active document.

---

## Sequence 1: load to schedule and send to webview

```mermaid
sequenceDiagram
    participant VSC as VS Code TextDocument
    participant Ctrl as GanttEditorController
    participant Parse as parseDocument
    participant Hydrate as hydrateDocument
    participant Sanitize as sanitizeScheduleGraph
    participant Eval as evaluateScheduleGraph
    participant Scheduler as schedule
    participant App as App.tsx

    VSC->>Ctrl: on editor open / text changed
    Ctrl->>Parse: parseDocument(text)
    Parse-->>Ctrl: ProjectDocument
    Ctrl->>Sanitize: sanitizeScheduleGraph(document)
    Sanitize-->>Ctrl: sanitized document
    Ctrl->>Hydrate: hydrateDocument(document)
    Hydrate-->>Ctrl: ProjectModel
    Ctrl->>Eval: evaluateScheduleGraph(document)
    Eval-->>Ctrl: diagnostics
    alt no blocking diagnostics
        Ctrl->>Scheduler: schedule(model, model.graph)
        Scheduler-->>Ctrl: ProjectSchedule
    else scheduling blocked
        Ctrl-->>Ctrl: keep schedule undefined
    end
    Ctrl-->>App: postMessage({ type: "init", document, revision })
    App->>App: createGanttViewState(document)
    App->>App: render timeline + chart
```

The host recomputes schedule state on every successful reparse and sends the latest plain document
to the webview with its `revision` so the UI can render the most recent state.

---

## Sequence 2: webview edit flow to update the host document

```mermaid
sequenceDiagram
    actor User
    participant App as App.tsx
    participant Host as GanttEditorController
    participant Parse as parseDocument
    participant Write as WorkspaceEdit
    participant VSC as VS Code TextDocument

    User->>App: edit task / milestone / group / dependency / view
    App->>App: updateGanttViewDocument(...) or updateView(...)
    App-->>Host: postMessage({ type: "entityUpdated" | "updateView" | "addDependency" | "removeDependency" })
    Host->>Host: handleMessage(message)
    alt entity update or full document update
        Host->>Host: updateDocument(updatedDocument, baseRevision)
    else view update
        Host->>Host: updateView(view, baseRevision)
    else dependency mutation
        Host->>Host: addDependency / removeDependency
    end
    Host->>Host: applyModel(nextDocument)
    Host->>Write: WorkspaceEdit.replace(document range, serializeDocument(nextDocument))
    Write->>VSC: applyEdit()
    VSC-->>Host: onDidChangeTextDocument
    Host->>Parse: parseDocument(new text)
    Parse-->>Host: ProjectDocument
    Host-->>App: postMessage({ type: "documentChanged", document, revision })
    App->>App: replace viewState with latest document
```

The webview never writes the file directly. It sends a revision-safe payload to the host, and the
host validates and applies the document mutation through `WorkspaceEdit`.

---

## Sequence 3: sidebar edit flow to update the host document

```mermaid
sequenceDiagram
    actor User
    participant Tree as GanttExplorerProvider
    participant Store as GanttStore
    participant Ctrl as GanttEditorController
    participant Write as WorkspaceEdit
    participant VSC as VS Code TextDocument
    participant Parse as parseDocument
    participant App as App.tsx

    User->>Tree: create / delete / move / sort / group item
    Tree->>Store: store.active
    alt create or delete item
        Tree->>Ctrl: upsertTask / upsertGroup / upsertMilestone / deleteEntity
    else move or sort
        Tree->>Ctrl: moveEntity / sortItems
    else group assignment
        Tree->>Ctrl: assignEntitiesToGroup
    end
    Ctrl->>Ctrl: applyModel(nextDocument)
    Ctrl->>Write: WorkspaceEdit.replace(document range, serializeDocument(nextDocument))
    Write->>VSC: applyEdit()
    VSC-->>Ctrl: onDidChangeTextDocument
    Ctrl->>Parse: parseDocument(updated text)
    Parse-->>Ctrl: ProjectDocument
    Ctrl-->>App: postMessage({ type: "documentChanged", document, revision })
    App->>App: refresh timeline + selected entity view
    Tree-->>Tree: refresh tree data
```

The sidebar and the chart share the same host edit boundary. Both paths converge on
`GanttEditorController.applyModel`, which means there is still one persisted document and one
reparse cycle, no matter which UI surface initiated the mutation.

---

## Data Model

```mermaid
---
config:
  layout: elk
---
classDiagram
    class ProjectDocument {
        +version: number
        +tasks: Task[]
        +milestones: Milestone[]
        +groups: Group[]
        +dependencies: Dependency[]
        +settings: ProjectSettings
        +view: ProjectView
        +schedule?: ProjectScheduleDocument
    }

    class ProjectModel {
        +tasks: Task[]
        +milestones: Milestone[]
        +groups: Group[]
        +dependencies: Dependency[]
        +version: number
        +settings: ProjectSettings
        +view: ProjectView
        +graph: ProjectDependencyGraph
    }

    class ProjectSchedule {
        +tasks: ScheduledTask[]
        +milestones: ScheduledMilestone[]
        +groups: ScheduledGroup[]
    }

    class ProjectScheduleDocument {
        +tasks: ScheduledTask[]
        +milestones: ScheduledMilestone[]
        +groups: ScheduledGroup[]
    }

    class ProjectDependencyGraph

    ProjectDocument ..> ProjectModel : hydrateDocument()
    ProjectModel ..> ProjectDocument : toDocument()
    ProjectModel ..> ProjectSchedule : schedule()
    ProjectSchedule ..> ProjectScheduleDocument : transport payload
    ProjectModel *-- ProjectDependencyGraph
```

---

## Why the document and model are separate

`ProjectDocument` is stable and serializable. It is plain JSON and represents the file on disk and
what passes through the protocol. `ProjectModel` is the rich object graph used by host-side logic
and by scheduling. The document is the source of truth; the model is a computed view rebuilt on
every successful reparse.

The host also keeps a `ProjectSchedule` in `GanttEditorController` for the effective-date rendering,
which is why the controller sends a `schedule` payload along with the document during transport to
the webview.

---

## Layer boundaries

```text
src/common/documents/           ← persisted document types and plain JSON shapes.
src/common/models/              ← hydrated model classes and graph logic.

src/services/dependency-graph/  ← dependency validation, cycle checks, and graph primitives.
src/services/document/          ← parse, migrate, and validate the raw .ganttee document.
src/services/editing/           ← authoring edits and mutation helpers for project items.
src/services/groups/            ← group-specific delete/reparent logic and behaviors.
src/services/model/             ← hydrate/serialize between plain document and real model objects.
src/services/schedule/          ← scheduling evaluation, graph sanitization, and schedule derivation.
src/services/sidebar/           ← tree actions such as move, sort, and group assignment.

src/views/editor/               ← GanttEditorController and VS Code integration.
src/views/sidebar/              ← GanttExplorerProvider and tree commands.

src/webview/                    ← React chart/editor UI.
```

The plain document crosses host/webview boundaries. The hydrated model remains host-only and should
never be posted across the `postMessage` boundary. The webview receives `ProjectDocument` plus the
current `revision`, and it sends back authoring updates through the host protocol.

## Failure behavior

The controller updates its cached document and model only after parsing and hydration succeed. If a
malformed document or invalid graph appears, the host shows a localized error and keeps the last
valid state intact. A live webview still receives `documentChanged` from the last good state so the
UI stays synchronized while the user fixes the file.
