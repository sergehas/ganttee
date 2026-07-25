# Feature: Scheduling Graph Validation (cycle, determinacy, anchor, dangling)

> Status: Draft · Owner: Copilot · Last updated: 2026-07-19

## 1. Summary

Validate the scheduling graph before it is scheduled. Extends the existing
`dependencyGraphService` to: detect cycles on the temporal-precedence-normalized
graph, enforce per-item determinacy (exactly 2 constraints; reject under- and
over-constrained), flag dangling references, and require each connected component
to have at least one absolute date anchor. Validation runs on dependency-add and
on load.

## 2. Goals / Non-goals

### Goals

- Normalize dependencies to precedence edges (uniform `target ⟶ source`) and detect
  cycles on that graph.
- Determinacy check per task/milestone (exactly 2; groups exempt).
- Reject mixing `endWith` + `endBefore` reverse dependencies on the same owner.
- Anchor-per-component check (≥1 static date).
- Localized rejection messages for add-dependency and load.

### Non-goals

- Effective-date computation (see scheduling-engine spec — it consumes the
  validated graph).
- Model shapes / duration field (see scheduling-data-model spec — prerequisite).
- Rename/migration (see dependency-type-rename spec — prerequisite).

## 3. User Stories

- As a planner, I want a dependency that would create a cycle to be blocked, so
  that my schedule stays computable.
- As a planner, I want a warning when a task has too few or too many constraints,
  so that I fix ambiguous items before viewing the chart.

## 4. Acceptance Criteria

- Given a dependency whose addition closes a cycle in the normalized precedence
  graph
  When the user adds it
  Then it is rejected with a localized error and no document change is applied.

- Given a document that loads with a cycle
  When it is parsed
  Then loading is cancelled with a localized error identifying the cycle members.

- Given a task with fewer than 2 or more than 2 constraints
  When the graph is validated
  Then it is reported as under-/over-constrained with a localized message.

- Given a task that owns both an `endWith` and an `endBefore` reverse dependency
  When the graph is validated
  Then it is rejected with a localized message (conflicting end constraints).

- Given a milestone used as the owner (source) of a reverse dependency
  When validated
  Then it is rejected (milestones may only be the anchor of a reverse dependency).

- Given a connected component with no absolute date anchor
  When validated
  Then it is rejected as unschedulable (floating component).

- Given a dependency referencing a missing source or target
  When validated
  Then it is reported as dangling (existing behavior preserved).

- Given a group
  When validated
  Then determinacy rules are not applied to it.

## 5. Domain & Data Model Impact

- No persisted shape change. Add pure validation types in `src/services/` — extend
  `GraphValidationResult` in `src/services/dependencyGraphService.ts` with
  `underConstrainedIds`, `overConstrainedIds`, `conflictingEndIds` (mixed
  `endWith`/`endBefore`), and `unanchoredComponentIds`.

## 6. Protocol Impact

- `src/common/protocol.ts`: validation failures surface via existing error/warning
  channels; add a message variant only if structured validation results must reach
  the webview.

## 7. UX

- Timeline (ECharts): unschedulable/invalid items indicated (badge/tooltip) rather
  than crashing the render.
- Sidebar tree: invalid nodes flagged with a warning affordance.
- Edit form: inline validation for constraint count on save.

Design rationale (values → principles → moves): Value Trust · Principle: block
invalid states before persistence · Move: layered validation (webview pre-check
plus host canonical check).

## 8. Test Strategy

- Unit (services): normalized-graph cycle detection (uniform `target ⟶ source`,
  including reverse-dep cycles); `wouldCreateCycle` incremental reachability with
  early-exit; determinacy for all combinations; mixed `endWith`/`endBefore`
  rejection; milestone-as-reverse-owner rejection; anchor-per-component; dangling
  references.
- Integration: add-dependency rejection path; load-cancellation path with localized
  messages.
- Webview interaction: constraint-count pre-check blocks save.
- Coverage: branch coverage ≥ 90% across every reject path.

## 9. Risks & Open Questions

- 🔴 High — Risk: normalization must correctly distinguish direct vs reverse
  edge direction.
- 🟡 Medium — Open question: should some results be non-blocking warnings
  (e.g. floating component) rather than a hard load failure?
