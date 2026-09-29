---
Status: Implementing
Owner: Spec Writer
Last updated: 2026-09-29
Related ADRs: none
---

# Feature: Settings editor

![Status: Implementing](https://img.shields.io/badge/status-Implementing-F59F00?style=for-the-badge)

## 1. Summary

Project planners need to change scheduling calendars, holidays, and status definitions without
editing document JSON. This feature provides a dedicated Settings editor view for the same
`.ganttee` document, with document-backed editing and synchronized updates to other open views.

## 2. Goals / Non-goals

### Goals

- Open a dedicated Settings editor for the active `.ganttee` document from a Command Palette command
  or an editor action.
- Edit working days, working hours, and working-day start time.
- Add and delete inclusive holiday date ranges.
- Add and edit statuses, show one aggregate usage count across item kinds, and delete statuses with
  confirmation when they are in use.
- Provide a reusable Boolean toggle field with either label placement.
- Preserve the `.ganttee` TextDocument as the single source of truth.

### Non-goals

- Add settings that are not listed in this spec.
- Edit an existing holiday range; this version supports adding and deleting holiday entries only.
- Change scheduling semantics, status lifecycle values, or the document schema.
- Replace the Gantt chart editor or change its default status for `.ganttee` files.

## 3. Epic

Deliver a document-scoped Settings editor that lets planners maintain working calendar settings,
holiday ranges, and configurable statuses while keeping the chart, sidebar, and settings view
consistent with the saved project document.

## 4. User Stories & Acceptance Criteria

- As a planner, I want to open settings for the current project document, so that I can configure it
  without editing JSON.
  - Given a `.ganttee` document is open When I invoke the Settings command or editor action Then a
    separate Settings editor view opens for that same document.
  - Given the chart and Settings editor are open for one document When I place the Settings editor
    beside the chart Then both views remain available and show changes from the same document.
  - Given no `.ganttee` document is active When I invoke the Settings command Then no unrelated
    document is opened or modified.
  - Given the document cannot be parsed When I open Settings Then the editor reports the document
    error and does not present editable default values as if they were saved.

- As a planner, I want to configure the working calendar, so that scheduling uses the work days and
  hours for this project.
  - Given valid settings When I change days off, working hours, or start time Then the updated
    values are written to this document and reflected in all open views.
  - Given the working calendar is displayed When I view its days-off setting Then it shows seven
    labeled toggles in Monday-to-Sunday order, with each toggle on when that weekday is a day off.
  - Given I turn a weekday toggle on or off When the change is accepted Then that weekday is added
    to or removed from `daysOff` respectively.
  - Given a day-off selection contains a value outside ISO weekdays 1 through 7 When I apply the
    change Then the host rejects it and retains the last valid document state.
  - Given working hours are not greater than 0 or exceed 24, or start time is outside 0 through less
    than 24 When I apply the change Then the host rejects it and retains the last valid document
    state.
  - Given every ISO weekday is configured as a day off When I apply the change Then scheduling
    validation rejects the impossible calendar and no partial settings update is saved.

- As a planner, I want to add and remove holiday ranges, so that project scheduling and chart
  presentation reflect non-working dates.
  - Given valid start and end dates with start no later than end When I add a holiday Then the
    inclusive date range is saved in the document.
  - Given a holiday end date precedes its start date or either date is invalid When I add the range
    Then the editor reports validation feedback and does not save the range.
  - Given holiday ranges overlap or are adjacent When the document is scheduled Then scheduling
    treats their combined dates as one non-working span without changing the persisted ranges.
  - Given a holiday exists When I delete it Then only that holiday range is removed from the
    document.

- As a planner, I want to add and edit project statuses and see where they are used, so that I can
  manage status definitions without losing track of assignments.
  - Given I enter a status name and color and optionally select a lifecycle state When I add the
    status Then the document stores a status definition with a unique identifier.
  - Given a status is listed When its usage is displayed Then one aggregate counter shows the number
    of groups, tasks, and milestones that reference that status.
  - Given I edit an existing status's name, color, or optional lifecycle state When the change is
    accepted Then the updated definition is saved with the same identifier and its existing item
    assignments remain intact.
  - Given I edit an existing status's enforced lifecycle state When the change is accepted Then
    items already assigned to that status keep their current lifecycle states.
  - Given a status has no enforced state When it is added Then its state remains unset; when a state
    is selected it is limited to `open` or `closed`.
  - Given a status name or color is missing, or its selected state is invalid When I add the status
    Then validation rejects it and the document remains unchanged.

- As a planner, I want deleting an in-use status to show its impact, so that I can confirm the
  resulting unassignments.
  - Given a status is used by one or more groups, tasks, or milestones When I choose Delete Then a
    confirmation presents its usage counts before any document changes occur.
  - Given I cancel that confirmation When the editor returns to the list Then the status and all
    assignments remain unchanged.
  - Given I confirm deletion When the edit is applied Then the status definition is removed and its
    reference is cleared from every matching group, task, and milestone in the same document update.
  - Given I confirm deletion When any part of the document edit fails validation Then neither the
    status nor its assignments are partially changed.
  - Given a deleted status had an enforced lifecycle state When its assignments are cleared Then
    each item's existing lifecycle state remains unchanged.

- As a webview developer, I want a reusable Boolean toggle field, so that Boolean settings use a
  consistent control and label arrangement.
  - Given a Boolean field is rendered with its label on the left When the control is displayed Then
    the toggle is on the right.
  - Given a Boolean field is rendered with its label on the right When the control is displayed Then
    the toggle is on the left.
  - Given the toggle is changed When it reports the new value Then the value is Boolean and the
    label remains the control's accessible name.

## 5. Business Rules

- Settings belong to the `.ganttee` document being edited; they are not shared across documents or
  stored as extension-wide configuration.
- The existing `ProjectSettings` fields remain authoritative for `daysOff`, `workingDayHours`,
  `workingDayStart`, `holidays`, and `statuses`.
- Days off use ISO weekday numbers from 1 through 7. The Settings editor presents seven toggles in
  Monday-to-Sunday order; a toggle is on when its weekday is a day off. At least one weekday must
  remain available for scheduling.
- Working hours are greater than 0 and no greater than 24. Working-day start is at least 0 and less
  than 24; both values use decimal hours.
- Holiday ranges use inclusive UTC date-only values. Their end must not precede their start.
  Overlapping and adjacent ranges are allowed and have the scheduling effect of their union.
- A status has a unique document-local identifier, a non-empty name, a color, and an optional
  lifecycle state. The allowed lifecycle values are `open` and `closed`; an unset state enforces no
  lifecycle value on assignment.
- Editing a status changes its name, color, or optional enforced state without changing its
  identifier or existing item assignments. An enforced-state edit does not change the lifecycle
  state of items already assigned to that status.
- Each status has one aggregate usage count derived from current references across groups, tasks,
  and milestones. Each referencing item is counted once; the count is not persisted.
- Confirmed status deletion removes the status definition and clears matching references from all
  groups, tasks, and milestones atomically. It does not delete those items or change their lifecycle
  states.
- Every accepted edit is validated by the host and persisted through the document edit workflow. The
  webview does not write document text directly.
- Edit proposals for the same document are serialized. Before applying each proposal, the host
  rechecks its base revision; a proposal made stale by an earlier edit is rejected, and open views
  reflect the authoritative document.
- User-facing labels, actions, confirmation text, and validation messages are localized.

## 6. Domain & Data Model Impact

- Existing persisted contracts in
  [`projectSettings.ts`](../../../src/common/documents/project/projectSettings.ts) already contain
  the calendar, holiday, and status fields. No new persisted fields are required.
- [`projectItem.ts`](../../../src/common/documents/project/projectItem.ts) defines the `open` and
  `closed` lifecycle values referenced by an optional status state.
- No `.ganttee` schema change is required. The fields are present in document version 2; do not bump
  `CURRENT_DOCUMENT_VERSION` or add a migration for this editor.
- Add a pure settings-edit workflow in `src/services/` to centralize settings validation,
  usage-count derivation, and status deletion with unassignment. The Settings editor host adapter
  applies accepted results to the document through `WorkspaceEdit`.
- Usage counts are derived from task, group, and milestone status references. They are not added to
  the document model.
- Status deletion must explicitly update the document. Parse-time cleanup of unknown status
  references is not a substitute because it does not persist an edit to the source document.

## 7. Protocol Impact

- Extend [`protocol.ts`](../../../src/common/protocol.ts) with a typed Settings update proposal and
  a correlated result indicating acceptance or rejection. Proposals include the document revision
  they are based on.
- Serialize proposals per document and recheck each proposal's base revision immediately before
  applying its `WorkspaceEdit`. Reject proposals made stale while waiting for an earlier edit.
- Initial and subsequent Settings view data comes from the host's current project presentation.
  After an accepted edit, the existing authoritative document-change flow updates the chart,
  sidebar, and every open Settings view.
- The host validates and applies proposals through the document controller's existing document edit
  boundary. A stale or invalid proposal is rejected; the webview retains no optimistic state that
  differs from the document.

## 8. UX

- **Settings editor:** Open as a distinct editor view for the same document, available from a
  Command Palette command and an action in the Gantt editor. Keep the Gantt chart as the default
  editor. Users can place the Settings view beside the chart using normal VS Code editor-group
  behavior.
- **Working calendar:** Group days off, working hours, and start time together. Present days off as
  seven labeled toggles ordered Monday through Sunday; an enabled toggle means that weekday is
  non-working. Use numeric fields appropriate to working hours and start time.
- **Holidays:** Show existing inclusive ranges with a delete action and a separate add row for start
  date, end date, and add action.
- **Statuses:** Show each name, color, optional enforced state, and one aggregate usage count across
  groups, tasks, and milestones. Provide controls to add a status and edit each existing status's
  name, color, or enforced state. Ask for confirmation with the aggregate count before removing an
  in-use status.
- **Boolean toggle field:** Keep its label and switch at opposite ends of the field row. Support
  label-left/toggle-right and label-right/toggle-left placements; expose the label as the control's
  accessible name.
- **Timeline and sidebar:** Continue to consume host-reparsed document data. Calendar edits update
  scheduling and existing holiday presentation; status changes update status-derived rendering and
  item references.
- **Edit form:** Existing item editing remains unchanged. The Settings view does not replace the
  task, group, or milestone edit form.
- **Design rationale:** Value: **Calm**. Principle: the interface explains itself plainly. Move: use
  three clearly named sections and keep add/delete actions with their corresponding lists. Value:
  **Consistent**. Principle: sameness signals sameness. Move: use one reusable toggle contract and
  the existing project lifecycle values in every status row.

## 9. Test Strategy

- **Unit (models/services):** Extend
  [`documentShapeValidationService.test.ts`](../../../src/test/unit/services/document/documentShapeValidationService.test.ts)
  for status definitions, optional state, invalid settings, date boundaries, and calendar bounds.
  Extend
  [`documentRelationValidationService.test.ts`](../../../src/test/unit/services/document/documentRelationValidationService.test.ts)
  for existing valid and missing status-reference behavior. Add focused tests for the aggregate
  usage count, status edits preserving identifiers and assignments, unchanged lifecycle states on
  enforced-state edits, and atomic status deletion with unassignment across all item kinds. Verify
  overlapping and adjacent holiday ranges preserve current union scheduling behavior.
- **Integration (commands/editor):** Extend
  [`editor.smoke.test.ts`](../../../src/test/smoke/editor.smoke.test.ts) to verify Settings command
  and editor-action registration and opening the view for the same document. Add document-write
  coverage for accepted, rejected, stale, and canceled edits, including two same-revision proposals
  where the serialized first edit succeeds and the now-stale second edit is rejected, plus atomic
  status deletion.
- **Webview interaction:** Cover initial settings rendering, Monday-to-Sunday day-off toggles, field
  changes, holiday and status add/edit/delete flows, aggregate usage count, delete confirmation and
  cancellation, protocol rejection, synchronization between open views, and both Boolean toggle
  label placements and emitted values.
- **Localization:** Verify new Settings labels, status/holiday actions, confirmations, and
  validation feedback use localized strings.
- **Coverage:** Add focused tests for the new flows; branch coverage must remain at least 90% for
  each changed file or class.

## 10. Risks

### 🟡 Medium

- 🟡 **R-01** — The chart and Settings views can submit edits against the same document
  concurrently.
  - Status: **Resolved** — Serialize proposals per document and recheck the base revision directly
    before applying each edit; reject a proposal made stale by an earlier edit and broadcast the
    accepted document state to every open view.
- 🟡 **R-02** — Status deletion intentionally removes references across three item collections. Show
  the aggregate usage count, require confirmation when referenced, and apply the definition removal
  and all unassignments as one validated document edit.
  - Status: **Resolved** — A single pure workflow removes the status and clears its references from
    groups, tasks, and milestones; one validated full-document `WorkspaceEdit` applies the result,
    and focused tests verify all-or-nothing behavior.

## 11. Open Questions

None. The editor entry points, document-scoped persistence, status lifecycle values, existing
validation rules, deletion confirmation, and holiday overlap behavior are defined in this
specification.

## 12. Implementation Notes

- Keep the `.ganttee` `TextDocument` as the sole source of truth. Reuse the existing parse,
  validation, serialization, revision, and `WorkspaceEdit` paths rather than maintaining separate
  settings state.
- Follow the existing layer boundaries: persisted and protocol contracts belong in `src/common/`,
  pure settings workflows and mutations in `src/services/`, VS Code editor and controller
  integration in `src/views/`, and browser-only interaction and rendering in
  `src/webview/features/settings/`. Keep `vscode` imports out of `common/` and `services/`, and
  route webview communication through the typed protocol.
- Reuse existing project-settings types, validation helpers, document presentation, localization,
  and editor patterns when they fit. Centralize shared settings mutations and validation in the
  workflow rather than duplicating them in the chart and Settings surfaces.
- Apply SOLID and DRY pragmatically: keep classes and modules focused on a single responsibility,
  separate VS Code orchestration from pure domain transformations and UI rendering, and prefer the
  simplest design that fits an actual reuse need. Avoid speculative abstractions and duplicated
  business rules.
- Keep status usage counts derived from the current parsed document. Status deletion must remove the
  definition and unassign every matching item in one transformation; changing an enforced state must
  not rewrite lifecycle states on already-assigned items.
- The settings editor uses existing document version 2 fields; no schema migration is introduced.

## 13. Review Outcome

- Resolved R-01 inline: serialize same-document edit proposals and recheck each base revision just
  before applying it. A proposal made stale by an earlier edit is rejected, and accepted document
  changes are broadcast to open views.
- Resolved R-02 inline: status removal and reference clearing are one pure transformation applied
  through a single validated full-document `WorkspaceEdit`; tests cover all item kinds and
  all-or-nothing behavior.
- Added Implementation Notes for existing layer boundaries, reuse, localization and protocol
  boundaries, and pragmatic SOLID/DRY guidance with simple single-responsibility units.
- No ADR was required; the risk treatments follow the existing document source-of-truth and edit
  workflow.
