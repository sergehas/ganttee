---
Status: Reviewed
Owner: Copilot
Last updated: 2026-09-13
Related ADRs: none
---

# Feature: Chart View Functional Organization

![Status: Reviewed](https://img.shields.io/badge/status-Reviewed-0D6EFD?style=for-the-badge)

## 1. Summary

The chart editor currently offers a timeline without a view-specific command strip, persisted view
preferences, a two-level time header, or independently controllable chart layers. This feature gives
project planners a compact, localized menu bar and an organized ECharts timeline so they can adjust
what the chart shows, its time scale, and its export destination without changing scheduling data or
leaving the editor.

## 2. Goals / Non-goals

### Goals

- Add a webview menu bar for the specified view-element toggles, zoom controls, export choices, and
  reserved overflow control.
- Persist the selected zoom level and visibility state for dependencies, off-days, holidays, and the
  critical-path overlay in the `.ganttee` document.
- Render the chart as the required ordered functional layers, including a separate task-list column
  and a two-level timeline header.
- Compute one critical path from the already-scheduled dependency graph using pure scheduling logic
  that has no `vscode`, DOM, or Node dependencies.
- Localize all added visible, tooltip, accessible-name, error, and unavailable-state strings.

### Non-goals

- Add `editor/title` actions; the tab-view toolbar remains reserved and empty.
- Build the authoring UI for project working days or holiday periods; existing project settings are
  consumed as chart inputs by this feature.
- Change scheduling semantics to interpret holidays as non-working time. The chart may render the
  persisted holiday ranges, but the scheduling engine continues to ignore them.
- Change task, milestone, group, dependency, calendar, or schedule semantics.
- Add keybindings, exact codicon selection, parent-header click-to-zoom, sorting, grouping, column
  customization, or responsive overflow management.
- Export other formats or implement a native host-side clipboard fallback.

## 3. Epic

**Chart View Functional Organization** delivers a focused, stateful chart workspace: users can
control the visible analytical layers and time scale, inspect an aligned name column and
hierarchical date header, and export the current chart while the saved `.ganttee` document remains
the authoritative source for every persisted view preference.

## 4. User Stories & Acceptance Criteria

- As a project planner, I want a compact chart menu bar, so that I can control the current chart
  without searching outside the editor.
  - Given a Gantt chart is open When its webview finishes initialization Then a localized
    icon-button strip appears above the chart with toggle, zoom, export, and trailing overflow
    groups in the specified left-to-right order.
  - Given a menu-bar action has an icon-only control When I focus or hover it Then it exposes a
    localized accessible name and tooltip.
  - Given a view-specific action is available When I inspect the tab-view toolbar Then that action
    appears only in the menu bar and no `editor/title` action is contributed.
  - Given the feature has no overflow actions When the menu bar is rendered Then the trailing
    overflow control is hidden, absent from the accessibility tree, and all current actions remain
    directly available in their specified groups and order.

- As a project planner, I want to show or hide chart layers, so that I can focus on the information
  relevant to the current planning task.
  - Given dependency lines, off-days and holidays, and the critical path can be displayed When I
    activate or deactivate their respective toggle Then only the corresponding layer changes
    visibility or emphasis.
  - Given I change a layer toggle When the document update completes and I reopen the same
    `.ganttee` file Then the saved toggle state is restored.
  - Given a document lacks persisted view settings or has no `view` section When it is opened Then
    the chart uses week zoom, shows dependencies, hides off-days, hides holidays, and hides the
    critical-path overlay without reporting a validation error and without materializing a `view`
    section.
  - Given a document has a partial `view` section When it is opened Then each omitted view property
    resolves to its documented default.
  - Given `WorkingCalendar.daysOff` is absent When the off-days toggle is enabled Then the chart
    uses the existing scheduling default for Saturday and Sunday and remains usable.
  - Given `ProjectSettings.holidays` is absent or empty When the holidays toggle is enabled Then the
    chart remains usable and renders no holiday shading.

- As a project planner, I want to change the chart time scale and fit the project, so that I can
  move between detail and overall schedule context.
  - Given the chart is displayed When I use zoom in, zoom out, or select a level from the zoom
    dropdown Then the selected level changes among day, week, month, quarter, and year without
    changing authored task dates.
  - Given a zoom boundary is reached When I request a farther zoom in or out Then the chart remains
    at the nearest supported level and the control does not create an invalid view state.
  - Given a project has scheduled entities When I select Fit-to-window or reset zoom Then the
    rendered chart entities fit the visible canvas without changing the selected persisted zoom
    level or authored task dates.
  - Given a document contains an unsupported persisted zoom value When it is parsed Then parsing
    rejects the invalid document value and the chart does not render an ambiguous time scale.

- As a project planner, I want an intelligible timeline structure, so that I can compare entity
  names, dates, dependencies, and scheduling pressure accurately.
  - Given a supported non-year zoom level is selected When the chart renders Then it shows a
    selected-level row nearest the bars and its parent-level row above it, with one vertical grid
    line per selected-level unit and a stronger parent boundary line.
  - Given the year zoom level is selected When the chart renders Then it shows only a single year
    header row.
  - Given I inspect a header cell When I hover it Then its localized tooltip follows the
    selected-level date or date-range rule and uses ISO-8601 week numbering for day and week levels.
  - Given a scheduled entity is displayed When I scan its row Then its name is in a left-hand
    task-list column functionally distinct from the right-hand bar area.
  - Given an entity is selected while every optional layer is enabled When the chart renders Then
    its selection highlight is rendered above bars, dependency lines, and critical-path emphasis.

- As a project planner, I want to identify the critical path, so that I can see the dependency chain
  that drives the project completion date.
  - Given a valid scheduled dependency graph When I enable the critical-path toggle Then the chart
    emphasizes the longest chain that determines the project end date without altering dependency or
    schedule data.
  - Given a valid scheduled graph contains multiple equal-length critical chains When I enable the
    critical-path toggle Then the chart emphasizes exactly one critical path selected by the first
    equal maximum predecessor encountered during deterministic topological CPM traversal.
  - Given the scheduled graph has a cycle, dangling dependency, or invalid date When the document is
    validated Then existing validation blocks the update and no critical-path projection is produced
    from invalid schedule data.

- As a project planner, I want to export the chart as SVG or PNG, so that I can share the current
  visual schedule outside VS Code.
  - Given the export control is available When I open its dropdown Then SVG and PNG each offer
    Download and Copy to clipboard as destination actions.
  - Given I choose Download When the webview generates the selected SVG or PNG payload Then the
    webview starts a browser-style download with a localized default filename and does not send the
    payload to the extension host.
  - Given I choose Copy to clipboard and the browser clipboard permission is granted When the export
    is generated Then the webview writes the selected payload with `navigator.clipboard` and does
    not send a clipboard or file message to the host.
  - Given clipboard access is unavailable or export generation or download initiation fails When I
    choose the affected destination Then the chart remains open, no document data changes, and a
    localized unavailable or failure message is shown.
  - Given the chart is visible at a selected zoom and viewport When I choose Download or Copy to
    clipboard Then the currently rendered ECharts canvas is exported without changing the viewport,
    zoom level, selection, or document data.

## 5. Business Rules

- The tab-view toolbar contributes no actions for this feature.
- Each view-specific action has exactly one control in the webview menu bar.
- The menu bar order is view-element toggles, zoom controls, export, then overflow.
- The trailing overflow control is reserved for a future feature and is not rendered while it has no
  actions.
- View-element buttons are pressed when their layer is visible or active and unpressed otherwise;
  zoom and export controls are momentary controls.
- The chart editor root is two structurally distinct regions — a fixed-height, always-visible
  menu-bar region and a chart region hosting the single ECharts canvas. The task-list column,
  timeline headers, bars, dependencies, off-days, holidays, critical-path emphasis, and selection
  are all rendered inside that canvas. The menu bar remains outside the canvas and does not scroll
  with it. Neither region overlaps the other, and only the chart region scrolls or resizes its
  internal content.
- The menu bar and its controls are built from generic, view-agnostic webview components (a menu-bar
  container and an icon-action control) under `src/webview/components/`, not one-off markup coupled
  to the chart view. The icon-action control supports a leaf action and a nested group of icon
  actions (for example, the export dropdown and the reserved overflow control) through the same
  component, so a future view's menu bar can reuse it without duplicating toggle, tooltip, or
  accessible-name logic.
- The persisted zoom value is exactly one of day, week, month, quarter, or year.
- The optional `view` section is compatible with document schema version 2. Missing or partial view
  values resolve in memory to these defaults: `zoomLevel: week`, `showDependencies: true`,
  `showOffDays: false`, `showHolidays: false`, and `showCriticalPath: false`. Unrelated document
  writes do not materialize a missing `view` section.
- The persisted view section stores only view preferences, never derived schedule, critical-path,
  export, selection, or viewport-range data.
- Missing view settings are backward-compatible and resolve to documented defaults.
- A document update that changes view settings uses the same revision check, validation,
  `WorkspaceEdit`, reparsing, and broadcast path as other webview edits.
- Timeline headers use these selected-level and parent-level formats:
  - Day selected level: day-of-week ordinal `1–7`; parent level: `W{isoWeek}`.
  - Week selected level: `W{isoWeek}`; parent level: `{MM} {yyyy}`.
  - Month selected level: `{MM} {yyyy}`; parent level: `Q{n} {yyyy}`.
  - Quarter selected level: `Q{n} {yyyy}`; parent level: `{yyyy}`.
  - Year selected level: `{yyyy}` with a single row and no parent level.
- Header tooltips use these formats: day shows a full date such as `Sunday 13 September 2026`; week
  shows a date range such as `August 18–24, 2026`; month shows a month name such as
  `September 2026`; quarter shows a range such as `Q3 2026 (Jul 1–Sep 30)`; and year shows the year
  such as `2026`.
- Week numbers use ISO-8601 Monday-start weeks numbered `W01` through `W53`.
- The critical path is a derived projection of a valid scheduled dependency graph. It is not
  serialized as entity or dependency data.
- The critical-path projection returns exactly one path. It includes every graph node and edge on
  that path, including milestones when they occur on the selected path. Groups are not part of the
  dependency graph used for this projection.
- Fit-to-window changes only the temporary viewport scale. It fits the rendered chart entities in
  the visible canvas without changing the persisted zoom level or authored dates.
- Export captures the currently rendered ECharts canvas, including the task-list column, headers,
  selection, and currently enabled chart layers. Export does not change the viewport, zoom level,
  selection, or document data.
- Download and copy-to-clipboard actions are handled entirely in the webview. The webview generates
  the SVG or PNG payload, starts the download, or writes to `navigator.clipboard`; export actions
  never send the payload to the extension host.
- Export never mutates the `.ganttee` document.

## 6. Domain & Data Model Impact

- Add a pure `ProjectView` model under `src/common/models/`, re-exported by
  `src/common/models/index.ts`. It contains `zoomLevel` and Boolean preferences named
  `showDependencies`, `showOffDays`, `showHolidays`, and `showCriticalPath`.
- Add an optional `holidays` property to `ProjectSettings` in `src/common/models/document.ts`. It is
  an array of shared date-range values defined in `src/common/dates.ts`; each range has an inclusive
  ISO date-only `start` and `end`. The existing `GanttModel.settings` path already exposes
  `ProjectSettings` to the chart model.
- Add an optional `view` property to `GanttDocument` in `src/common/models/document.ts`. It is a
  sibling of `settings`; the document text, not React state, is canonical for these preferences.
- Add a pure critical-path projection in `src/services/`, consuming the existing valid scheduled
  dependency graph and returning one ordered path of node and edge identifiers to emphasize. It does
  not create a second graph and has no `vscode`, DOM, Node, or persistence dependency.
- Keep `CURRENT_DOCUMENT_VERSION` at 2. Treat `view` as an optional backward-compatible v2
  attribute. Missing or partial view values resolve in memory to the documented defaults, and
  unrelated document writes do not materialize a missing `view` section.
- Extend document parsing and serialization in `src/services/` to validate allowed zoom values and
  Boolean view fields, preserve valid settings, and reject malformed values. Validate holiday range
  dates as ISO date-only values and reject ranges whose end precedes their start. The transient
  `schedule` transport projection remains unpersisted. Holiday ranges are not passed to or consumed
  by the scheduling engine.

## 7. Protocol Impact

- Add a `WebviewToHostMessage` variant for a full proposed `ProjectView` and its base document
  revision. The webview sends it after a user changes a persisted view preference.
- The editor controller applies the proposal by replacing only the current document's `view` section
  and routes it through its existing stale-revision and document-validation path. A stale proposal
  causes the current document to be rebroadcast rather than overwriting newer text.
- Use existing `documentChanged` and `init` messages to deliver the persisted view state. No new
  host-to-webview view-state message is required.
- Export does not add host-to-webview or webview-to-host protocol messages. The webview generates
  SVG and PNG payloads, starts downloads, and performs clipboard writes locally.
- Add all new user-facing menu, header, export, unavailable, download, and failure strings to the
  existing localization catalog. The webview resolves them through its delivered l10n catalog.

## 8. UX

- Chart window: the value is a predictable editor shell. The principle is that the always-visible
  menu bar and the chart never compete for the same space or scroll together. The move is a fixed
  menu-bar region above a separately scrollable chart region, composed from the reusable menu-bar
  and icon-action components described in Business Rules.
- Timeline (ECharts): the value is a calm, focused planning surface. The principle is that chart
  context stays visible while controls support it quietly. The move is a compact icon toolbar above
  the timeline, separators between functional groups, and pressed state only for active visibility
  controls.
- Timeline (ECharts): render the functional layers back to front inside one canvas as header,
  off-days and holidays, task-list and bar areas, bars, dependencies, critical-path emphasis, and
  selection. The task-list column and timeline bar area remain aligned vertically when scrolling or
  resizing.
- Timeline (ECharts): the two-level header explains each scale at a glance; parent labels are
  informational only. Its grid hierarchy distinguishes parent boundaries without introducing an
  additional visual control layer.
- Sidebar tree: it receives the normal rebroadcast after a view-preference update but does not add
  view controls or duplicate the menu bar.
- Edit form: entity editing, direct chart gestures, and selection behavior are unchanged. The edit
  form never owns chart view preferences.
- Export: the dropdown clearly binds each supported format to Download and Copy to clipboard
  actions. Downloads and clipboard writes occur in the webview. A failed export, unavailable
  clipboard, or failed download initiation presents localized feedback without obscuring the chart
  or changing selection, schedule, or saved data.

## 9. Test Strategy

- Unit (models/services): cover view defaults, parsing, serialization, missing and partial view
  values, malformed zoom and Boolean values, and every critical-path branch, including empty graphs,
  chains, forks, equal-length paths, cycles, dangling edges, and invalid dates.
- Unit (controller): cover a current view update, a stale revision rebroadcast, and validation
  rejection without applying a `WorkspaceEdit`. Export behavior is not tested in the controller
  because export does not use the host protocol.
- Integration (editor/document): assert a valid menu preference edits document text through
  `WorkspaceEdit`, reparses, and rebroadcasts the persisted state to the chart and sidebar. Assert
  missing view values are not materialized by unrelated writes and entity scheduling and dependency
  data are unchanged.
- Webview interaction: assert menu ordering, localized tooltips and accessible names, toggle pressed
  states, zoom boundaries, dropdown choices, hidden empty overflow state, header row and grid
  behavior, aligned task-list rows, and layer z-order.
- Webview interaction: assert SVG and PNG download initiation, localized default filenames,
  webview-only clipboard writes, clipboard denial, download-initiation failure, and export-render
  failure states.
- Coverage: retain branch coverage at or above 90%, with targeted tests for all migrations,
  validation failures, graph-invalid states, stale updates, export failures, and boundary zoom
  behavior.

## 10. Risks

- 🔴 **H-01** — The chart could incorrectly treat off-days as unavailable even though
  `WorkingCalendar.daysOff` already exists in the model and scheduling defaults provide Saturday and
  Sunday when it is absent.
  - Status: **Resolved**: read the existing `WorkingCalendar.daysOff` value, or the existing
    Saturday/Sunday default, for the off-days layer. Holidays are a separate new `ProjectSettings`
    field and do not affect scheduling.
- 🔴 **H-02** — Exporting a task-list column together with an ECharts canvas could produce an image
  whose dimensions or visual order differed from the on-screen chart.
  - Status: **Resolved**: no longer applicable because the task-list column and every chart layer
    are rendered inside the same ECharts canvas; there is no cross-surface export composition.
- 🟡 **M-01** — Critical-path duration and deterministic tie-breaking semantics are easy to get
  wrong.
  - Status: **Resolved**: compute one path from the existing scheduled graph using node effective
    durations and graph edges; do not branch on dependency type or create a graph that removes
    milestones. Test empty graphs, forks, equal-length paths, milestones on the selected path, and
    zero-duration entities.
- 🟡 **M-02** — The webview-only download behavior may differ between supported VS Code webview
  environments.
  - Status: **Resolved**: export is intentionally handled entirely in the webview through browser-
    style downloads and `navigator.clipboard`; no host file-writing flow or export protocol is
    required.
- 🟡 **M-03** — Fit-to-window can be interpreted as a temporary viewport operation or as a change to
  the persisted zoom preference.
  - Status: **Resolved**: fit only the rendered chart entities in the visible canvas, preserve the
    persisted zoom level and authored dates, and test that the temporary fit is not persisted.
- 🟡 **M-04** — A responsive overflow menu can conflict with the requirement that the current
  feature's controls have fixed order and behavior.
  - Status: **Resolved**: limit this feature to reserving an empty overflow control; define movement
    of future actions as a later extension of the menu-bar contract.
- 🟢 **L-01** — The task-list column and timeline bar area can drift inside the single ECharts
  canvas during resize, scrolling, or data-zoom changes.
  - Status: **Resolved**: keep the menu bar always visible outside the canvas and use shared row,
    header, column, viewport, and scroll measurements for the canvas regions; cover resize and
    scroll alignment in webview tests.

## 11. Open Questions

- 🔴 **H-03** — What exact JSON shape and defaults should version 2 use for the optional `view`
  section, including partial objects and unrelated writes?
  - Status: **Resolved**: `view` remains an optional version-2 attribute. Missing or partial values
    resolve in memory to `zoomLevel: week`, `showDependencies: true`, `showOffDays: false`,
    `showHolidays: false`, and `showCriticalPath: false`. The `view` section is not materialized by
    unrelated document writes.
- 🔴 **H-04** — What deterministic tie-breaking rule selects one critical path when multiple paths
  have the same maximum effective duration?
  - Status: **Resolved**: use the first equal maximum predecessor encountered during deterministic
    topological CPM traversal. The rule is runtime-derived and is not persisted.
- 🟡 **M-05** — Does Fit-to-window change the persisted zoom level or include entities outside the
  rendered chart?
  - Status: **Resolved**: fit only the rendered chart entities in the visible canvas, preserve the
    persisted zoom level and authored dates, and do not persist the temporary fit state.
- 🟡 **M-06** — What exactly is included in an export?
  - Status: **Resolved**: export the currently rendered ECharts canvas through `getDataURL`,
    including the task-list column, headers, selection, and currently enabled chart layers. Export
    does not change the viewport, zoom level, selection, or document data.
- 🟡 **M-07** — What user-facing presentation should the chart use for an empty holiday source?
  - Status: **Resolved**: keep the holidays toggle available and render no holiday shading when
    `ProjectSettings.holidays` is absent or empty. The off-days layer uses the existing calendar
    setting and default and is not treated as unavailable.
- 🟡 **M-08** — What exact labels and boundaries apply to each selected-level and parent-level
  header for day, week, month, quarter, and year, including partial periods, timezone, and date
  format?
  - Status: **Resolved**: use the explicit formats and ISO-8601 week convention defined in the
    Business Rules section.
- 🟡 **M-09** — Which stable export failure codes are carried by the protocol, and which environment
  owns localization for each code?
  - Status: **Resolved**: no export failure codes are carried by the host/webview protocol because
    export is handled entirely in the webview.
- 🟢 **L-02** — Is the reserved overflow control rendered in this feature even when it has no
  current actions, and what accessible name should it expose in that state?
  - Status: **Resolved**: hide the empty control and remove it from the accessibility tree; no
    accessible name or menu items are exposed while it has no actions.
- 🟢 **L-03** — How should responsive overflow management move non-fitting actions into the trailing
  overflow control while preserving action state, order, keyboard focus, and accessibility?
  - Status: **Resolved**: overflow deferred to a future spec.

## 12. Implementation Notes

### Critical path computation

- Apply the Critical Path Method (CPM) to the scheduled dependency graph to calculate the single
  critical path.
- Compute the critical path in the host from the existing already-scheduled Graphology DAG used by
  the scheduling service.
- Do not create a second graph for critical-path computation. Use the existing graph nodes,
  effective-duration values, and edges.
- Use the Graphology DAG topological ordering to process the graph in dependency order.
- Use a forward pass to calculate each node's earliest reachable completion value.
- Use a backward pass from the scheduled project completion value to calculate each node's latest
  allowable value.
- Calculate total float from the forward and backward pass values. Select one critical path using
  the deterministic tie-breaking rule resolved by H-04.
- Return the ordered node and edge identifiers for that single path to the chart view. The result is
  derived and is not persisted in the `.ganttee` document.
- Preserve milestones in the existing graph. Their zero effective duration does not require a
  special exclusion step, and a milestone may appear on the selected critical path.
- Groups are not part of the graph used for this projection. Dependency types do not alter the
  critical-path calculation; graph edges provide the ordering relationships.
- Run the projection only for a valid scheduled graph. Invalid or unavailable schedule data produces
  no critical-path projection and does not change existing validation behavior.

### Export generation

- Generate SVG and PNG images using ECharts' native export capabilities. The webview uses the
  generated payload to start the browser-style download or perform the clipboard action; it does not
  implement a separate chart rasterization or export protocol.

### Document compatibility

- Keep document schema version 2.
- Treat `view` as an optional backward-compatible v2 attribute.
- Resolve missing or omitted view properties in memory using the documented defaults.
- Do not materialize a missing `view` section during unrelated document writes.

### Fit-to-window

- Use `chart.resize()` to update the physical ECharts canvas dimensions.
- Apply a separate temporary timeline scale or viewport-range operation to fit the rendered chart
  entities without changing the persisted `zoomLevel`.
- Do not persist the temporary fit state.

### Critical-path tie handling

- Process nodes in deterministic topological order during the CPM passes.
- When equal maximum predecessor values occur, retain the first equal maximum predecessor
  encountered during that traversal.
- Return the resulting single ordered path without creating a second graph.
