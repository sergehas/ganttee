# Change Log

All notable changes to the "ganttee" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on
how to structure this file.

## [Unreleased]

### Added

- Structural DAG validation at hydration time for self-loop, parallel-edge,
  and directed-cycle rejection.
- Shared date utilities for parse/format and calendar-day arithmetic.
- End-to-end editing support for tasks, milestones, and groups from timeline
  and sidebar entry points, including kind-aware edit routing.
- Milestone dependency editing parity with task dependency behavior and host-side
  cycle rejection.
- Schedule validation now detects circular dependencies, duplicate dependency
  links, self-links, invalid dependency endpoints, ambiguous task and milestone
  constraints, and schedule components without an absolute date anchor.
- The editor now reports schedule problems in the sidebar, edit forms, and
  localized notifications, while allowing warning-only constraint conflicts to
  be saved for later resolution.
- Invalid dependencies and unanchored components are automatically removed when
  a document is opened. Edits that would create these invalid states are blocked
  before they are saved.
- Task, milestone, and group editing is supported from both the timeline and
  sidebar, with milestone dependency editing and cycle prevention.
- Groups now display schedule information derived from their member items,
  including duration calculated using calendar days.

### Changed

- **Breaking change:** The `endBefore` dependency type is no longer supported.
  Documents containing it cannot be opened until the dependency is removed or
  replaced.
- Dependency names and direction semantics were updated to use `endWith` and
  the current endpoint model.
- Task and milestone constraints now use endpoint-aware scheduling rules, with
  derived dates where the selected constraints provide enough information.
- Task and milestone names, and group membership fields, now use the current
  document format (`name` and `groupId`).
- Group hierarchy validation now rejects self-parenting and circular ancestry.
