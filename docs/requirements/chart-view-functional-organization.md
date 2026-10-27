# Chart View — Functional Organization

> Status: Draft · Owner: Copilot · Last updated: 2026-09-13

## 1. Purpose and context

> [!IMPORTANT]
>
> **For AI agents:** This document is context only, not an implementation specification. Do not
> implement from it, derive implementation tasks or acceptance criteria from it, or change code
> based on it. The Spec Implementer must act only on a corresponding reviewed feature specification.

The chart editor webview currently renders only the ECharts timeline and, when an entity is being
edited, a side edit panel (see [src/webview/App.tsx](../../src/webview/App.tsx)). There is no
toolbar, no menu, and no documented split of the chart area into functional layers. This document is
a **requirement**, not a feature spec: it defines the intended functional organization of the chart
view — toolbar, menu, and chart-area layers — and records the current implementation gaps against
it. A feature spec (or several) should be written from this document before implementation.

## 2. Glossary

- **Chart view** — The custom editor webview opened for a `.ganttee` file (`ganttee.chartEditor`),
  hosting the timeline and edit forms.
- **Tab-view toolbar** — The row of icon actions the VS Code editor title bar renders at the
  top-right of an open editor tab (contributed via `editor/title` menus). Reserved for **transversal
  actions**: actions whose meaning does not depend on the chart's current view state and that could
  plausibly be reused by a future, non-chart view. Currently reserved but empty — see
  [Section 4.1](#41-tab-view-toolbar-editortitle-top-right-of-the-tab--reserved-empty).
- **Menu bar** — A dedicated row of icon buttons rendered inside the webview, above the chart area,
  distinct from the tab-view toolbar. Reserved for **view-specific actions**: actions that only make
  sense for the current chart view state (for example toggling the visibility of a chart element, or
  changing its time scale). Styled like an editor toolbar strip — icon + tooltip, toggle buttons for
  on/off state, and dropdowns where an action needs more than one choice — not a classic File/View
  text-menu bar. Each action lives in exactly one of the toolbar or the menu bar — never both.
- **Toggle button** — An icon button with two visual states, pressed (active/on) and unpressed
  (inactive/off), used instead of a checkbox for view-element visibility switches (consistent with
  VS Code toggle controls such as Word Wrap).
- **Chart area** — The scrollable ECharts surface showing the Gantt timeline (rows of tasks,
  milestones, groups, and dependency lines).
- **Functional layer** — One visually and behaviorally distinct concern rendered within the chart
  area (for example the timeline header, or the dependency lines), independent of how ECharts
  internally composes its series.

## 3. Current state (as of this document)

- **Toolbar:** none. No `editor/title` menu contribution exists for `ganttee.chartEditor` in
  [package.json](../../package.json).
- **Menu bar:** none. The webview has no menu bar; all commands are exposed either through the
  sidebar tree ([views/sidebar](../../src/views/sidebar/)) or by double-clicking chart entities.
- **Zoom controls, view toggles, critical-path toggle, off-days toggle, export:** none — these will
  all land in the menu bar (see
  [Section 4.2](#42-menu-bar-dedicated-row-above-the-chart-inside-the-webview--view-specific-actions-only)).
  The toolbar (see
  [Section 4.1](#41-tab-view-toolbar-editortitle-top-right-of-the-tab--reserved-empty)) has no
  actions for now.
- **Chart area layers implemented today:**
  - Timeline header (date axis) — present, via ECharts `grid`/axis options.
  - Task/milestone/group bars — present (custom series in
    [GanttChart.tsx](../../src/webview/GanttChart.tsx)).
  - Dependency lines — present (`dependencyLinkEndpoints` in
    [chartUtils.ts](../../src/webview/utils/chartUtils.ts)).
  - Selection highlight — present (`selectedEntity` prop drives per-shape `selected` state).
  - Row/task-list column (left-hand names) separate from the bar area — **not present**; row labels
    are drawn inside the same chart canvas.
  - Off-days/holidays shading — **not present** (tracked by roadmap items #13/#14).
  - Critical-path overlay — **not present**.
- **Zoom / fit-to-window / scale switching** — not present as UI; ECharts `dataZoom` component is
  registered but not exposed through any control.

## 4. Functional requirements

Each action below is assigned to exactly one surface: the toolbar for transversal actions, the menu
bar for view-specific actions. No action is duplicated across both.

### 4.1 Tab-view toolbar (editor/title, top-right of the tab) — reserved, empty

- **FR-1 — No actions for now.** The toolbar contributes no `editor/title` actions today. It stays
  reserved for future transversal actions (meaningful outside the chart view); none are defined by
  this document.

### 4.2 Menu bar (dedicated row above the chart, inside the webview) — view-specific actions only

The menu bar is an **icon-button strip**, not a text menu: each action is a codicon with a localized
tooltip. Related actions are grouped with a visual separator between groups. Ordering, left to
right:

**Group 1 — view-element toggles** (each a toggle button — pressed = visible/on, unpressed =
hidden/off; no checkboxes):

- **FR-2 — Dependency-lines toggle.** Shows/hides the dependency-lines layer.
- **FR-3 — Off-days/holidays toggle.** Shows/hides the off-days/holidays shading layer.
- **FR-4 — Critical-path toggle.** Highlights/un-highlights the critical path (longest dependency
  chain driving the project end date) in the chart area.

**Group 2 — zoom controls** (momentary icon buttons, not toggles):

- **FR-5 — Zoom in / zoom out.** Two icon buttons that change the chart's time-scale granularity
  (for example day ↔ week ↔ month ↔ quarter ↔ year).
- **FR-6 — Zoom-level dropdown.** One icon button opens a dropdown menu listing: the zoom levels
  (day, week, month, quarter, year) as a single-select list, and a separate **Fit-to-window / reset
  zoom** entry that scrolls the chart to fit the full project span in the visible area.

**Group 3 — export** (dropdown, not a toggle):

- **FR-7 — Export dropdown.** One "Export" icon button opens a dropdown menu listing the supported
  formats (SVG and PNG); each format entry expands to (or is followed by) two destination actions:
  **Save to file** and **Copy to clipboard** (clipboard writes go through the webview's
  `navigator.clipboard`, no host round-trip). No destination-only or format-only top-level entries.

- **FR-8 — Single source of truth per action.** Each view-specific action (the toggles, zoom, and
  export) has exactly one control, in the menu bar; none of them appear in the toolbar.
- **FR-9 — Overflow button.** The menu bar ends with a kebab ("...") overflow button reserved for
  actions that don't fit the row or are added later; it is defined now even though nothing needs to
  overflow yet, so growth doesn't force a redesign of the strip. When future view-specific actions
  are added (for example sorting, grouping, column visibility), each gets its own group with a
  separator by default; only actions that don't fit the row's available width fall back to the
  overflow button.

### 4.3 Chart-area functional layers

The chart area shall be organized into the following distinct functional layers, composited in
back-to-front order:

1. **Timeline header layer** — the date-scale axis and a "today" marker line, always visible
   regardless of zoom level. Structured as **two stacked rows**: the selected zoom level (bottom
   row, closest to the bars) and its parent level (top row) — see
   [Section 4.4](#44-zoom-level-display-rules) for the exact rules. At the year level, which has no
   parent, only a single row is shown.
2. **Off-days/holidays shading layer** — background shading for non-working days and holiday
   periods, toggleable per FR-3.
3. **Row/task-list layer vs. bar layer** — a left-hand column of entity names/labels, functionally
   separate from the right-hand timeline area where bars are drawn, even though both may render
   inside the same ECharts instance.
4. **Bars layer** — task bars, milestone diamonds, and group summary bars.
5. **Dependency-lines layer** — connector lines between related entities, toggleable per FR-2.
6. **Critical-path overlay layer** — visual emphasis (for example line/bar recoloring) applied on
   top of the bars and dependency layers when the critical-path toggle (FR-4) is active. Computed by
   a pure function in `services/` (shared host+webview), consistent with the existing scheduling
   services.
7. **Selection/highlight overlay layer** — the currently selected entity's highlight, always
   rendered on top of the other layers.

### 4.4 Zoom-level display rules

**Rule:** the X axis always shows exactly two header rows — the **selected level** (what the zoom
control is set to) and its **parent level** — plus vertical grid lines, one per selected-level unit.
Grid lines at a parent-level boundary are drawn heavier/darker than the regular per-unit grid line,
so parent groupings read as a subtle hierarchy without a third row.

| Selected level | Parent level | Selected-level label                      | Parent-level label             | Cell tooltip                                        |
| -------------- | ------------ | ----------------------------------------- | ------------------------------ | --------------------------------------------------- |
| Day            | Week         | Day-of-week ordinal within the week (1–7) | `W{isoWeek}` (e.g. `W34`)      | Full date, e.g. "Sunday 13 September 2026"          |
| Week           | Month        | `W{isoWeek}` (e.g. `W34`)                 | `{MM} {yyyy}` (e.g. `09 2026`) | Week date range, e.g. "August 18 – 24, 2026"        |
| Month          | Quarter      | `{MM} {yyyy}` (e.g. `09 2026`)            | `Q{n} {yyyy}` (e.g. `Q3 2026`) | Month name, e.g. "September 2026"                   |
| Quarter        | Year         | `Q{n} {yyyy}` (e.g. `Q3 2026`)            | `{yyyy}` (e.g. `2026`)         | Quarter date range, e.g. "Q3 2026 (Jul 1 – Sep 30)" |
| Year           | (none)       | `{yyyy}` (e.g. `2026`)                    | — single row only —            | "2026"                                              |

Week numbers (`W{isoWeek}`) use **ISO-8601** week numbering (Monday-start weeks, `W01`–`W53`), since
no other week-numbering convention exists elsewhere in the repo.

- **FR-10 — Two-level header.** The timeline header shall render the selected-level row and its
  parent-level row per the table above, except at the year level, which renders a single row.
- **FR-11 — One grid line per selected-level unit.** The chart area shall draw one vertical grid
  line per selected-level unit (per day, week, month, quarter, or year, depending on the current
  zoom), with a heavier line where a parent-level boundary falls at the same position.
- **FR-12 — Parent-level row is informational.** The parent-level header row is not interactive (no
  click-to-zoom); it only labels the grouping. Click-to-zoom on the parent row may be considered as
  a later enhancement, outside this requirement.

## 5. Constraints and assumptions

- The chart view remains a **single webview realm**; menu bar actions communicate view toggles
  through in-webview state, not new host round-trips, except where the action requires host-only
  capability (for example writing an exported file to disk).
- Zoom level and view toggles (off-days, dependencies, critical path) are **persisted per
  document**, as new attributes in a `view` section of the saved `.ganttee` JSON, sibling to the
  existing `settings` section. `view.zoomLevel` is a single current value (not one remembered value
  per level) — switching levels does not restore a prior per-level state. Adding this section is a
  document-schema change and needs a schema version bump plus a migration entry in
  `ganttDocumentMigrationService` — left to the implementing spec.
- Menu bar icon buttons reuse codicons already bundled (`@vscode/codicons`); toggle buttons use the
  pressed/unpressed button style already established by VS Code (for example Word Wrap), not
  checkboxes.
- "Copy to clipboard" (FR-7) is implemented entirely in the webview via `navigator.clipboard`; it
  does not require a host round-trip.
- Each action is placed on exactly one surface: transversal → toolbar (currently empty),
  view-specific → menu bar. No action is ever exposed in both places.
- This document does not define exact icon choices, keybindings, or the precise localized strings —
  those are implementation details for the spec(s) that follow.

## 6. Open questions

All open questions raised while drafting this requirement have been resolved (see FR-9, FR-12, and
the `view`-persistence and week-numbering constraints in [Section 5](#5-constraints-and-assumptions)
and [Section 4.4](#44-zoom-level-display-rules)). None remain outstanding; new ones raised during
spec-writing should be added here.

## 7. Related work

- Roadmap items [#8 Graphical rendering of groups and dependencies](../specs/ROADMAP.md),
  [#13 Rendering off days](../specs/ROADMAP.md), and [#14 Rendering holidays](../specs/ROADMAP.md)
  are prerequisites/overlaps for FR-3 and the off-days shading layer.
- [UI Integration — Entity Edit Forms](./UI-integration.md) defines the single-webview placement
  this document builds on.
