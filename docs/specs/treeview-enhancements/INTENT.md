---
Status: Intent
Owner: Copilot
Last updated: 2026-09-16
---

# Feature: Treeview Enhancements

![Status: Intent](https://img.shields.io/badge/status-Intent-ADB5BD?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Make the sidebar a complete place to create and organize Ganttee projects. Users can create a
project or project item, see and act on item status, edit or delete items, delete several items at
once, and organize items through drag-and-drop. Open Ganttee projects are clearly identified in
editor tabs.

## 2. Goals / Non-goals

### Goals

- Create tasks, groups, and milestones from the sidebar.
- Display each row in this order: item type icon, item label, then right-aligned Delete, Edit, and
  status controls.
- Edit an item through the native tree activation behavior.
- Let the user multi-select any mix of tasks, milestones, and groups in the tree and delete them all
  in a single confirmed action.
- Move one or more items into a group, or back to the project root, through drag-and-drop.
- Reorder items within a group or at the project root through drag-and-drop.
- Reject invalid moves without preventing valid items in the same selection from moving.
- Let the user create a new `.ganttee` document from the sidebar.
- Use `ganttee-color.svg` as the editor-tab icon for an open `.ganttee` document.

### Non-goals

- A filter/search box for the tree.
- Dropping onto a task or milestone.
- Changes to the timeline beyond reflecting sidebar actions.
- Changing the `.ganttee` document structure or version.

## 3. User Stories

### Epic A — Create and identify Ganttee projects

- As a project author, I want to create a new `.ganttee` project from the sidebar, so that I can
  start planning without first creating and renaming a generic file.
- As a project author, I want open `.ganttee` projects to use the Ganttee color icon in editor tabs,
  so that I can identify them quickly.

### Epic B — Create project items

- As a project author, I want to create a task, group, or milestone from the sidebar, so that I can
  build my project without leaving the tree.

### Epic C — Understand and manage project items

- As a project author, I want each row to show its type, label, actions, and status in a consistent
  order, so that the tree is easy to scan and use.
- As a project author, I want to distinguish valid, warning, and error states, so that I can
  understand each item's health at a glance.
- As a project author, I want to edit or delete an item directly from its row, so that common
  actions are readily available.
- As a project author, I want native tree activation to edit an item, so that interaction remains
  familiar.

### Epic D — Delete several project items

- As a project author, I want to select several tasks, milestones, and/or groups together and delete
  them in one confirmed action, so that I can clean up my project efficiently.
- As a project author, I want the confirmation to explain the full effect of deleting groups and
  their members, so that I can make an informed decision.

### Epic E — Organize project items

- As a project author, I want to drag a task, milestone, or group (or several selected at once) and
  drop them onto a group or at the project root, so that I can reorganize my project visually.
- As a project author, I want to reorder items within a group or at the project root, so that the
  tree reflects the sequence I need.
- As a project author, I want invalid moves to be clearly rejected while valid items still move, so
  that one invalid item does not block the rest of my selection.

## 4. Acceptance Criteria

- Given the sidebar, when the user creates a project, then a new `.ganttee` project opens in the
  Ganttee editor.
- Given an open `.ganttee` project, when its editor tab is shown, then the tab uses
  `ganttee-color.svg`.
- Given the sidebar tree, when the user adds a task, group, or milestone, then the new item is
  created and opened for editing.
- Given a project item row, when it is shown, then its order is: type icon, label, and the
  right-aligned Delete action, Edit action, and status indicator.
- Given a project item, when its status is shown, then it is valid by default and changes to warning
  or error when applicable.
- Given a project item, when the user activates it through the tree or invokes Edit, then the item
  opens for editing.
- Given a project item, when the user invokes Delete, then the existing deletion rules apply.
- Given several selected items, when the user invokes Delete, then one confirmation explains the
  total effect, including members removed with selected groups.
- Given a deletion confirmation, when the user cancels it, then the project remains unchanged.
- Given one or more selected items, when the user drops them onto a group, then valid items move
  into that group.
- Given one or more selected items, when the user drops them at the project root, then valid items
  are removed from their current groups.
- Given one or more selected items within a group or at the project root, when the user moves them
  to a new position, then they appear in the chosen order.
- Given an item dropped onto itself, when the drop completes, then nothing changes and no error is
  shown.
- Given a group dropped onto one of its descendants, when the drop completes, then that group does
  not move, a clear reason is shown, and other valid items in the selection still move.
