---
Status: Reviewed
Owner: Copilot
Last updated: 2026-09-21
Related ADRs: <none yet>
---

# Feature: Global Sort

![Status: Reviewed](https://img.shields.io/badge/status-Reviewed-0D6EFD?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Ganttee currently stores and displays groups, tasks, and milestones in separate kind-specific
orders. Project authors need one persistent order in every owner scope so all item kinds can be
interleaved consistently in the sidebar and Gantt chart. This feature adds a `sequence` to the
document root and every group, repairs missing or stale sequences during document loading, and makes
that sequence authoritative for sorting, creation, deletion, reparenting, and display.

This spec enhances the implemented
[Chart View Functional Organization](../chart-view-functional-organization/SPEC.md) and
[TreeView Enhancements](../treeview-enhancements/SPEC.md) features. Its rules prevail where
ordering, drag-and-drop, or toolbar behavior conflicts with those specs. All unaffected behavior
from the implemented specs remains in force.

## 2. Goals / Non-goals

### Goals

- Persist one mixed-kind direct-child order for the project root and each group.
- Repair missing, stale, duplicate, or incomplete sequences during document loading.
- Keep every sequence synchronized with item creation, deletion, grouping, reparenting, moving, and
  global sorting.
- Display sidebar and Gantt chart items in the same sequence-defined hierarchy.
- Reparent and position one or more dragged items in one document edit.
- Consolidate New Group, New Task, and New Milestone under one toolbar menu.
- Preserve implemented chart and tree behavior except where this spec explicitly changes it.

### Non-goals

- Bumping `CURRENT_DOCUMENT_VERSION`.
- Changing group ownership from `groupId` to nested item collections.
- Changing scheduling calculations, dependency rules, or date validation.
- Adding a new host-to-webview message kind solely for ordering.
- Reimplementing or replacing unaffected behavior from the implemented chart and tree specs.

## 3. Epic

Deliver one document-backed ordering system for all project item kinds. Authors can globally sort or
manually drag mixed groups, tasks, and milestones, and every Ganttee surface reflects the same
owner-scoped sequence after the host applies, reparses, and rebroadcasts the document edit.

## 4. User Stories & Acceptance Criteria

### Persisted ordering

- As a project author, I want each owner scope to persist one item sequence, so that mixed item
  order survives save and reopen.
  - Given a valid project, when it is serialized, then the root `sequence` contains every root item
    ID exactly once and no non-root item ID.
  - Given a valid group, when it is serialized, then its `sequence` contains every direct child ID
    exactly once and no item owned by another scope.
  - Given nested groups, when the document is serialized, then each item ID occurs only in the
    sequence of its direct owner.
  - Given a sequence-defined mixed-kind order, when the document is saved and reopened, then the
    order is unchanged.

### Load-time repair

- As a project author, I want older or stale documents repaired automatically, so that they open
  without a manual migration.
  - Given a root or group without `sequence`, when the document loads, then a complete sequence is
    derived from its direct children before shape and relation validation.
  - Given a sequence containing a missing, foreign, nested, or duplicate ID, when the document
    loads, then invalid occurrences are removed and the first valid occurrence retains its relative
    position.
  - Given a sequence omits a direct child, when the document loads, then the omitted child is
    appended once using the defined fallback order.
  - Given a repaired document, when it is saved, then the normalized sequences are persisted while
    document version remains unchanged.
  - Given invalid ownership such as a missing parent or group cycle, when the document loads, then
    existing relation validation still rejects the document rather than using sequence repair to
    conceal the ownership error.

### Mutation consistency

- As a project author, I want all item mutations to preserve valid sequences, so that ordering never
  drifts from ownership.
  - Given a new group, task, or milestone, when creation succeeds, then its owner and sequence
    position follow the selection-aware creation rule below rather than a plain append.
  - Given an item deletion, when deletion succeeds, then every deleted ID is removed from its owner
    sequence.
  - Given group deletion with descendant deletion, when deletion succeeds, then the group and all
    deleted descendants are absent from every sequence.
  - Given group deletion with child promotion, when deletion succeeds, then promoted children enter
    the deleted group's owner scope at the deleted group's former position while preserving their
    sequence order.
  - Given a rejected create, edit, delete, move, or group operation, when validation fails, then the
    document and all sequences remain unchanged.

### Selection-aware creation

- As a project author, I want a new group, task, or milestone to land next to what I'm looking at,
  so that I don't have to relocate it after creation.
  - Given a task, milestone, or group is selected in the sidebar, when a New Items command creates
    an item, then the new item's owner is the selected item's owner and the new item is inserted
    immediately before the selected item in that owner's sequence, per the item-target drop rule.
  - Given the selected item is a group, when a New Items command creates an item, then the new item
    becomes a sibling inserted immediately before that group in the group's own owner sequence, not
    a child of the group.
  - Given no sidebar item is selected, when a New Items command creates an item, then the new item's
    owner is the project root and it is appended to the end of the root sequence.
  - Given the previously selected item no longer exists at creation time, when a New Items command
    creates an item, then creation falls back to the no-selection behavior.
  - Given a rejected creation, when validation fails, then no owner or sequence changes are applied
    for the attempted item.

### Global sorting

- As a project author, I want Sort to interleave groups, tasks, and milestones, so that each owner
  shows one chronological order instead of separate item-kind blocks.
  - Given one owner has groups, tasks, and milestones with alternating effective dates, when
    Ascending is selected, then its sequence interleaves all three kinds using the existing
    ascending sort rules.
  - Given one owner has groups, tasks, and milestones with alternating effective dates, when
    Descending is selected, then its sequence interleaves all three kinds using the existing
    descending sort rules.
  - Given mixed-kind children at root and in nested groups, when sorting completes, then each owner
    is interleaved independently and no item changes owner.
  - Given a global sort completes, when the document refreshes or is reopened, then the same
    interleaved order appears in the sidebar and Gantt chart.

### Sidebar toolbar

- As a project author, I want item creation actions grouped together, so that primary toolbar chrome
  remains calm and focused.
  - Given the sidebar toolbar, when it renders, then one New Items menu contains New Group, New
    Task, and New Milestone.
  - Given a New Items menu entry is invoked, when creation begins, then its existing localized
    command behavior is unchanged.
  - Given New Project, Sort, or Refresh actions, when the toolbar renders, then those commands
    remain outside the New Items menu.

### Drag, reparent, and reorder

- As a project author, I want to place one or more items relative to a drop target, so that
  ownership and order can change in one action.
  - Given one or more valid items dropped before an item target, when the drop succeeds, then each
    dragged item receives the target's owner and the dragged block is inserted immediately before
    the target.
  - Given dragged items from one or more owner scopes, when the drop succeeds, then their relative
    order follows their source sequence order rather than selection order.
  - Given a valid list target, when items are dropped, then they receive that list's owner and are
    placed according to the list-drop rule.
  - Given a dragged group would become its own ancestor, when the drop is evaluated, then that group
    is rejected and all accepted items still retain a valid sequence.
  - Given the drop target is also in the dragged selection, when the drop is evaluated, then no item
    is inserted relative to itself and the resulting sequences remain valid.
  - Given stale dragged IDs or a stale target, when the drop is evaluated, then stale entries are
    ignored, no invalid IDs are persisted, and accepted items are applied in one document edit.
  - Given the drop edit fails validation, when the operation completes, then ownership and sequence
    remain unchanged.

### Cross-surface display

- As a project author, I want the sidebar and Gantt chart to share one order, so that item position
  is predictable between views.
  - Given a valid root sequence, when the sidebar renders, then root rows follow that sequence and
    each expanded group recursively follows its own sequence.
  - Given a valid project hierarchy, when the Gantt chart renders, then rows use depth-first
    preorder: each root or group sequence is followed, and each group is immediately followed by its
    descendants in their sequence order.
  - Given scheduled and unscheduled items, when the Gantt chart renders, then scheduled rows retain
    sequence-relative order and unscheduled items follow existing visibility behavior.
  - Given dependencies between reordered tasks or milestones, when the chart renders, then link row
    coordinates are recalculated from sequence-defined row indexes.
  - Given the host reparses a sequence-changing edit, when it broadcasts the new project
    presentation, then sidebar and chart update without keeping an independent ordering state.

## 5. Business Rules

- The `.ganttee` `TextDocument` is the only persisted source of truth.
- This spec overrides conflicting ordering, drag-and-drop, and toolbar rules in the implemented
  Chart View Functional Organization and TreeView Enhancements specs; their unaffected rules remain
  binding.
- Root and group `sequence` values are the canonical order of their direct children.
- Every root or group sequence contains only and all direct child IDs, each exactly once.
- Item kind does not affect sequence membership or ordering precedence.
- `groupId` remains the canonical ownership relation; sequence does not define ownership.
- Load-time sequence repair is idempotent and runs before document validation without a schema
  version bump.
- Repair retains valid stored order, removes invalid or duplicate entries, and appends missing
  direct children in deterministic fallback order.
- Every successful item mutation updates ownership and all affected sequences atomically in one
  host-applied document edit.
- Multi-item drag order follows source sequence order.
- Global Sort inherits the implemented Sort command's direction, comparator, stable-tie,
  unscheduled-item, unavailable-schedule, and failure behavior. This feature changes the comparison
  pool from separate item-kind arrays to all direct children and persists the result in each owner's
  sequence.
- New Items creation derives owner and position from the current sidebar selection using the same
  item-target drop rule as drag-and-drop; a selected group is a positional reference only and never
  becomes the new item's parent. Absent or stale selection falls back to root-append.
- The chart derives a flat depth-first preorder from root and group sequences; it does not persist a
  separate row order.
- User-facing menu, validation, and failure text is localized.

## 6. Domain & Data Model Impact

- Add a JSON-compatible `Sortable` contract under `src/common/documents/` with a required
  `sequence: string[]` field after load-time repair.
- Make `ProjectContent` in `src/common/documents/project/projectDocument.ts` and `Group` in
  `src/common/documents/project/group.ts` sortable.
- Add readonly sequence state to `ProjectModel` and the hydrated `Group` model in
  `src/common/models/project/`.
- Preserve sequence through `hydrateDocument`, `toDocument`, group hydration, project snapshots, and
  presentation projection in `src/services/model/`.
- Add an idempotent normalization pass to the document load pipeline in
  `src/services/document/documentMigrationService.ts`. It repairs sequence content from ownership
  before shape and relation validation.
- Extend shape validation to require string-array sequences after normalization. Extend relation
  validation to enforce direct-child completeness, uniqueness, and scope.
- Centralize sequence mutation in pure services so create, delete, group deletion, grouping, moving,
  and sorting cannot update item collections without updating affected sequences.
- Creation services accept an optional selected-item reference and resolve owner/position through
  the same ordering logic used for item-target drops, so creation and drag-and-drop share one
  placement rule instead of duplicating it.
- Keep `CURRENT_DOCUMENT_VERSION` at `2`. Missing or stale sequences are compatibility
  normalization, not a versioned migration.

## 7. Protocol Impact

- `ProjectPresentation` already extends `ProjectContent`; root and group sequences therefore flow in
  existing `init` and `documentChanged` payloads.
- No new `HostToWebviewMessage` or `WebviewToHostMessage` discriminant is required in
  `src/common/protocol.ts`.
- Existing document revisions retain their current meaning as VS Code `TextDocument.version` values;
  they are unrelated to the persisted schema version.
- Drag-and-drop remains host-owned. The sidebar submits item and target identities, and the host
  applies the resulting ownership and sequence edit through the active editor controller.
- New Items command handlers run in the same extension-host process as the sidebar `TreeView` and
  read its `selection` property directly at invocation time; no host/webview crossing or new
  protocol message is involved.

## 8. UX

- **Timeline:** Consistency leads. Chart rows use the same hierarchy and sequence as the sidebar,
  including group rows, so equivalent project structure reads identically across surfaces.
- **Toolbar:** Calm leads. Creation commands move under one clearly named menu. New Project, Sort,
  and Refresh remain direct commands.
- **Drag-and-drop:** Predictability leads. Accepted items move as one ordered block and the
  resulting location is visible immediately after the document refresh. Invalid structural moves do
  not leave partial sequence corruption.
- **Edit form:** No visual change. Item edits that alter ownership must still update affected
  sequences through the shared document workflow.

## 9. Test Strategy

- **Unit, document services:** cover missing root/group sequences, valid preservation, duplicate and
  stale removal, foreign-owner removal, missing-child append, nested groups, idempotence, unchanged
  schema version, and malformed sequence shapes.
- **Unit, model services:** verify document-to-model-to-document round trips preserve root and group
  sequences and project presentations expose them unchanged.
- **Unit, mutation services:** cover selection-aware create (task/milestone/group selected, group
  selected as sibling reference, no selection, stale selection), every delete mode, child promotion,
  mixed-kind Move Up/Down, recursive ascending/descending sort, stable ties, cross-owner multi-item
  drops, source-order preservation, stale IDs, selected targets, and cycle rejection.
- **Integration, document/editor:** load legacy and stale fixtures, save repaired output, verify one
  `WorkspaceEdit` per successful operation, and verify rejected operations leave text unchanged.
- **Integration, sidebar:** verify sequence-defined child order, menu command exposure, item/list
  drop outcomes, and that New Items commands read the active `TreeView` selection at invocation.
- **Webview interaction:** verify depth-first mixed-kind rows, scheduled-row visibility, group
  placement, and dependency coordinates after reorder.
- **Coverage:** branch coverage remains at least 90% for every changed file or class.

## 10. Risks

### 🟡 Medium Risks

- 🟡 **R-01** — Sequence invariants span create, delete, promote, reparent, move, and sort
  workflows.
  - Status: **Resolved** — All sequence-affecting mutations route through one pure ordering service
    in `src/services/`; no call site mutates `sequence` directly, and every mutation path is covered
    by the ordering-service unit tests in § 9.
- 🟡 **R-02** — Auto-repair can hide stale authored IDs; limit repair to sequence metadata and keep
  ownership, cycle, dependency, and date errors under existing validation.
  - Status: **Resolved** — Repair never changes ownership or suppresses non-sequence validation.

## 11. Open Questions

### 🔴 High Questions

- 🔴 **Q-01** — What deterministic mixed-kind fallback order initializes a missing sequence when
  existing files only provide separate task, group, and milestone arrays?
  - Status: **Resolved** — Groups, then tasks, then milestones, each preserving its existing array
    order.

### 🟡 Medium Questions

- 🟡 **Q-02** — What exact position does a drop on list background use: start, end, or a native
  insertion location supplied by the tree API?
  - Status: **Resolved** — Append at the end of the target list's sequence, matching the
    no-selection creation fallback.
- 🟡 **Q-03** — Should multi-item drops preserve source sequence order instead of drag-selection
  order?
  - Status: **Resolved** — Preserve source sequence order.
- 🟡 **Q-04** — Does sequence persistence require a schema version bump?
  - Status: **Resolved** — No. Missing or stale sequences self-repair during every load.

## 12. Review Outcome

Spec Reviewer pass on 2026-09-21 found no missing required sections and no internal contradictions.
Three issues were raised and fixed:

- 🟡 The Risks section skipped `R-01` (numbered `R-02`/`R-03` only, unique to this spec) — fixed by
  renumbering to `R-01`/`R-02`.
- 🟡 § 7 Protocol Impact implied a host/webview handoff for New Items selection when the command
  handler and sidebar `TreeView` both run in the extension host — reworded to clarify no crossing
  occurs.
- 🟢 § 9 Test Strategy didn't cover verifying the New Items command reads the live `TreeView`
  selection — added an integration-test clause.

All previously open Risks and Open Questions were resolved inline (no decision met the ADR bar):
`R-01` (ordering centralized in one pure service, tested per mutation path), `Q-01` (fallback order
is groups, then tasks, then milestones, each in existing array order), and `Q-02` (list-background
drop appends at the end, matching the no-selection creation fallback).
