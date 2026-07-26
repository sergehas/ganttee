# Feature: Scheduling Computation Engine (effective dates & rollup)

> Status: Draft · Owner: Copilot · Last updated: 2026-07-26

## 1. Summary

Compute `effective*` values for tasks, milestones and groups from the validated
scheduling graph, using topological-order constraint propagation over the
normalized precedence DAG (O(V+E)), followed by post-order group rollup. Output is
a pure, scheduled model consumed by the webview and sidebar. Depends on the
dependency-type-rename, scheduling-data-model, and graph-validation specs.

## 2. Goals / Non-goals

### Goals

- Topological longest/shortest-path propagation producing `effectiveStart`,
  `effectiveEnd`, `effectiveDuration` (the `Schedulable` accessors on the
  `GanttModel` entities from the in-memory-oo-model spec), with the owner always
  the `source`.
- Correct aggregation for multiple same-type incoming constraints (`max`/`min`).
- Working-day date arithmetic (skip Saturday/Sunday; fractional working-day
  support), retaining fractional precision (no rounding).
- Group rollup: min start / max end over descendants.
- Epoch-day internal arithmetic; parse ISO once.
- Pure service in `src/services/` (no `vscode`), unit-testable and importable by
  the webview.

### Non-goals

- Validation (see graph-validation spec — prerequisite; engine assumes a valid
  graph).
- Model shapes / rename (see scheduling-data-model and dependency-type-rename
  specs — prerequisites).
- Rendering changes beyond consuming effective values.

## 3. User Stories

- As a planner, I want dependent tasks to shift automatically when a predecessor
  moves, so that the chart reflects real scheduling.
- As a planner, I want group bars to span their contents, so that rollups are
  accurate.

## 4. Acceptance Criteria

- Given a task with a static start and duration
  When scheduled
  Then `effectiveEnd = start + duration` counted in working days (weekends
  skipped).

- Given a task ending Friday with a 1 working-day successor `startAfter`
  When scheduled
  Then the successor starts the following Monday (Saturday/Sunday skipped).

- Given a task (source) with a `startAfter` dependency on two anchors (targets)
  ending on different days
  When scheduled
  Then its `effectiveStart` equals the later end (`max`), regardless of
  processing order.

- Given a task defined by end date + duration (`endWith`/`endBefore` or static end)
  When scheduled
  Then `effectiveStart = effectiveEnd − duration` in working days.

- Given an `endBefore` dependency (owner source, anchor target)
  When scheduled
  Then `source.effectiveEnd ≤ target.effectiveStart` holds.

- Given a milestone (source) with a `startAfter` dependency
  When scheduled
  Then `effectiveStart = effectiveEnd = target.effectiveEnd` (a milestone's start
  and end alias its date).

- Given a group containing tasks/milestones/subgroups
  When scheduled
  Then its `effectiveStart` = min and `effectiveEnd` = max of descendants.

- Given a task defined by start + end (duration derived)
  When scheduled
  Then `effectiveDuration = effectiveEnd − effectiveStart`.

- Given a valid graph
  When scheduled
  Then every vertex is assigned effective values in a single topological pass (no
  re-processing required).

## 5. Domain & Data Model Impact

- New pure module in `src/services/` (e.g. `schedulingService.ts`) exposing
  `schedule(model: GanttModel): GanttModel`. It computes the `Schedulable`
  `effectiveStart()` / `effectiveEnd()` / `effectiveDuration()` values on the
  in-memory-oo-model entities (replacing their first-implementation placeholders).
  Reuse `topologicalOrder`/adjacency helpers from
  `src/services/dependencyGraphService.ts`.
- Because `Date` and methods do not cross the webview boundary, the host projects
  the scheduled entities back to a plain, ISO-string effective-value shape in
  `src/common/models/` (pure, not persisted) for transport to the webview.

## 6. Protocol Impact

- `src/common/protocol.ts`: `documentChanged`/`init` payloads carry (or are
  accompanied by) the scheduled effective model, or the webview computes it from
  the shared pure service. Choose one approach and keep exhaustive typing.

## 7. UX

- Timeline (ECharts): bars drawn from effective dates; group bars span descendants;
  milestones at their `effectiveStart` (which aliases the milestone date).
- Sidebar tree: shows effective dates.
- Edit form: derived values reflect recomputed effective results after save.

Design rationale (values → principles → moves): Value Flow · Principle: the
computed schedule must feel immediate and consistent · Move: single-pass O(V+E)
recompute on each edit.

## 8. Test Strategy

- Unit (services): golden-schedule fixtures — chain, diamond (multi-incoming
  `max`), end-anchored propagation, `endBefore` inequality, milestone alias, group
  rollup, start+end derived duration, working-day arithmetic (weekend skip,
  fractional working day), epoch-day arithmetic.
- Property/perf: large synthetic graph completes in one pass; ordering-independence
  of `max` aggregation.
- Webview interaction: chart consumes effective values after a save.
- Coverage: branch coverage ≥ 90% across each dependency-type branch and rollup.

## 9. Risks & Open Questions

- 🟡 Medium — Risk: start+end tasks whose derived duration is negative —
  define behavior (reject in the graph-validation spec vs clamp here).
- 🟡 Medium — Open question: the precise fractional working-day arithmetic
  convention (how a partial working day maps onto the calendar); whether a
  static date on a non-working day stays as-is or snaps forward.
- 🟢 Low — Open question: recompute granularity — full recompute per edit vs
  incremental dirty-subtree; full recompute recommended initially.
