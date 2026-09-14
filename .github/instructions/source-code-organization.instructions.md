---
description:
  Ganttee source code organization — layers, target environments, dependency boundaries, and folder
  structure. Reference when adding new modules, services, views, or webview code.
applyTo: src/**
---

# Source Code Organization

Ganttee is a standalone VS Code extension (not the VS Code core repo). Code is split by **target
environment** and **layer**. The on-disk `.ganttee` `TextDocument` is the single source of truth;
edits flow one way: UI/command → controller applies a `WorkspaceEdit` → document re-parses → the new
model is rebroadcast to the webview and the sidebar tree.

## State ownership

- Define one canonical owner for each data category. Any other representation must be explicitly
  derived from that owner and replaceable from it.
- Keep authored data separate from computed data. Computed data must be reproducible from its
  declared inputs and safe to discard and rebuild.
- Model only valid domain states. Do not invent placeholder values for entities that do not have the
  represented capability.

## Folder Layout

| Folder                   | Responsibility                                                  | Target  | May import                                       |
| ------------------------ | --------------------------------------------------------------- | ------- | ------------------------------------------------ |
| `src/common/documents/`  | JSON-compatible persisted and transport contracts.              | Shared  | Other `common/**` modules only                   |
| `src/common/models/`     | In-memory computational models and derived graph structures.    | Shared  | `common/documents/**`, other `common/**` modules |
| `src/common/protocol.ts` | Typed host↔webview message contract.                            | Shared  | `./documents`, `./models`                        |
| `src/services/`          | Pure workflows and rules, grouped by functional area.           | Shared  | `../common/**`, other `services/**`              |
| `src/ganttStore.ts`      | Tracks the focused Gantt editor for host features.              | Host    | `vscode`, `./views/**` (type-only)               |
| `src/views/`             | VS Code editor, sidebar, controller, and presentation adapters. | Host    | `vscode`, `../common/**`, `../services/**`       |
| `src/webview/`           | Browser UI, interaction state, and chart rendering.             | Browser | React, ECharts, `../common/**`, `../services/**` |
| `src/test/`              | Unit, integration, and smoke tests.                             | Test    | Anything under `src/**`                          |
| `l10n/`                  | Localization bundles for user-facing strings.                   | Shared  | None                                             |

## Dependency Boundaries (must hold)

- `src/common/documents/**`, `src/common/models/**`, and `src/services/**` MUST NOT import `vscode`,
  Node, or DOM globals. This keeps them unit-testable and importable by the browser webview.
- `src/webview/**` MUST NOT import `vscode` or Node modules. It talks to the host only through
  `postMessage` via [vscodeApi.ts](../../src/webview/vscodeApi.ts) and the shared protocol.
- Multi-surface edit rules (form, chart, or future editors) MUST be centralized in a shared workflow
  module; visual components must not duplicate validation or mutation logic.
- Only `src/views/**`, `src/ganttStore.ts`, and `src/extension.ts` import `vscode`.
- The webview is type-checked by its own project
  ([tsconfig.webview.json](../../tsconfig.webview.json), DOM + JSX); the host project
  ([tsconfig.json](../../tsconfig.json)) excludes `src/webview`.

## Adding Code

- New JSON-compatible contract → `src/common/documents/`.
- New in-memory computational representation → `src/common/models/`.
- New host↔webview message → extend `src/common/protocol.ts` and handle both directions.
- New pure workflow, validation rule, or transformation → the matching functional folder in
  `src/services/`.
- New VS Code integration or controller behavior → `src/views/`.
- New browser UI behavior → `src/webview/`.
- New command → declare it in `package.json` and register it in `src/extension.ts`.
- New behavior → add or update a focused test in `src/test/`.
- Any new user-facing string must use the localization framework.
