---
Status: Intend
Owner: Copilot
Last updated: 2026-08-15
---

# Feature: Diagnostics and Problems View

![Status: Intend](https://img.shields.io/badge/status-Intend-ADB5BD?style=for-the-badge)

<!-- AGENT NOTE: This high-level spec is intentionally captured at Intend per
the request, although the normal workflow creates spec files at Draft. -->

## 1. Summary

Provide a dedicated diagnostics surface for schedule validation problems so
planners can see, understand, and navigate all document issues without relying
on individual sidebar tooltips. The view should aggregate structural and
semantic graph diagnostics, preserve the advisory failure model, and navigate
the user to the affected entity or dependency.

## 2. Goals / Non-goals

### Goals

- Aggregate all current diagnostics for the active `.ganttee` document.
- Show severity, localized message, affected entity or dependency, and a useful
  navigation target.
- Refresh diagnostics when the source document or active editor changes.
- Keep the document text as the source of truth and preserve advisory semantic
  validation behavior.
- Retain concise sidebar badges as a fast signal while making the diagnostics
  view the complete explanation surface.

### Non-goals

- Adding a second persisted validation state to `.ganttee` files.
- Changing structural graph failures from their current error handling model.
- Replacing the existing sidebar tree or timeline.
- Implementing scheduling-engine calculations or automatic repairs.

## 3. User Stories

- As a planner, I want to see every validation problem in one list, so that I
  can assess the health of a schedule quickly.
- As a planner, I want to navigate from a diagnostic to its task, milestone,
  group, or dependency, so that I can repair the right item.
- As a planner, I want diagnostics to update after edits, so that stale issues
  do not mislead me.

## 4. Acceptance Criteria

- Given an active document with semantic validation violations
  When the diagnostics view is opened
  Then it lists every violation with a localized message and its severity.

- Given a diagnostic linked to a task, milestone, or group
  When the user activates it
  Then the owning Gantt editor is focused and the entity is revealed.

- Given a diagnostic linked to a dependency
  When the user activates it
  Then the owning Gantt editor is focused and the dependency endpoints are
  identified for repair.

- Given the active document changes
  When the controller reparses successfully
  Then the diagnostics view refreshes and removes resolved violations.

- Given the active editor changes
  When another Gantt document becomes active
  Then the view displays diagnostics for the new document only.

- Given a document with no validation violations
  When the diagnostics view is opened
  Then it displays an empty state without reporting an error.

- Given a structural graph failure
  When the document is loaded
  Then the existing localized error behavior remains intact and the view does
  not invent a second persisted error state.

## 5. Domain & Data Model Impact

No `.ganttee` schema change is expected. The existing
`GraphValidationResult` should gain a normalized diagnostic projection or a
service-level mapper that produces stable diagnostic records with category,
severity, message arguments, and entity/dependency references.

## 6. Protocol Impact

No host-to-webview protocol change is expected for the initial implementation.
The diagnostics view should live in the extension host/sidebar layer and use
the active controller's validation result. A later timeline-integrated warning
surface may require a protocol message, but that is out of scope here.

## 7. UX

The diagnostics view should be calm at rest and focused during repair: show a
compact summary when there are no issues, group repeated warnings by category,
and reveal details on selection rather than making every row visually loud.
Each row should provide a clear navigation affordance and distinguish blocking
structural failures from advisory semantic warnings. Existing sidebar badges
remain a proximity cue; the diagnostics view is the complete explanation and
navigation surface.

Design rationale: Value **Focused**; Principle **one thing leads, the rest
supports**; Move: make the diagnostics list the complete secondary surface for
repair while keeping the timeline primary and the tree scannable.

## 8. Test Strategy

- Unit: map every `GraphValidationResult` category to a diagnostic record,
  including severity, localization arguments, and navigation target.
- Integration: refresh on document changes and active-editor changes; preserve
  the active document association.
- UI: empty state, grouped diagnostics, activation navigation, and structural
  error presentation.
- Coverage: maintain branch coverage at or above 90%.

## 9. Risks & Open Questions

- 🟡 Medium — Risk: dependency diagnostics may not have a single tree node to
  select. Treatment: navigate to the source endpoint and show both endpoint ids
  in the diagnostic details.
- 🟡 Medium — Open question: should the view be a dedicated activity-bar view,
  a panel beside the editor, or an adaptation of the existing sidebar tree?
- 🟢 Low — Open question: should semantic warnings be filterable by category or
  severity in the first release?
