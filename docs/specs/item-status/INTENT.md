---
Status: Intent
Owner: Copilot
Last updated: 2026-09-23
---

# Item status

> [!IMPORTANT] **For AI agents:** This document is context only, not an implementation
> specification. Do not implement from it, derive implementation tasks or acceptance criteria from
> it, or change code based on it. The Spec Implementer must act only on a corresponding reviewed
> feature specification.

## Summary

Separate an item's lifecycle state from its user-defined status. Rename the existing
`ProjectItem.status` attribute to `state`, restrict it to `open` or `closed`, and add configurable
statuses that can assign state and color to project items.

## Goals

- Rename the existing item `status` concept to `state` across code, UI, localization, styles, tests,
  and sample `.ganttee` data.
- Replace `todo` and `inProgress` with `open`, and `done` with `closed`.
- Add document settings collection `statuses`.
- Define each status with an internal id, name, color, and optional enforced state.
- Add an optional status reference on project items.
- Allow status selection in the entity editor through a control separate from state.
- Use assigned status color when rendering tasks, groups, and milestones.

## Non-goals

- Runtime migration of legacy `.ganttee` files.
- A document version bump.
- Changes to the host-to-webview or webview-to-host protocol.
- A settings editor for defining statuses.

## Rules

1. Rename the current `ProjectItem.status` attribute to `state`. Apply this rename to all related
   attributes, functions, classes, localization labels, HTML, SCSS, tests, and `.ganttee` samples.

2. `state` has exactly two values: `open` and `closed`.

3. Treat the rename as a direct replacement. Do not add a migration process or bump the document
   version. In `.ganttee` files and tests, replace `todo` and `inProgress` with `open`, and replace
   `done` with `closed`.

4. Project document settings have a new `statuses` collection. Its exact collection shape remains
   for the Draft phase to define.

5. Each status has a string `id` provided by `idFactory`, a string `name`, an RGBA color in hex
   notation such as `#ffffff00`, and an optional `state` that enforces either `open` or `closed`.
   All attributes except `state` are mandatory.

6. A project item may have an optional `status` referencing one of the document settings statuses.
   Assigning a status assigns its configured `state` to the project item when that status defines a
   state.

7. The entity editor exposes status through a dedicated dropdown separate from the `state` control.

8. When a project item has a status, chart rendering uses that status's color for its task, group,
   or milestone representation.

## Rough Direction

The existing lifecycle attribute becomes `state` and supports only `open` and `closed`. Document
settings hold the available statuses. A project item may reference one configured status; assigning
that status also enforces its configured state when one is present. Rendering uses the configured
status color for the item.

The requested rename is treated as a direct replacement, as if `state` had been the original name.
Legacy sample and test values are updated directly rather than migrated at runtime.

## Open Questions

- 🟡 **M-01** — What exact collection shape should document settings use for `statuses`?
  - Status: **Open**

- 🟡 **M-02** — What should happen when an item references a missing status or a status has no
  enforced state?
  - Status: **Open**

- 🟢 **L-01** — What localized label and control presentation should distinguish status from state
  in the entity editor?
  - Status: **Open**

## Draft-ready Handoff

`/spec-draft` should define the settings and item schema, status-reference and enforced-state rules,
editor control behavior, rendering color precedence, direct replacement scope, and focused model,
editor, rendering, fixture, and localization tests. Preserve the stated non-goals: no protocol
change, version bump, runtime migration, or settings editor.
