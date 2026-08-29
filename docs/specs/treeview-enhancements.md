---
Status: Intend
Owner: Copilot
Last updated: 2026-08-15
---

# Feature: Treeview Enhancements

![Status: Intend](https://img.shields.io/badge/status-Intend-ADB5BD?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The sidebar tree only lets a user create a task at the document root, act on
one entity at a time, and has no way to reorganize the hierarchy other than
editing the raw document. This feature brings three structural capabilities
to the sidebar tree: creating a group or milestone (not just a task), deleting
several selected entities of any kind in one confirmed action, and
drag-and-drop of one or more selected entities onto a group to assign them to
it — all while keeping the `.ganttee` document as the single source of truth
and the timeline webview in sync through the existing change-broadcast
mechanism.

## 2. Goals / Non-goals

### Goals

- Let the "add" entry point in the sidebar create a Group or a Milestone, in
  addition to the existing Task creation.
- Let the user multi-select any mix of tasks, milestones, and groups in the
  tree and delete them all in a single confirmed action.
- Let the user drag one or several selected tasks, milestones, and/or groups
  and drop them onto a group node to assign them as members of that group.
- Reject structurally invalid drops (an item dropped onto itself, or a group
  dropped onto one of its own descendants) with a clear, localized message and
  no document mutation.

### Non-goals

- Reordering entities within a group or at the root — display order is
  unchanged by this feature.
- A filter/search box for the tree.
- Dropping onto anything other than a group (e.g., dropping onto a task or
  milestone, or reordering by drop position) — out of scope for this pass.
- Any change to the timeline (ECharts) rendering beyond it reflecting the
  updated document, which it already does today.
- Any `.ganttee` schema version change — groups and milestones will carry
  (or reuse) the same group-reference field tasks already use today; no
  schema version bump is required.

## 3. User Stories

### Epic A — Create Group and Milestone from the tree

- As a project author, I want to create a new Group from the sidebar, so
  that I can start organizing my plan without leaving the tree.
- As a project author, I want to create a new Milestone from the sidebar, so
  that I have parity with task creation for all entity kinds.

### Epic B — Mass delete across selected entities

- As a project author, I want to select several tasks, milestones, and/or
  groups together and delete them in one action, so that cleaning up my plan
  is fast.
- As a project author, I want a single confirmation that clearly states what
  and how many entities will be removed (including any effect on a deleted
  group's members), so that I don't destroy data by accident.

### Epic C — Drag-and-drop assignment into a group

- As a project author, I want to drag a task, milestone, or group (or several
  selected at once) and drop them onto a group, so that I can reassign them
  visually instead of editing each one individually.
- As a project author, I want an invalid drop (onto itself, or a group onto
  its own descendant) to be rejected with a clear reason and no change to my
  document, so that I don't corrupt my plan's structure.

## 4. Acceptance Criteria

- Given the sidebar tree
  When the user invokes "add" and chooses "Group"
  Then a new group with a localized default name is created (at the root, or
  under the currently selected group if the add action is invoked from a
  group node) and opened for editing, the same way task creation works today.

- Given the sidebar tree
  When the user invokes "add" and chooses "Milestone"
  Then a new milestone with a localized default name and a default date is
  created and opened for editing.

- Given the sidebar tree
  When the user invokes "add" and chooses "Task"
  Then task creation behaves exactly as it does today (no regression).

- Given a multi-selection containing any mix of tasks, milestones, and groups
  When the user runs "Delete" on that selection
  Then a single confirmation dialog states the total number of entities that
  will be removed, including a note when one or more selected groups will also
  remove their members, and confirming performs the deletion (and dependency
  cleanup) as one operation.

- Given a multi-selection that includes a group with members
  When the deletion is confirmed
  Then the group and its members are removed together (cascade), consistent
  with how deleting a single group behaves today.

- Given a multi-selection
  When the user cancels the confirmation dialog
  Then no entity is deleted and the document is unchanged.

- Given one or more tasks, milestones, and/or groups selected in the tree
  When the user drags the selection and drops it onto a group node
  Then every dropped entity is reassigned to that group, the document is
  updated in a single edit, and the timeline reflects the change without a
  manual refresh.

- Given a selection that includes a group
  When that group is dropped onto itself or onto one of its own descendant
  groups
  Then the drop is rejected for that group with a localized message, and any
  other entities in the same selection that are valid to move are still
  reassigned.

- Given a single entity dragged and dropped onto itself
  When the drop completes
  Then it is a no-op — no error shown, no document change.

- Given one or more tasks, milestones, and/or groups selected in the tree
  When the user drags the selection and drops it at the root of the tree
  Then every dropped entity has its group reference cleared (ungrouped), the
  document is updated in a single edit, and the timeline reflects the change
  without a manual refresh.

## 5. Domain & Data Model Impact

- Groups and milestones will carry (or reuse) the same group-reference field
  tasks already use for task-to-group membership; dropping a selection at the
  root of the tree clears that reference (ungroup).
- No new entity types.
- No `.ganttee` schema version bump is required.

## 6. Protocol Impact

- None expected. Tree actions (create, delete, reassign) are host-side
  operations that mutate the document directly; the timeline webview is
  expected to keep receiving updates through the existing document-change
  broadcast with no new host↔webview message required. To be confirmed during
  implementation planning.

## 7. UX

- **Add**: the existing "add" entry point gains a choice of entity kind
  (exact interaction — e.g., a picker vs. split button — is left to
  implementation planning); the created entity opens for editing immediately,
  matching today's task-creation behavior.
- **Mass delete**: multi-select uses the tree's native selection; "Delete"
  appears once per selection (not once per item) and its confirmation names
  the total count and flags cascade effects on any selected group.
- **Drag-and-drop**: uses the tree's native drag affordance and drop
  indicator; an invalid drop gives an inline, localized reason rather than
  failing silently.
- **Timeline / edit form**: unchanged; both continue to reflect whatever the
  document contains after each operation.

## 8. Test Strategy

- **Unit**: creating a group/milestone from "add" produces the expected new
  entity with correct defaults; mass delete correctly expands a selected
  group into its cascade set and removes dangling dependency references for
  every removed entity; drag-and-drop assignment updates the group reference
  for every valid entity in a selection and rejects self-drop and
  descendant-drop cases without mutating the document.
- **Integration**: invoking "add" for each kind, running "Delete" on a mixed
  multi-selection (including a group with members) and confirming/cancelling,
  and simulating a drag-and-drop reassignment (including a partially-invalid
  mixed selection) each produce the expected end-to-end document edit.
- **Coverage**: branch coverage stays ≥ 90%, with explicit tests for the
  cascade-delete branch, the cancel-confirmation branch, and both rejection
  branches (self-drop, descendant-drop) of drag-and-drop.

## 9. Risks & Open Questions

- Low — Exact UI for choosing the entity kind on "add" (picker vs. split
  button) is left open, to be decided during implementation planning.
- 🔵 Nice to have — Sibling reordering and a tree filter were considered but
  kept out of this spec's scope; they can be proposed as separate follow-up
  specs if needed.
