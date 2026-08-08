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

### Changed

- Dependency type migration: `finishWith` → `endWith`, `finishAfter` →
  `endBefore`, with `sourceId`/`targetId` swap to preserve semantics.
- Field normalization migration: task/milestone `title` → `name`, group
  `parentId` → `groupId`, with serializer writing only new keys.
- Task data model now supports exactly two constraints from
  `{start, duration, end}` with derived endpoint behavior.
