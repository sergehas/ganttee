---
Status: Intent
Owner: Copilot
Last updated: 2026-09-23
---

# Gantt chart styles

> [!IMPORTANT] **For AI agents:** This document is context only, not an implementation
> specification. Do not implement from it, derive implementation tasks or acceptance criteria from
> it, or change code based on it. The Spec Implementer must act only on a corresponding reviewed
> feature specification.

## Summary

Allow users to choose how the Gantt chart renders its visual elements. A visual style will provide
rendering behavior for tasks, milestones, groups, dependencies, and the critical path. The initial
styles are `classic`, matching the current chart, and `metro`, using metro-map-like visuals.

## Goals

- Support multiple chart visual styles.
- Let users select the active style from the chart menu bar view controls.
- Persist selected visual style as a view option.
- Keep visual style behavior limited to chart rendering.
- Persist the selected style in the `.ganttee` file's `view` object.
- Provide `classic`, `rounded` and `metro` styles initially.
- Add a persisted view option to toggle between standard Y-axis labels and labels displayed on graph
  items.
- Add a persisted view option to show or hide X-axis labels.
- Add a persisted view option to switch the chart between light and dark themes. In light theme,
  enforce a white chart background.
- Add a non persisted view option to show or legend.
- Add a non persisted view option to show or chart legend.

## Non-goals

- Changing validation, scheduling, dependency computation, or other services.
- Adding visual styles beyond `classic`, `rounded` and `metro` in this phase.
- Changing the underlying task, milestone, group, dependency, or critical-path data model.
- Bumping the document version.
- Implementing document migration.

## Rules

1. A visual style provides a set of rendering functions for tasks, milestones, groups, dependencies,
   and the critical path.

2. The end user can select the active visual style through a dropdown in the chart menu bar,
   alongside other `view` attributes.

3. The selected visual style is saved in the `view` object of the `.ganttee` file.

4. A visual style affects chart rendering only. It must not affect validation, computation,
   scheduling, dependency services, or other host-side behavior.

5. The initial visual styles are `classic`, which matches the current chart rendering, `rounded`
   which is the same as `classic` but with half circle ends for task item, and radius on
   dependencies polylines, and `metro`, which uses metro-map-like visuals.

## Rough Direction

A visual style should define rendering behavior for each supported chart element:

tasks, milestones, groups, dependencies, and critical path. The selected style is a view setting and
affects only the webview chart presentation. The existing chart remains the `classic` style. The
`metro` style should use visual language inspired by metro maps.

## Open Questions

- 🟡 **M-01** — What stable rendering contract should a visual style expose for each chart element?
  - Status: **Open**

- 🟡 **M-02** — What default and migration behavior should apply when an older `.ganttee` file has
  no saved visual style?
  - Status: **Open**

- 🟢 **L-01** — Which chart menu bar control label and localized style names should be used?
  - Status: **Open**

## Draft-ready Handoff

`/spec-draft` should define the visual-style rendering contract, `view` persistence and migration,
chart menu selection behavior, `classic` and `metro` rendering rules, localization, and focused
webview tests. Rendering remains webview-only; validation and computation services remain unchanged.
