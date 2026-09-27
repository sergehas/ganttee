---
Status: Implementing
Owner: Copilot
Last updated: 2026-09-27
Related ADRs: <none yet>
---

# Feature: Gantt chart styles

![Status: Implementing](https://img.shields.io/badge/status-Implementing-F59F00?style=for-the-badge)

## 1. Summary

Gantt chart users need to control the visual language and supporting view details of the timeline
without changing project data or scheduling behavior. This feature adds selectable classic, rounded,
and metro chart styles, selectable color themes, graph-item labels, and a temporary legend
visibility control while preserving the existing document-backed view settings and chart behavior.

## 2. Goals / Non-goals

### Goals

- Provide classic, rounded, and metro rendering styles for tasks, milestones, groups, and
  dependencies.
- Persist the selected style, color theme, and graph-item label preference in `settings.view`.
- Default missing or invalid new view values so existing `.ganttee` documents continue to work
  without migration.
- Provide style and theme selection in the chart menu bar.
- Let users switch between Y-axis labels and labels displayed on corresponding graph items.
- Provide a non-persistent legend visibility control.
- Move off-days, holidays, and dependency visibility actions from the menu bar to the chart legend
  while preserving their persisted view settings.
- Keep all style and theme behavior inside the webview chart presentation layer.
- Remove `collapsed` attribute from group
- Toggle collapse/expand group when ctrl+click on them (UI-only behavior)

### Non-goals

- Changing validation, scheduling, dependency computation, or critical-path computation.
- Changing task, group, milestone, dependency, or critical-path data models.
- Adding styles other than classic, rounded, and metro in this phase.
- Changing project entities or introducing document migration.
- Persisting legend visibility.
- Adding runtime theme downloads or user-authored themes.
- Changing sidebar tree or entity edit-form behavior.

## 3. Epic

Deliver configurable Gantt chart presentation controls that let users choose a visual style, color
theme, label placement, and legend visibility, plus transient group collapse interaction, while
keeping the `.ganttee` document as the source of truth for persisted view preferences and leaving
project semantics unchanged.

## 4. User Stories & Acceptance Criteria

### Story 1: Choose a chart visual style

As a project user, I want to choose a chart visual style, so that the timeline matches the way I
read project flow.

- Given a document with no persisted style, when the chart initializes, then it renders using
  `classic`.
- Given a chart with a persisted style, when the chart initializes, then it renders using that
  style.
- Given the chart menu bar is visible, when the user opens the visual-style control, then `Classic`,
  `Rounded`, and `Metro` are available as localized choices.
- Given the user selects a different style, when the selection is applied, then the chart redraws
  with the selected style and a complete `updateView` proposal is sent to the host.
- Given the host rejects the view proposal because the document revision is stale, when the
  authoritative document is rebroadcast, then the chart restores the authoritative style.

### Story 2: Render the supported styles consistently

As a project user, I want each style to apply to every chart element, so that the timeline has one
coherent visual language.

- Given `classic` is active, when the chart renders, then tasks, groups, milestones, and
  dependencies retain the current chart appearance.
- Given `rounded` is active, when the chart renders, then tasks have half-circle ends, milestones
  are filled circles, dependencies use rounded joins or corners, and groups are thin horizontal
  rounded H-shaped bars.
- Given `metro` is active, when the chart renders, then tasks, milestones, groups, and dependencies
  use a consistent metro-map visual treatment with distinct route-like dependency links ,
  station-like milestone markers, 'connecting station' group markers.
- Given an element lies outside the visible timeline or is clipped by the chart grid, when its style
  renderer runs, then it remains clipped or omitted according to the existing chart geometry rules.
- Given the active style is changed, when the project data is unchanged, then task dates, dependency
  relationships, row ordering, and scheduling results remain unchanged.

### Story 3: Choose a color theme

As a project user, I want to choose a chart color theme, so that chart colors suit my working
context.

- Given the chart is initialized without a persisted theme, when the chart renders, then the `blue`
  theme is active.
- Given a theme JSON asset exists in `media/themes` with a filename ending in `-theme.json`, when
  the theme selector is opened, then that theme is available.
- Given a theme filename, when its display label is generated, then the `-theme.json` suffix is
  removed, hyphens and underscores become spaces, and the result is title cased.
- Given the user selects a theme, when the selection is applied, then the chart redraws with that
  theme and the selected theme is proposed through the existing complete view update.
- Given a persisted theme is no longer registered, when the document is loaded, then the validated
  view uses `blue` as if the end user selected it, and a warning is written to the log.

### Story 4: Control graph-item labels

As a project user, I want to choose where entity labels appear, so that I can balance row scanning
with timeline space.

- Given graph-item labels are disabled, when the chart renders, then entity names use the standard
  Y-axis labels.
- Given graph-item labels are enabled, when the chart renders, then the corresponding task, group,
  or milestone label is displayed on the right side of its graph item on the item row, and the
  standard entity labels are not shown on Y-axis.
- Given the user changes the label-placement control, when the selection is applied, then the chart
  redraws and the preference is persisted through the existing view update flow.
- Given a label is longer than its available graph-item space, when the chart renders, then the
  label does not obscure unrelated chart elements and follows the chart's existing overflow
  treatment.

### Story 5: Control the chart legend

As a project user, I want to show or hide the chart legend for the current session, so that I can
reclaim timeline space when I know the chart layers.

- Given the chart is initialized, when the chart renders, then the legend is visible by default for
  that webview session.
- Given the legend is visible, when the user activates the legend visibility action, then the legend
  is hidden without changing the persisted project view.
- Given the legend is hidden, when the user activates the legend visibility action, then the legend
  is shown again.
- Given the webview is reloaded or the editor is reopened, when the chart initializes, then legend
  visibility returns to its session default rather than being read from the document.

### Story 6: Control chart layers from the legend

As a project user, I want to change layer visibility from the chart legend, so that related chart
controls stay with the visual layers they affect.

- Given dependencies are enabled in the persisted view, when the user toggles the dependency legend
  item, then dependency rendering changes and the complete view is persisted.
- Given off-days or holidays are enabled in the persisted view, when the user toggles the
  corresponding legend item, then the shading changes and the complete view is persisted.
- Given the chart menu bar is rendered, then it does not expose separate off-days, holidays, or
  dependency visibility actions.
- Given the critical-path menu action remains available, when the user uses it, then critical-path
  visibility continues to use the existing persisted view behavior.

### Story 7: Preserve existing documents and invalid input behavior

As a project user, I want existing files to remain usable, so that adopting the feature does not
require a manual file conversion.

- Given a valid document omits the new view fields, when it is parsed, then defaults are
  materialized as `style: classic`, `theme: blue`, and graph-item labels disabled.
- Given a view contains an unsupported style, an empty or non-string theme identifier, or a
  non-boolean graph-label value, when it is parsed, then the validated view uses the relevant
  default value, the document remains valid, and a warning is written to the log.
- Given a document contains invalid dates, dangling dependencies, or dependency cycles, when it is
  parsed or validated, then existing validation behavior is unchanged and the chart-style feature
  does not bypass or alter those errors.
- Given a document is serialized after a view change, when it is reopened, then the selected
  persisted view values round-trip without changing project entities and the document remains at
  schema version `2`.

### Story 8: Collapse groups in the chart

As a project user, I want to collapse or expand groups in the chart, so that I can focus on the
timeline rows that matter now.

- Given a group is visible in the chart, when the user ctrl-clicks the group, then its child rows
  collapse or expand in the chart.
- Given a group is collapsed, when the user ctrl-clicks it again, then its child rows become visible
  without changing group or child project data.
- Given the user reloads the webview or reopens the editor, when the chart initializes, then group
  collapse state starts from the chart's default UI state and is not loaded from `settings.view`.
- Given the user clicks a group without ctrl, when the chart handles the click, then existing chart
  selection or interaction behavior remains unchanged.
- Given the user ctrl-clicks a task, milestone, dependency, or empty chart area, when the chart
  handles the click, then no group collapse state changes.

## 5. Business Rules

- `classic` is the default visual style and preserves the current chart rendering.
- `rounded` and `metro` affect rendering only; they do not change project semantics.
- The active style renders tasks, milestones, groups, and dependencies through one style-specific
  rendering contract.
- Only theme assets whose filenames end in `-theme.json` are registered and selectable by the
  webview.
- `blue` is the default theme.
- Theme display names are derived from filenames by removing `-theme.json`, replacing `-` and `_`
  with spaces, and applying title case.
- The active style, active theme, and graph-item label preference are persisted in `settings.view`.
- Legend visibility is webview UI state and is never persisted in `settings.view`.
- Missing or invalid new view fields resolve to their defaults during document loading.
- Default resolution of an invalid or unavailable new view value writes a warning to the log.
- Unknown view properties remain invalid.
- Style and theme selection never changes the source project data, schedule, dependency graph,
  validation rules, or sidebar data.
- Legend interactions for dependencies, off-days, and holidays update the same persisted view
  properties used by document load and save.
- All new menu labels, style names, theme names, and accessibility labels are localized through the
  webview localization bridge.
- Group collapse state is UI-only and is not stored in group data, `ProjectView`, or the `.ganttee`
  document.
- Ctrl-click changes only visibility of descendant chart rows; it does not change project hierarchy,
  scheduling, dependencies, or sidebar tree data.
- Recognized new view fields with invalid values default silently in the validated document; unknown
  view property names remain invalid.

## 6. Domain & Data Model Impact

- New or changed types in `src/common/documents/project/projectView.ts`:
  - `ProjectStyle`: the union of `classic`, `rounded`, and `metro`.
  - `ProjectTheme`: the registered theme identifier string.
  - `ProjectView.style`: persisted active visual style.
  - `ProjectView.theme`: persisted active theme identifier.
  - `ProjectView.showItemLabels`: persisted graph-item label preference.
  - `DEFAULT_PROJECT_VIEW`: defaults to `classic`, `blue`, and `false` for the new fields.
- `src/services/document/documentShapeValidationService.ts` validates the new fields and resolves
  omitted or unsupported values to defaults without rejecting the document. The document loading
  path writes warnings for each defaulted invalid or unavailable value.
- Existing project entities and scheduling models are unchanged.
- The group model does not gain a `collapsed` attribute. Collapse state belongs to webview chart
  state.
- The `.ganttee` schema version remains `2`; all new attributes are native version 2 attributes.
- No document migration process is required.
- Theme asset availability is not validated by the pure document service. The webview theme registry
  falls back to `blue` when a persisted identifier is not registered, and the loading path writes a
  warning.

## Implementation notes

- Extend `ProjectView`, `DEFAULT_PROJECT_VIEW`, and `resolveProjectView` in
  `src/common/documents/project/projectView.ts` with `style`, `theme`, and `showItemLabels`.
- Extend `validateView` in `src/services/document/documentShapeValidationService.ts` to recognize
  the new fields, replace invalid recognized values with defaults, and preserve rejection of unknown
  property names. Keep document version `2`; do not add a migration pass.
- Emit defaulting warnings at the document-loading boundary, where logging can be injected without
  importing logging or `vscode` APIs into pure services. Warnings identify the affected `view` field
  and default value.
- Keep the existing `updateView` message as the complete persisted-view proposal. No new protocol
  message carries theme, style, labels, legend visibility, or group collapse state.
- Keep style registries, theme registries, label placement, legend state, and group-collapse state
  under `src/webview/features/chart/`. Style renderers consume existing ECharts coordinates and
  return render items whose tests compare global bounding boxes, not exact item geometry.
- Generate a build-time registry from bundled `media/themes/*-theme.json` assets. Fail the build on
  duplicate theme identifiers and test that every matching asset is registered. Derive localized
  display names from filenames. When a persisted identifier is absent from the registry, select
  `blue` as the effective theme and emit the document-loading warning.
- Reuse the existing chart menu-bar view-update mechanism for legend clicks. Replace the Legend TODO
  in `GanttChart.tsx` with complete `updateView` proposals, optimistic rendering, and authoritative
  rebroadcast reconciliation. Replace the series TODO with ctrl-click group collapse handling.
- Track collapsed group IDs in webview state. Handle `ctrlKey` group clicks before normal selection
  handling; do not post a host message or mutate the project document.
- Metro visuals remain part of existing chart layers. Do not add metro-specific legend entries.

## 7. Protocol Impact

- No new `HostToWebview` or `WebviewToHost` message is required.
- The existing `WebviewToHostMessage` `updateView` message continues to carry the complete
  `ProjectView`, including the new persisted fields.
- Existing `init` and `documentChanged` messages remain authoritative for restoring the current
  persisted view after reloads or revision conflicts.
- Legend visibility is local webview state and does not cross the host boundary.
- Group collapse state is local webview state and does not cross the host boundary.

## 8. UX

- Timeline (ECharts): The chart uses a webview-local style registry whose contract supplies one
  renderer for each supported entity type: task, milestone, group, and dependency. Each renderer
  consumes existing chart coordinates and returns inspectable ECharts graphic data while preserving
  clipping and omission behavior. Theme selection applies the selected ECharts theme. Graph-item
  labels use one clear placement mode at a time. Ctrl-click on a group toggles visibility of its
  descendant rows for current webview session.
- Chart menu bar: Add compact localized controls for visual style, color theme, graph-item labels,
  and legend visibility. Remove dependency, off-day, and holiday toggle actions from the menu bar.
  Keep critical-path and existing zoom/export controls.
- Legend: Keep the legend as the contextual control surface for dependency, off-day, and holiday
  layer visibility. Legend visibility is a temporary display preference.
- Design rationale: Focused and Calm values require the timeline to remain the primary surface, with
  secondary controls grouped by purpose and revealed through the legend when they directly describe
  chart layers. Consistent treatment requires every style to cover all four supported chart element
  types and preserve shared geometry rules. Delightful feedback comes from immediate redraws after
  view selection without changing project data.
- Sidebar tree: No behavior or presentation change. Tree data continues to reflect project entities,
  not chart styling or transient chart collapse state.
- Edit form: No behavior or presentation change. Entity editing remains independent of chart style,
  theme, and label placement.

## 9. Test Strategy

- Unit models/services: Test style and theme unions, default resolution, accepted values, rejected
  values, unknown-property rejection, and round-trip preservation in
  `documentShapeValidationService.test.ts` and `documentService.test.ts`.
- Unit webview controls: Extend `projectViewControls.test.ts` for immutable style, theme, and label
  updates. Extend `chartMenuPresentation.test.ts` for selector options, localized labels, removed
  layer actions, and legend action state.
- Unit rendering: Add focused tests for the webview-local style rendering contract covering all 12
  style/entity combinations and global bounding boxes of rendered items. Test clipping, filename-to-
  display-name conversion, ignored assets, duplicate identifiers, empty registries, and
  registered-theme fallback without requiring exact rendered-item geometry.
- Webview interaction: Test style and theme selection, graph-label mode, legend show/hide state,
  legend layer toggles, group ctrl-click collapse behavior, non-ctrl-click regression, and
  stale-revision restoration through the existing App and chart seams.
- Group visibility: Test nested groups, empty groups, repeated ctrl-click, fresh-session reset, and
  clicks on non-group elements. Verify no host message or document mutation occurs.
- Integration editor: Verify v2 documents load without migration, invalid new view values resolve to
  defaults with warnings, complete view proposals are applied to the `.ganttee` document, re-parsed,
  rebroadcast, and preserved across reopen. Verify no new protocol message is emitted.
- Regression paths: Preserve tests for invalid dates, dangling dependencies, cycles, and unchanged
  scheduling behavior to demonstrate that rendering preferences do not affect domain validation or
  computation.
- Coverage: Maintain at least 90% branch coverage per changed file or class or function, including
  invalid values, missing assets, fallback paths, clipping, and interaction branches.

## 10. Risks

### 🟡 Medium Risks

- 🟡 **R-01** — Theme assets are bundled at build time rather than discovered dynamically, so an
  incomplete registry could make a valid `media/themes/*-theme.json` asset unavailable.
  - Status: **Resolved** — Generate the registry at build time, fail duplicate identifiers, and test
    registration of every matching theme asset.
- 🟡 **R-02** — Adding labels to graph items can collide with neighboring bars or clipped chart
  boundaries if available width is not handled consistently.
  - Status: **Resolved** — Labels share the item row, stay within row bounds, and are clipped before
    they can overlap unrelated rows or leave the chart bounds.
- 🟡 **R-03** — Moving layer controls into ECharts legend interactions can desynchronize legend
  state from persisted view state if updates are not routed through the complete view proposal flow.
  - Status: **Resolved** — Legend clicks reuse the existing complete view-update mechanism, render
    optimistically, and reconcile through authoritative rebroadcast after stale revisions.

### 🟢 Low Risks

- 🟢 **R-04** — Metro rendering may reduce readability at dense zoom levels.
  - Status: **Resolved** — Metro remains close to classic and requires no additional readability
    rules in this phase.

## 11. Open Questions

### 🟡 Medium Questions

- 🟡 **Q-01** — Should a persisted theme that is unavailable in the current extension version be
  rewritten to `blue` immediately, or only normalized in memory until the next user-initiated view
  save?
  - Status: **Resolved** — The validated view uses `blue` as if the end user selected it, and the
    fallback writes a warning to the log.

### 🟢 Low Questions

- 🟢 **Q-02** — Should the metro style expose any additional legend entries for route or station
  semantics, or remain limited to the existing chart layers?
  - Status: **Resolved** — Metro route and station semantics remain rendering-only within existing
    chart layers; no additional legend entries are added.
- 🟢 **Q-03** — Should graph-item labels display the same localized or project-defined names
  currently used by Y-axis rows in every entity type?
  - Status: **Resolved** — Graph-item labels use the same row labels as the Y-axis for tasks,
    groups, and milestones; localization and project-defined names remain owned by the existing
    row-construction path.

## 12. Review Outcome

- The draft satisfied the required spec structure, including Summary, Goals/Non-goals, Epic, User
  Stories with Given/When/Then criteria, Business Rules, Domain & Data Model Impact, Protocol
  Impact, UX, Test Strategy, Risks, and Open Questions.
- The review found no blocking issues; the identified risks and questions were already tracked with
  valid IDs and resolved inline, and the spec remained within the document-source-of-truth and
  webview-only presentation boundaries required by the project architecture.
- The only approved change was to promote the spec from Draft to Reviewed and refresh the matching
  roadmap entry; no implementation work or code changes were performed.
