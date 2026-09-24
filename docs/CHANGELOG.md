# Change Log

All notable changes to the "ganttee" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this
file.

## [Unreleased]

### Added

- Holiday-aware scheduling now skips inclusive project holiday ranges during date normalization,
  forward and reverse traversal, fractional duration calculation, and overnight interval ownership.
  Invalid calendars and malformed holiday dates are rejected before scheduling.
- Sidebar project-management workflow: create projects, tasks, groups, and milestones from the
  explorer toolbar; native inline Move Up, Move Down, and Delete row actions; multi-selection bulk
  delete with one confirmation; drag-and-drop grouping/ungrouping with silent rejection of invalid
  or cyclic moves; a toolbar Sort action with explicit Ascending/Descending choices over effective
  dates and name; and a literal, case-insensitive name search field above the tree.
- `.ganttee` editor tabs now use the Ganttee color icon for quick identification.
- Add GNU Affero General Public License v3 licensing metadata and terms.
- Localized editor webview strings through the extension l10n bundle, with locale-aware dates and
  native codicon controls for compact form actions.
- Agent workflow and productivity skills with supporting engineering guidance.
- Structural DAG validation at hydration time for self-loop, parallel-edge, and directed-cycle
  rejection.
- Shared date utilities for parse/format and calendar-day arithmetic.
- End-to-end editing support for tasks, milestones, and groups from timeline and sidebar entry
  points, including kind-aware edit routing.
- Milestone dependency editing parity with task dependency behavior and host-side cycle rejection.
- Schedule validation now detects circular dependencies, duplicate dependency links, self-links,
  invalid dependency endpoints, ambiguous task and milestone constraints, and schedule components
  without an absolute date anchor.
- The editor now reports schedule problems in the sidebar, edit forms, and localized notifications,
  while allowing warning-only constraint conflicts to be saved for later resolution.
- Invalid dependencies and unanchored components are automatically removed when a document is
  opened. Edits that would create these invalid states are blocked before they are saved.
- Task, milestone, and group editing is supported from both the timeline and sidebar, with milestone
  dependency editing and cycle prevention.
- Groups now display schedule information derived from their member items, including duration
  calculated using calendar days.
- Chart editor menu bar with persisted view preferences (zoom level, dependency/off-day/holiday/
  critical-path visibility) stored in the document.
- Export Gantt charts as images through the chart actions menu, with download and clipboard output
  options.
- Critical-path projection computed from the scheduled dependency graph.
- Project settings support for calendar, holidays, and view preferences.

### Changed

- Upgrade React and related dependencies to version 19.
- **Breaking change:** The `endBefore` dependency type is no longer supported. Documents containing
  it cannot be opened until the dependency is removed or replaced.
- Dependency names and direction semantics were updated to use `endWith` and the current endpoint
  model.
- Task and milestone constraints now use endpoint-aware scheduling rules, with derived dates where
  the selected constraints provide enough information.
- Task and milestone names, and group membership fields, now use the current document format (`name`
  and `groupId`).
- Group hierarchy validation now rejects self-parenting and circular ancestry.
- CI now runs dependency security audits, formatting, type checks, linting, builds, integration
  tests, unit tests, smoke tests, and branch-coverage checks across supported operating systems for
  pull requests.
- Commits pushed to feature and bugfix branches receive standalone quality and unit-test checks,
  with duplicate checks skipped when an open pull request already covers the commit.
- Dependency updates for npm packages and GitHub Actions are now grouped and proposed weekly by
  Dependabot.
- bump fast-uri from 3.1.5 to 3.1.7 (fix vulnerability report)
- Reworked the chart editor around a clearer layer structure (task-list column, two-level timeline
  header) and a more organized control bar.
- Refactored the webview into reusable components with a more consistent React/SCSS structure.
- Improved dependency and group rendering in the chart, including schedule-driven group boundaries.

### Fixed

- Clearing a milestone's date field no longer fails to save; the field is now omitted instead of
  being written as an empty string, so a milestone with a dependency-derived date can drop its
  explicit date.
