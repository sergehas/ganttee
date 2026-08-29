---
Status: Implemented
Owner: Tech Lead
Last updated: 2026-08-07
---

# Feature: DAG backbone

![Status: Implemented](https://img.shields.io/badge/status-Implemented-2B8A3E?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

`GanttModel` currently stores dependencies as a plain array, which forces each
consumer to rebuild graph state for ordering, traversal, and cycle checks. This
feature introduces a host-side `DependencyGraph` on the hydrated model so graph
validation and scheduling can share one structural DAG backbone. Hydration now
rejects self-loops, parallel edges, and directed cycles. No `.ganttee` schema,
protocol, or UI contract changes are introduced.

## 2. Goals / Non-goals

### Goals

- Add `DependencyGraph` under `src/common/models/` as a browser-safe model.
- Expose traversal and ordering operations needed by validation and scheduling.
- Add read-only `graph` on `GanttModel` during `hydrateDocument`.
- Enforce structural DAG invariants at hydration time.
- Allow disconnected components.
- Preserve existing `GanttModel` surface and document round-trip behavior.

### Non-goals

- No scheduling computation or precedence normalization.
- No semantic graph validation rules beyond structural DAG checks.
- No changes to entity classes or group membership representation.
- No `.ganttee` schema or document version change.
- No host↔webview protocol changes.
- No new dependencies.

## 3. User Stories

- As a Ganttee maintainer, I want a shared graph model on `GanttModel`, so
  validation and scheduling reuse one source of traversal behavior.
- As a scheduling feature developer, I want predecessor, successor, component,
  and topological-order queries, so I can build scheduling logic without
  rebuilding adjacency state.
- As a current consumer of `GanttModel`, I want existing properties and
  document round-tripping to remain unchanged, so adoption is non-breaking.

## 4. Acceptance Criteria

- Given a valid `GanttDocument`
  When `hydrateDocument` runs
  Then the returned `GanttModel` contains `graph` with all task, milestone, and
  group ids and all dependency edges from the document.

- Given a hydrated model with an acyclic dependency set
  When `graph.topologicalSort()` is called
  Then all entity ids are returned exactly once in valid predecessor-first
  order.

- Given a hydrated model
  When `graph.predecessors(id)` and `graph.successors(id)` are called
  Then each method returns the correct adjacent ids for the requested node.

- Given a hydrated model with disconnected subgraphs
  When `graph.connectedComponents()` is called
  Then each node appears in exactly one weakly connected component, including
  isolated nodes.

- Given a dependency where source equals target
  When `hydrateDocument` runs
  Then hydration fails with a typed self-loop error.

- Given two dependencies with the same source and target ids
  When `hydrateDocument` runs
  Then hydration fails with a typed parallel-edge error.

- Given dependencies that close a directed cycle
  When `hydrateDocument` runs
  Then hydration fails with a typed cycle error that includes cycle ids.

- Given a disconnected but acyclic dependency set
  When `hydrateDocument` runs
  Then hydration succeeds.

- Given a candidate dependency not in the graph
  When `graph.wouldCreateCycle(candidate)` is called
  Then it returns true only if adding that dependency would create a cycle and
  does not mutate graph state.

- Given a hydrated model
  When `toDocument(model)` runs
  Then the output remains byte-stable with prior behavior.

- Given a structurally invalid dependency set in an opened document
  When the editor reparses
  Then the controller shows a localized error and preserves the last valid
  in-memory model.

## 5. Domain & Data Model Impact

### New and changed model contracts

New type in `src/common/models/dependencyGraph.ts`, re-exported from
`src/common/models/index.ts`:

| Name                          | Kind  | Purpose                                                  |
| ----------------------------- | ----- | -------------------------------------------------------- |
| `DependencyGraph`             | Class | Read-only DAG view over entity ids and dependency edges. |
| `SelfLoopDependencyError`     | Error | Signals a dependency where source equals target.         |
| `ParallelEdgeDependencyError` | Error | Signals duplicate source-target pair.                    |
| `CyclicDependencyError`       | Error | Signals a directed cycle and carries cycle ids.          |

Changed type in `src/common/models/entities.ts`:

| Name         | Change                          | Purpose                                                          |
| ------------ | ------------------------------- | ---------------------------------------------------------------- |
| `GanttModel` | Adds read-only `graph` property | Exposes graph operations to validation and scheduling consumers. |

Changed behavior in `src/services/ganttModelService.ts`:

- Hydration builds graph state from all task, milestone, and group ids.
- Hydration rejects self-loop, parallel-edge, and directed-cycle inputs.
- `toDocument` behavior remains unchanged; graph is in-memory only.
- `.ganttee` schema version and migration pipeline remain unchanged.

Changed behavior in `src/views/editor/ganttEditorController.ts`:

- Reparse/hydrate commits only on success.
- Structural graph errors are surfaced as localized user-facing messages.
- Last valid model remains active after a rejected parse.

## 6. Protocol Impact

None. `DependencyGraph` is host in-memory state only. Message contracts in
`src/common/protocol.ts` remain unchanged and continue to pass plain
`GanttDocument` payloads.

## 7. UX

No visual redesign is introduced.

- Timeline behavior remains unchanged for valid documents.
- Sidebar behavior remains unchanged for valid documents.
- Edit form behavior remains unchanged for valid documents.
- On structural graph errors, users see a localized failure message and keep the
  previous valid state.

## 8. Test Strategy

- Unit tests for `DependencyGraph` cover cycle detection, cycle discovery,
  topological sort, predecessor/successor lookup, connected components,
  and `wouldCreateCycle` mutation-free behavior.
- Unit tests for `ganttModelService` cover hydration rejection paths for
  self-loop, parallel-edge, and directed-cycle dependencies.
- Unit tests verify successful hydration for disconnected DAG inputs and the
  presence of `model.graph` on hydrated models.
- Unit tests verify `toDocument(hydrateDocument(doc))` remains byte-stable for
  existing fixture coverage.
- Integration tests for editor reparse ensure structural failures are localized,
  non-fatal, and do not replace the last valid model.
- Existing webview tests remain unchanged and must continue to pass.
- Branch coverage remains at or above 90%.

## 9. Risks & Open Questions

🟡 Medium — Structural vs semantic acyclicity boundary — literal dependency-edge
cycle rejection is in scope here, while normalized-precedence semantic cycle
checks are owned by [Graph validation](./graph-validation.md). Treatment:
document this ownership boundary and test both specs against shared fixtures.

🟢 Low — Transitional duplication risk in graph utilities — overlapping logic
can appear while services migrate to `DependencyGraph`. Treatment: route cycle
and ordering checks through `DependencyGraph` while preserving existing service
API behavior.

🟢 Low — Library adoption timing — deferring Graphology until scheduling keeps
this phase dependency-light but may postpone optimization opportunities.
Treatment: keep `DependencyGraph` API stable so internals can be swapped later
without caller changes.
