---
Status: Draft
Owner: Copilot
Last updated: 2026-09-17
Related ADRs: <none yet>
---

# Feature: Treeview Enhancements

![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The sidebar currently exposes existing Ganttee items but does not provide a complete
project-management workflow. This feature makes the sidebar a primary place to create, inspect,
edit, delete, organize, and sort project items while keeping the `.ganttee` TextDocument as the
source of truth. Users organize items through grouping/ungrouping drops and single-row Move Up/Move
Down actions, sort through explicit toolbar choices, and receive a recognizable editor-tab icon for
open Ganttee documents.

## 2. Goals / Non-goals

### Goals

- Create `.ganttee` projects, tasks, groups, and milestones from the sidebar.
- Present each item with type, label, Delete, Move Up, Move Down, and health/status in a consistent
  order.
- Use native tree activation to open item editing.
- Delete mixed selections in one confirmed action, including clear group-member effects.
- Group and ungroup tasks, milestones, and groups by drag-and-drop at group or project-root level.
- Reject invalid grouping moves without blocking valid items in the same selection.
- Sort scheduled items recursively by effective start date, effective end date, then name.
- Move one item up or down within its current owner scope through row actions.
- Filter the sidebar tree by project-item name through a search field below the toolbar.
- Identify open `.ganttee` documents with `ganttee-color.svg` in editor tabs.

### Non-goals

- Dropping items onto tasks or milestones.
- Reordering items through drag-and-drop, including drag-position or insertion-index behavior.
- Reordering multiple selected items.
- Sorting through drag-and-drop.
- Direct webview feature changes beyond reflecting document updates.
- Changing item display order in the ECharts timeline.
- Changing the `.ganttee` document structure or version.
- Remembering a selected sort direction between Sort actions or sessions.

## 3. Epic

Deliver a complete, document-backed sidebar workflow for Ganttee project authoring and organization.
All sidebar edits are applied by the host through the existing document/controller boundary, then
reparsed and rebroadcast to the tree and editor webview.

## 4. User Stories & Acceptance Criteria

### Project creation and identification

- As a project author, I want to create a new `.ganttee` project from the sidebar, so that I can
  start planning without creating a generic file first.
  - Given an available workspace folder, when the user invokes New Project, then a new
    current-version `.ganttee` document opens in the Ganttee editor.
  - Given no workspace folder is available, when the user invokes New Project, then creation is
    rejected with a localized actionable message.
  - Given the target path already exists, when creation would overwrite it, then the user is asked
    for a different name or explicit replacement according to the approved filename policy.
- As a project author, I want open `.ganttee` projects to use the Ganttee color icon in editor tabs,
  so that I can identify them quickly.
  - Given an open `.ganttee` custom editor, when its tab is rendered, then the custom editor
    contribution uses `ganttee-color.svg`.
  - Given a non-Ganttee editor, when its tab is rendered, then its existing icon behavior is
    unchanged.

### Item creation and row interaction

- As a project author, I want to create a task, group, or milestone from the sidebar, so that I can
  build my project without leaving the tree.
  - Given the sidebar toolbar, when the user views it, then it provides icon actions for New Task,
    New Group, and New Milestone; the existing New Task action remains in the toolbar.
  - Given an active Ganttee project, when the user invokes New Task, New Group, or New Milestone
    from its toolbar icon, then the item is added through the document controller and opened for
    editing.
  - Given item creation fails validation, when the edit is applied, then the document remains
    unchanged and the localized validation reason is shown.
- As a project author, I want to create a new Ganttee file from the sidebar, so that I can start a
  project from the toolbar.
  - Given the sidebar toolbar, when the user views it, then it provides a New File/Project icon
    action alongside the item-creation actions.
  - Given an available workspace folder, when the user invokes New File/Project from its toolbar
    icon, then a new `.ganttee` document opens in the Ganttee editor.
- As a project author, I want each row to show its type, label, actions, and status in a consistent
  order, so that the tree is easy to scan.
  - Given a project item row, when it is rendered, then order is type icon, label, right-aligned
    Move Up, Move Down, Delete, and status controls.
  - Given the first sibling in its current owner scope, when its row is rendered, then Move Up is
    disabled or hidden.
  - Given the last sibling in its current owner scope, when its row is rendered, then Move Down is
    disabled or hidden.
  - Given a project item row with no warning or error diagnostics, when it is rendered, then it
    always shows the default `Valid` status with a pass icon.
  - Given an item with warning or error diagnostics, when its row is rendered, then it shows the
    matching status and icon instead of the default `Valid` status, without hiding the item type
    identity.
- As a project author, I want native tree activation to open item editing, so that interaction
  remains familiar without a duplicate Edit action.
  - Given a task, milestone, or group, when the user activates the row, then the corresponding edit
    form opens for that item.
  - Given an item no longer exists when the row is activated, then no document mutation occurs and
    the tree refreshes with a localized message.
- As a project author, I want to move one item up or down within its current owner scope, so that I
  can manually adjust order without changing its group.
  - Given an item with a previous sibling, when the user invokes Move Up, then the item exchanges
    position with that sibling within the same group or project-root scope.
  - Given an item with a next sibling, when the user invokes Move Down, then the item exchanges
    position with that sibling within the same group or project-root scope.
  - Given an item is first or last in its current owner scope, when the user invokes its unavailable
    move action, then no document change occurs.
  - Given a Move Up or Move Down action, when it completes, then the item's group ownership is
    unchanged.
  - Given multiple items are selected, when the user invokes a move action, then the command applies
    only to the activated row and does not reorder the selection as a batch.
- As a project author, I want to delete an item directly from its row, so that common actions are
  readily available.
  - Given a task or milestone, when the user invokes Delete, then existing dependency and deletion
    rules apply.
  - Given a non-empty group, when the user invokes Delete, then the existing cascade/reparent choice
    remains available.

### Tree search

- As a project author, I want to search project items by name from the sidebar, so that I can find
  items quickly in a large project.
  - Given the sidebar tree, when the user views it, then a search field appears below the sidebar
    toolbar and above the tree.
  - Given a search term, when the user types into the search field, then the tree displays only
    project items whose names contain that term, ignoring letter case.
  - Given a search term containing regex characters, when the user types it, then those characters
    are matched as ordinary text and are not interpreted as a regular expression.
  - Given an empty search field, when the field is cleared, then the complete unfiltered tree is
    displayed.
  - Given a search term with no matching item names, when filtering is applied, then the tree shows
    its existing empty-result state without changing the document.
  - Given a filtered tree, when the user edits, deletes, moves, or sorts an item, then the search
    term remains active and the filtered tree refreshes from the updated document.

### Bulk deletion

- As a project author, I want to delete mixed selected items in one confirmed action, so that
  cleanup is efficient.
  - Given one or more selected tasks, milestones, or groups, when the user invokes Delete, then one
    simple confirmation asks, "Delete these items?"
  - Given the user cancels confirmation, when the dialog closes, then the document remains
    unchanged.
  - Given confirmation is accepted, when deletion is applied, then one document edit removes the
    selected items using existing dependency cleanup rules; selected groups are deleted with their
    contents.
  - Given one selected item is stale or invalid, when bulk deletion runs, then valid items are
    processed and the invalid item is reported.

### Grouping and ungrouping

- As a project author, I want to group or ungroup items by drag-and-drop, so that I can organize
  ownership visually without changing sibling order.
  - Given one or more selected tasks, milestones, or groups and a group target, when the user drops
    the selection onto that group, then valid items receive that group as their owner.
  - Given one or more selected tasks, milestones, or groups and the project-root target, when the
    user drops the selection at root, then valid items lose their group ownership.
  - Given an item or group dropped onto itself or one of its descendant groups, when the drop
    completes, then that grouping move is silently rejected with no error or localized reason and no
    document change.
  - Given a mixed selection containing valid and invalid grouping moves, when the drop completes,
    then valid items change owner and invalid items remain in place silently, with no error or
    localized reason.
  - Given a task or milestone target, when items are dropped onto it, then the drop is silently
    rejected because tasks and milestones are not containers, with no error and no document change.
  - Given any grouping or ungrouping drop, when it completes, then item order within each owner
    scope is unchanged.

### Sorting

- As a project author, I want a Sort icon action in the sidebar toolbar beside New Task, so that I
  can order scheduled items quickly.
  - Given a scheduled project, when the sidebar toolbar is shown, then the Sort icon appears
    immediately to the left of New Task.
  - Given a project without a schedule, when the sidebar menu is shown, then Sort is unavailable.
  - Given a project has just opened, when no sort is requested, then authored item order remains
    unchanged.
- As a project author, I want Sort to offer explicit direction choices, so that I can order work
  ascending or descending without relying on remembered state.
  - Given a scheduled project, when the user invokes the Sort toolbar icon, then a popup menu offers
    explicit Ascending and Descending actions.
  - Given Ascending is selected, when sorting completes, then root items and every group are sorted
    recursively by effective start date, effective end date, then name in ascending order.
  - Given Descending is selected, when sorting completes, then root items and every group are sorted
    recursively by effective start date, effective end date, then name in descending order.
  - Given items have equal effective dates and equal names, when items are sorted, then their prior
    relative order is retained.
  - Given the project schedule cannot be computed, when the user invokes Sort, then sorting is
    unavailable and the user receives the defined localized warning.
  - Given a sort completes, when the project is saved and reopened, then the resulting item order is
    retained and no sort direction is persisted or remembered.

## 5. Business Rules

- The `.ganttee` TextDocument is the only persisted source of truth.
- Every sidebar mutation is applied through a host-side document edit, followed by parse,
  validation, schedule evaluation, and model refresh.
- Tasks, milestones, and groups are selectable tree items; only groups are valid drop containers.
- Drag-and-drop changes only group ownership: dropping onto a group assigns that group as owner;
  dropping at project root removes group ownership.
- An item cannot become its own ancestor. Self and descendant-group drops are silently rejected and
  do not change the document.
- Drops onto tasks or milestones are silently rejected and do not change the document.
- A mixed grouping move processes valid selected items independently; invalid items remain in place
  silently.
- Grouping and ungrouping never changes item order within an owner scope.
- Move Up and Move Down operate on one item only, exchange it with its adjacent sibling in the same
  owner scope, and never change group ownership.
- Sorting is initiated only through the toolbar Sort popup, which offers explicit Ascending and
  Descending actions; it is not a drag-and-drop operation.
- Bulk deletion uses one confirmation for the full selection. It does not show a summary or ask for
  separate confirmation per group.
- A confirmed selected group is deleted with its contents, including descendant groups and their
  items, while existing dependency cleanup rules apply.
- Authored entity-array order represents persisted tree order; webview timeline order is unchanged
  (not explicitly changed) by sidebar grouping, manual reordering, or sorting.
- Sort compares effective start date first, effective end date second, and name third, recursively
  across root and all group scopes. The natural comparator handles undefined values. Complete ties
  preserve prior relative order.
- Sort direction is selected explicitly from the Sort popup and is not persisted or remembered.
- Search matches the item `name` using case-insensitive substring comparison.
- Search input is treated as literal text; regex syntax has no special meaning.
- Search changes only tree presentation and never changes the `.ganttee` document.
- An empty search term disables filtering.
- Every project item displays a status; `Valid` is the default status and uses a pass icon.
- Warning or error diagnostics replace the default `Valid` status and pass icon with their matching
  status and icon.
- All user-facing command, confirmation, validation, and status text is localized.

## 6. Domain & Data Model Impact

- New/changed types in `src/common/models/`: add no persisted entity fields. Host-side grouping,
  single-item move, and sort operation models may be introduced in services if needed; they must use
  existing task, milestone, group, and schedule types.
- Existing anchors: `ProjectModel`, `Task.effectiveStart/effectiveEnd`,
  `Milestone.effectiveStart/effectiveEnd`, and scheduled-group rollups provide sort values.
- `.ganttee` schema change: none. Keep `CURRENT_DOCUMENT_VERSION` at `2`; group ownership and
  authored array order already persist the required results, while Sort direction is an operation
  input and is not persisted.
- Existing document migration behavior remains unchanged.

## 7. Protocol Impact

- No new `HostToWebview` or `WebviewToHost` messages are required. Sidebar edits flow through host
  document edits; existing `documentChanged` updates the webview.
- Existing edit and delete entity references remain the shared identity contract.
- If implementation requires a webview-visible operation status, add a typed protocol message only
  after proving existing diagnostics and document-change responses cannot express it; such a message
  must remain non-persistent.

## 8. UX

- Timeline (ECharts): remain unchanged except for refresh after a successful sidebar document edit.
  Sidebar grouping, manual Move Up/Move Down, and Sort must not change timeline display order unless
  existing model semantics independently do so.
- Sidebar tree:
  - place New File/Project, New Task, New Group, New Milestone, Sort, and search access in the
    sidebar toolbar according to availability; retain New Task in its current toolbar location.
  - Place the search field below the toolbar and above the tree. Use progressive disclosure.
  - Keep labels primary, reveal row actions on intent where the host tree API permits, retain
    visible status for health comprehension, and preserve keyboard/native tree activation.
  - Search must provide a clear text-entry focus path, preserve the active term during tree
    refreshes, and expose a clear empty-result state.
  - Drag/drop must expose clear grouping targets; impossible moves are rejected silently.
  - Move Up and Move Down are row actions, immediately to the right of Delete, and are disabled or
    hidden at scope boundaries. Sort opens a popup with explicit Ascending and Descending actions.
- Edit form:
  - existing entity edit forms open for create and edit operations.
  - Successful form submission follows the existing host-owned reparse path.
  - No new form fields are required.
- Design rationale: Calm at rest keeps secondary actions quiet; Focused hierarchy makes label and
  item type lead; Consistent row grammar gives equivalent item kinds equivalent controls; Delightful
  feedback confirms successful operations without adding noise for silently rejected moves.
- New localized strings are required for project creation, group/milestone creation, Sort, the
  simple bulk-delete confirmation, Move Up, Move Down, status labels, and unavailable-schedule
  feedback.

## 9. Test Strategy

- Unit (models/services): test stable date comparator, ascending/descending sort, date ties, name
  ties, undated items using the natural comparator without a special placement assertion,
  unschedulable projects, recursive group sorting, owner changes, root moves, grouping cycle
  rejection, silent task/milestone drops, silent mixed-selection handling, adjacent Move Up/Move
  Down behavior, scope boundaries, ownership preservation, one-step bulk-delete confirmation,
  group-content cascade deletion, and dependency-aware bulk deletion.
- Integration (commands/editor/tree): test project creation, custom-editor icon contribution,
  command registration, item creation/edit activation, row action placement and boundaries,
  multi-selection deletion and cancellation, grouping/ungrouping drag/drop, silent invalid drops,
  stale edits, document reparse, tree refresh, Sort popup actions, schedule-unavailable Sort state,
  persisted order without persisted direction state, search-field placement, live filtering, literal
  regex characters, case-insensitive matching, clearing, no matches, and filtering after document
  edits.
- Webview interaction: verify `documentChanged` reflects sidebar-created, moved, deleted, and sorted
  documents; verify no new protocol message is needed; retain existing edit-form behavior.
- Fixtures: cover empty, unscheduled, scheduled, nested-group, overlapping-selection, invalid-date,
  undated-item, dependency, and cycle-rejection documents.
- Coverage: branch coverage remains at least 90% per file and class; every acceptance-criteria error
  path has a focused test.

## 10. Risks

- 🟣 **C-01** — A host-side bulk edit could diverge from existing deletion semantics and leave
  dangling dependencies.
  - Status: **Open**
- 🔴 **H-01** — Drag/drop changes can create cycles or corrupt group ownership if validation and
  silent partial-success handling are inconsistent.
  - Status: **Open**
- 🔴 **H-02** — Custom Delete and status row controls may exceed native `TreeItem` capabilities and
  produce inconsistent keyboard or screen-reader behavior.
  - Status: **Open**
- 🟡 **M-01** — Effective-date sorting may produce surprising placement for unscheduled or
  unresolved items.
  - Status: **Resolved** — Sorting uses the natural comparator; no special ordering requirement is
    defined for undefined date values. Sorting is unavailable when the project schedule cannot be
    computed.
- 🟡 **M-02** — A missing `ganttee-color.svg` asset may delay editor-tab identification work.
  - Status: **Open**

## 11. Open Questions

- 🔴 **H-01** — Which concrete native VS Code tree mechanism provides right-aligned Delete, Move Up,
  Move Down, and status controls while preserving keyboard and assistive-technology behavior?
  - Status: **Open**
- 🔴 **H-02** — What status does the row show: diagnostic health (`valid`, `warning`, `error`), task
  lifecycle status (`todo`, `inProgress`, `done`), or both?
  - Status: **Resolved** — Rows display diagnostic health; `Valid` with a pass icon is the default,
    and warning/error diagnostics replace it.
- 🔴 **H-03** — What filename and overwrite policy applies to New Project, and which workspace
  folder is selected when several are available?
  - Status: **Open**
- 🟡 **M-01** — Can mixed selections be reordered as a batch?
  - Status: **Resolved** — Multi-selection reorder is out of scope; one row moves only within its
    current owner scope.
- 🟡 **M-02** — When selected groups contain overlapping descendants, should confirmation show
  selected roots, all affected descendants, or both?
  - Status: **Resolved** — The confirmation is always the simple localized "Delete these items?"
    prompt; no item summary is shown.
- 🟡 **M-03** — Should undefined date values receive special Sort handling?
  - Status: **Resolved** — No special handling is required; the natural comparator determines their
    order. Sorting is unavailable only when the project schedule cannot be computed.
- 🟡 **M-04** — Where should the approved `ganttee-color.svg` asset live, and is it a new asset or
  an existing asset renamed for the custom editor contribution?
  - Status: **Open**
