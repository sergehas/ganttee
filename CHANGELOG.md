# Change Log

All notable changes to the "ganttee" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Host-side `DependencyGraph` on hydrated models with shared traversal APIs.
- Structural DAG validation at hydration time for self-loop, parallel-edge,
  and directed-cycle rejection.
- In-memory OO `GanttModel` entities implementing `Schedulable` with `Date`
  accessors.
- Shared date utilities for parse/format and calendar-day arithmetic.
- End-to-end editing support for tasks, milestones, and groups from timeline
  and sidebar entry points, including kind-aware edit routing.
- Milestone dependency editing parity with task dependency behavior and host-side
  cycle rejection.

### Changed

- Dependency type migration: `finishWith` → `endWith`, `finishAfter` →
  `endBefore`, with `sourceId`/`targetId` swap to preserve semantics.
- Field normalization migration: task/milestone `title` → `name`, group
  `parentId` → `groupId`, with serializer writing only new keys.
- Task data model now supports exactly two constraints from
  `{start, duration, end}` with derived endpoint behavior.
- Unified protocol/controller/webview editing flow around discriminated entity
  operations for task, milestone, and group updates.
- Group hierarchy validation now rejects self-parenting and ancestor cycles;
  document validation and tests were expanded accordingly.
