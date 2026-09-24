---
Status: Draft
Owner: Copilot
Last updated: 2026-09-24
---

# Feature: Item status

![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Project items need a stable lifecycle field that reflects whether work is currently open or closed,
without conflating that lifecycle with arbitrarily named user-defined status labels. This spec
separates the existing item lifecycle attribute into `state` and moves user-defined status metadata
to a document-level `statuses` collection. The result is a clearer model in which each item can be
open or closed while still carrying a named status, color, and optional enforced state.

## 2. Goals / Non-goals

### Goals

- Rename `ProjectItem.status` to `state` across the model, UI, localizations, fixtures, and sample
  `.ganttee` data.
- Replace legacy values `todo` and `inProgress` with `open`, and `done` with `closed`.
- Add a document-level `statuses` collection to represent configurable item statuses.
- Support an item-level status reference that can optionally enforce the item `state`.
- Keep the lifecycle control and user-defined status control distinct in the entity editor.
- Render tasks, groups, and milestones using the configured status color when present.
- Preserve the repository's direct-replacement rule: no runtime migration, version bump, or protocol
  change.

### Non-goals

- Runtime migration of legacy `.ganttee` files.
- A document version bump.
- Changes to the host-to-webview or webview-to-host protocol.
- A settings editor for defining statuses.
- New scheduling logic or resource-planning behavior.

## 3. Epic

The item-status epic delivers a single, consistent representation of project-item lifecycle across
the Gantt editor. It ensures that lifecycle state is a constrained system field while user-facing
status metadata remains configurable and decoupled from the underlying task/group/milestone state.

## 4. User Stories & Acceptance Criteria

- As a planner, I want each project item to carry a lifecycle `state` of `open` or `closed`, so that
  the Gantt editor reflects actual work status without custom text values.
  - Given an item created in a project document When it is inspected in model and editor code Then
    its lifecycle field is `state` and its valid values are limited to `open` or `closed`.
  - Given an item whose lifecycle is set to `todo` or `inProgress` in existing sample data When the
    fixture is parsed Then it is replaced with `open`; when an item is set to `done` Then it is
    replaced with `closed`.
  - Given an item with an invalid lifecycle value When validation runs Then the document is flagged
    according to the existing validation behavior and the invalid value is not accepted.

- As a planner, I want to define custom item statuses, so that work can be labeled with semantic
  status names and colors without changing the lifecycle field itself.
  - Given a document settings collection containing one or more statuses When the document is loaded
    Then each status provides an internal id, name, color, and optional enforced state.
  - Given a status with an `state` override When an item is assigned that status Then the item's
    `state` is updated to that enforced value.
  - Given a status without an enforced `state` When an item is assigned that status Then the item's
    `state` remains unchanged unless the user edits it separately.

- As a planner, I want the entity editor to show item status separately from lifecycle state, so
  that the two concepts remain distinct and readable.
  - Given an item in the entity editor When the status selector is opened Then the dropdown shows
    configured status names rather than the lifecycle `state` values.
  - Given an item in the entity editor When the user changes the lifecycle `state` Then the status
    selection remains distinct and does not overwrite the item's configured status reference.
  - Given an item with a status selected and a matching enforced state When the user changes the
    state directly Then the system preserves the explicit status state contract where the status
    defines one.

- As a planner, I want status color to appear in chart rendering, so that tasks, groups, and
  milestones show the intended status styling at a glance.
  - Given an item with a valid status reference and a configured color When the chart renders Then
    the item's task, group, or milestone uses the status color.
  - Given an item with no configured status When the chart renders Then it uses the default item
    styling rather than an undefined or stale status color.
  - Given an item whose status resolves to a missing or unknown record When the item is rendered
    Then it gracefully falls back to the default styling and no broken color reference is displayed.

## 5. Business Rules

- The project item lifecycle field is named `state` and valid values are `open` and `closed`.
- A document defines a `statuses` collection containing configurable status definitions.
- Each status definition contains a unique internal id, a display name, a color, and an optional
  enforced `state` value.
- A project item may reference at most one status from the document's `statuses` collection.
- When a status is assigned and it defines an enforced `state`, the item's `state` is set to that
  status's `state` at assignment time.
- When a project document is loaded, each item status reference is validated against the document's
  `statuses` collection; if a referenced status no longer exists, the item clears the invalid status
  reference silently.
- If a status has no enforced `state`, assigning it does not change the item's `state`.
- A status selection is exposed as a dedicated control separate from the `state` control in the
  entity editor.
- When a project item has an assigned status, the chart rendering uses the assigned status color for
  the item representation.
- The direct-replacement rule applies to all `.ganttee` samples and tests: existing values are
  updated in place and no runtime migration is introduced.

## 6. Domain & Data Model Impact

- `ProjectItem` lifecycle field: rename `status` → `state`; restrict valid values to `open` and
  `closed`.
- Document settings: add a `statuses` collection to the project document schema; keep the collection
  shape intentionally simple and explicit in the Draft specification.
- Status definition: include internal id, display name, hex RGBA color, and optional enforced
  `state` override.
- Project item reference: add an optional status reference to each item, through the item's document
  pointer or reference field, without changing the document schema version.
- Fixture and sample data: replace all legacy lifecycle tokens in sample `.ganttee` content with the
  new direct values (`open`, `closed`).
- Localization impact: update labels and helper text for state and status to distinguish the two
  fields clearly in the editor and chart affordances.

## 7. Protocol Impact

- No host-to-webview or webview-to-host protocol additions are required for this spec.
- Existing message payloads that already carry project items will continue to use the item model's
  renamed `state` field and optional status reference.
- Any UI or controller code that previously read `status` must use `state` consistently; this is a
  contract update within the document model and editor logic, not a network protocol change.

## 8. UX

- Timeline: status color is shown when a project item carries a configured status, reinforcing the
  semantic state in the chart without altering the cycle or dependency behavior.
- Sidebar tree: item labels remain semantically stable; a status reference may be surfaced only when
  it enhances the current item metadata, without changing tree hierarchy or filtering behavior.
- Edit form: the state control and status control appear separately, using clear labels so users can
  differentiate lifecycle state from user-defined status metadata.

Design rationale (values → principles → moves): Value Clarity · Principle: one field should not
carry both lifecycle and presentation semantics · Move: separate `state` from status metadata while
keeping status color a visible, optional layer.

## 9. Test Strategy

- Unit tests: model validation accepts only `open` and `closed`; documents and fixture loaders
  replace legacy values during test setup; status assignment enforces configured state when present.
- Editor tests: entity form exposes separate state and status controls; changing one does not mutate
  the other unexpectedly; invalid or missing status references are handled predictably.
- Rendering tests: item charts use the configured status color when present and fall back to default
  styling when absent or unresolved.
- Localization tests: new labels and control text appear in the localized bundle without missing-key
  regressions.
- Coverage target: branch coverage may not drop below 90% across the item-status model and editor
  validation paths.

## 10. Risks

- 🟡 **R-01** — Missing status references can leave stale metadata in a project item after a file is
  loaded.
  - Status: **Resolved** — On load, the item status reference is validated against the document's
    `statuses` collection and silently cleared if the target status no longer exists.

## 11. Open Questions

- 🟡 **Q-01** — What exact collection shape should document settings use for `statuses`?
  - Status: **Open**

- 🟡 **Q-02** — What should happen when an item references a missing status?
  - Status: **Resolved** — The status reference is silently removed during file-load validation.

- 🟢 **Q-03** — What localized label and control presentation should distinguish status from state
  in the entity editor?
  - Status: **Open**

## 12. Validation Outcome

- The specification is implementation-ready for the requested direct-replacement scope.
- The Draft status is appropriate because the status schema and editor behavior still require final
  confirmation on the exact `statuses` collection shape and fallback behavior.
