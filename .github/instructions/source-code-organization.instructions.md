---
description: Ganttee source code organization — layers, target environments, dependency boundaries, and folder structure. Reference when adding new modules, services, views, or webview code.
applyTo: src/**
---

# Source Code Organization

Ganttee is a standalone VS Code extension (not the VS Code core repo). Code is
split by **target environment** and **layer**. The on-disk `.ganttee`
`TextDocument` is the single source of truth; edits flow one way:
UI/command → controller applies a `WorkspaceEdit` → document re-parses → the new
model is rebroadcast to the webview and the sidebar tree.

## Folder Layout

| Folder                   | Responsibility                                                                   | Target  | May import                                       |
| ------------------------ | -------------------------------------------------------------------------------- | ------- | ------------------------------------------------ |
| `src/common/models/`     | Pure domain types (`Task`, `Group`, `Milestone`, `Dependency`, `GanttDocument`). | Shared  | Nothing external                                 |
| `src/common/protocol.ts` | Typed host↔webview message contract.                                             | Shared  | `./models`                                       |
| `src/services/`          | Pure logic: document parse/validate/serialize, dependency graph.                 | Shared  | `../common/**`                                   |
| `src/ganttStore.ts`      | Tracks the active Gantt editor for the sidebar and commands.                     | Host    | `vscode`, `./views/**` (type-only)               |
| `src/views/editor/`      | `CustomTextEditorProvider` + per-document controller (webview host).             | Host    | `vscode`, `../../common/**`, `../../services/**` |
| `src/views/sidebar/`     | `TreeDataProvider` for tasks/groups/milestones.                                  | Host    | `vscode`, `../../common/**`                      |
| `src/webview/`           | React + Apache ECharts UI.                                                       | Browser | React, ECharts, `../common/**`                   |
| `src/test/`              | Mocha unit/integration tests.                                                    | Test    | anything under `src/**`                          |

## Dependency Boundaries (must hold)

- `src/common/**` and `src/services/**` MUST NOT import `vscode`, Node, or DOM
  globals. This keeps them unit-testable and importable by the browser webview.
- `src/webview/**` MUST NOT import `vscode` or Node modules. It talks to the host
  only through `postMessage` via [vscodeApi.ts](../../src/webview/vscodeApi.ts) and
  the shared protocol.
- Multi-surface edit rules (form, chart, or future editors) MUST be centralized
  in a shared workflow module; visual components must not duplicate validation
  or mutation logic.
- Only `src/views/**`, `src/ganttStore.ts`, and `src/extension.ts` import `vscode`.
- The webview is type-checked by its own project
  ([tsconfig.webview.json](../../tsconfig.webview.json), DOM + JSX); the host
  project ([tsconfig.json](../../tsconfig.json)) excludes `src/webview`.

## Adding Code

- New domain concept → a type in `src/common/models/`, re-exported from
  `models/index.ts`.
- New host↔webview message → extend the unions in `src/common/protocol.ts` and
  handle both directions.
- New pure rule (scheduling, validation) → a function in `src/services/`, with a
  unit test in `src/test/`.
- New command → declare it in `package.json` (`contributes.commands` + `menus`)
  and register it in `src/extension.ts`.
