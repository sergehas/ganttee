---
Status: Draft
Owner: Tech Lead
Last updated: 2026-07-31
---

# Feature: Graphology graph backbone

![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The host-side in-memory model (`GanttModel` and its `TaskEntity` /
`MilestoneEntity` / `GroupEntity` classes in
[src/common/models/entities.ts](../../src/common/models/entities.ts)) is
currently backed by plain arrays. Every scheduling, validation, and rollup
concern that follows (graph validation, the scheduling engine) needs
graph traversal — cycle detection, topological ordering, connected components,
and post-order rollup. This feature re-platforms `GanttModel` onto the
[Graphology](https://graphology.github.io/) directed-graph library so those
algorithms reuse an optimized, well-tested DAG implementation instead of the
hand-rolled adjacency logic in
[src/services/dependencyGraphService.ts](../../src/services/dependencyGraphService.ts).
The public shape of `GanttModel` is preserved so the hydrator
([src/services/ganttModelService.ts](../../src/services/ganttModelService.ts))
and the editor controller are not disrupted. There is **no** `.ganttee` schema,
disk-format, or host↔webview protocol change — this is an internal refactor of
the host's computed view.

## 2. Goals / Non-goals

### Goals

- Add `graphology`, `graphology-traversal`, and `graphology-dag` as runtime
  dependencies and make Graphology the single in-memory backbone of `GanttModel`.
- Represent tasks, milestones, **and groups** as graph **nodes**; represent
  scheduling dependencies and group membership as graph **edges**.
- Store node/edge data as Graphology **attributes** typed by new interfaces
  (`NodeType`, `DependencyProps`), and expose the computed `effective*` values
  as node attributes read through free accessor functions.
- Preserve the public surface of `GanttModel` (`tasks`, `milestones`, `groups`,
  `dependencies`, `version`, `settings`) so `ganttModelService` and the
  controller are unchanged.
- Configure the graph as a strict DAG substrate: directed, no self-loops, no
  parallel edges.

### Non-goals

- **No scheduling computation.** Populating `effective*` via constraint
  propagation is owned by the [Scheduling engine](./scheduling-engine.md) spec.
  This feature only reserves the node attributes and computes the same
  placeholder values the current entities already return.
- **No validation rules.** Cycle/determinacy/anchor enforcement is owned by the
  [Graph validation](./graph-validation.md) spec; this feature only provides the
  graph the validator will traverse.
- **No `.ganttee` schema change** and **no `CURRENT_DOCUMENT_VERSION` bump.**
- **No protocol change.** The webview and sidebar keep consuming the plain,
  ISO-string `GanttDocument` and the string-returning free helpers in
  [src/common/models/task.ts](../../src/common/models/task.ts).
- **No rendering or import/export libraries** (`graphology-svg`, `graphology-gexf`,
  `graphology-graphml`, `canvas`, …) — the service layer neither renders nor
  serializes the graph.

## 3. User Stories

- As a **Ganttee maintainer**, I want `GanttModel` backed by a proven DAG
  library, so that graph validation and scheduling reuse optimized traversal
  instead of bespoke adjacency code.
- As a **feature developer** building the scheduling engine, I want tasks,
  milestones, and groups as nodes with typed dependency/membership edges, so that
  I can run topological ordering and post-order group rollup directly on the graph.
- As a **consumer of `GanttModel`** (the hydrator and editor controller), I want
  the container's public API unchanged, so that adopting Graphology requires no
  changes on my side.

## 4. Acceptance Criteria

- Given a valid `GanttDocument` with tasks, milestones, groups, and dependencies
  When `hydrateDocument(document)` runs
  Then the returned `GanttModel` wraps a Graphology `DirectedGraph` whose nodes
  are exactly the tasks, milestones, and groups (keyed by their ids), and whose
  edges are the scheduling dependencies plus one `ownedBy` edge per grouped item.

- Given a hydrated `GanttModel`
  When each node is inspected
  Then task/milestone/group nodes carry a `type` attribute of `TASK`,
  `MILESTONE`, or `GROUP` respectively, and the remaining attributes mirror the
  entity's fields (`TaskEntityProps` / `MilestoneEntityProps` / group fields).

- Given a hydrated `GanttModel`
  When each scheduling-dependency edge is inspected
  Then the edge carries a `DependencyProps` attribute exposing `type:
DependencyType`, and the edge is directed `source → target` matching the
  `Dependency.sourceId`/`targetId` convention.

- Given a grouped task, milestone, or nested group
  When the graph is inspected
  Then it has exactly one outgoing `ownedBy` edge whose target is its group node,
  and `ownedBy` edges are tagged so they are excluded from scheduling traversal
  and cycle detection.

- Given two dependencies with the same `sourceId` and `targetId`
  When the graph is built
  Then the second edge is rejected as a parallel edge, and a dangling/duplicate
  diagnostic is surfaced through the existing validation path (not silently
  dropped).

- Given a dependency whose `sourceId === targetId`
  When the graph is built
  Then the self-loop is rejected (the DAG substrate forbids self-loops).

- Given a hydrated `GanttModel`
  When `effectiveStart(node)`, `effectiveEnd(node)`, and `effectiveDuration(node)`
  free accessors are called
  Then they return the same values the current entity methods return in this
  phase (tasks derive the third endpoint from the two set constraints; milestones
  return `date`/`date`/`0`; groups return the Unix-epoch/`0` placeholders),
  reading from node attributes.

- Given a hydrated `GanttModel`
  When `toDocument(model)` runs
  Then the produced `GanttDocument` is byte-stable and round-trips identically to
  the pre-refactor implementation (field order and ISO formatting preserved).

- Given a `GanttModel`
  When `model.tasks`, `model.milestones`, `model.groups`, `model.dependencies`,
  `model.version`, and `model.settings` are read
  Then they return the same collections/values as before the refactor, so
  existing consumers compile and behave unchanged.

- Given an under-constrained task node (fewer than two of {start, duration, end})
  When an `effective*` accessor cannot derive an endpoint
  Then it throws `UnresolvableScheduleError`, matching current behavior (validation
  rejects such documents before hydration in a later spec).

## 5. Domain & Data Model Impact

New/changed types in [src/common/models/](../../src/common/models/):

- **`NodeType`** (new enum): `TASK | MILESTONE | GROUP`. Stored as a node
  attribute to segregate node kinds without instanceof checks.
- **`DependencyProps`** (new interface): `{ type: DependencyType }` — the edge
  attribute shape for scheduling dependencies, derived from
  [Dependency](../../src/common/models/dependency.ts).
- **`ScheduleConstrain`** (new interface): `{ getType(): DependencyType }` — a
  thin accessor over a dependency edge's attributes, per the requirement.
- **`EdgeKind`** (new discriminant): distinguishes scheduling edges from
  `ownedBy` membership edges so traversal/validation can filter membership out.
- **`GanttModel`** (refactored): internally holds a `graphology` `DirectedGraph`
  (`allowSelfLoops: false`, `multi: false`). Its constructor signature and the
  readonly `tasks` / `milestones` / `groups` / `dependencies` / `version` /
  `settings` accessors are preserved; the accessors are derived from the graph.
- **`Schedulable`** (removed as a method contract): the `effectiveStart()` /
  `effectiveEnd()` / `effectiveDuration()` methods on entities are replaced by
  free accessor functions that read node attributes. Entity classes
  (`TaskEntity`, `MilestoneEntity`, `GroupEntity`) are retained only if they
  remain useful as typed attribute-projection helpers; otherwise their logic
  moves into the hydration + accessor functions.

Changed service:

- **`ganttModelService.hydrateDocument` / `toDocument`** build/read the
  Graphology graph instead of plain arrays, preserving byte-stable round-trip.

`.ganttee` schema: **unchanged.** `CURRENT_DOCUMENT_VERSION` stays at `2`; no
migration.

Eventual additional dependencies:

- `graphology` : ^0.26.0
- `graphology-dag`: ^0.4.1,
- `graphology-traversal`: ^0.3.1,

## 6. Protocol Impact

None. The Graphology graph is host-in-memory only and never crosses the webview
boundary (it holds `Date` values, methods, and cyclic references that do not
survive a `postMessage`/JSON round-trip). All `HostToWebview` / `WebviewToHost`
messages in [src/common/protocol.ts](../../src/common/protocol.ts) continue to
carry the plain `GanttDocument` and plain `Task` / `Milestone` / `Dependency`
records.

## 7. UX

None. This is an internal refactor of the host's computed model.

- **Timeline (ECharts):** unchanged — the webview keeps rendering from the plain
  `GanttDocument` and the string-returning `effectiveStart` / `effectiveEnd`
  helpers.
- **Sidebar tree:** unchanged — it continues to read the plain document from the
  store.
- **Edit form:** unchanged.

No new user-facing strings, so no localization impact.

## 8. Test Strategy

- **Unit (models/services):**
  - `hydrateDocument` builds a `DirectedGraph` with the expected node set, node
    `type` attributes, and dependency/`ownedBy` edges.
  - Node attributes mirror `TaskEntityProps` / `MilestoneEntityProps` / group
    fields; edge attributes expose `DependencyProps.type` via `ScheduleConstrain`.
  - `ownedBy` edges are excluded from scheduling-edge iteration and cycle checks.
  - Self-loop and parallel-edge rejection paths.
  - Free accessors (`effectiveStart` / `effectiveEnd` / `effectiveDuration`)
    return the same values as the current entity methods, including the
    `UnresolvableScheduleError` path for under-constrained tasks and the
    group/milestone placeholders.
  - `toDocument(hydrateDocument(doc))` byte-stable round-trip on
    [examples/sample.ganttee](../../examples/sample.ganttee).
  - `GanttModel` public accessors return the same data as before.
- **Integration (editor/controller):** the controller's reparse → hydrate →
  broadcast path still posts the plain document; adding/removing a dependency
  still round-trips through the document.
- **Webview interaction:** no change expected; existing chart/form tests must
  still pass (regression guard that nothing entity-shaped leaked into the wire).
- **Coverage:** branch coverage stays ≥ 90%; new branches (edge-kind filtering,
  self-loop/parallel rejection, node-type dispatch) are covered by the unit tests
  above.

## 9. Risks & Open Questions

🔴 High — [docs/requirements/graphology-integration.md](../requirements/graphology-integration.md)
"Tasks and milestones are nodes. Groups are **not**" — this directly contradicts
[in-memory-graph.md](../requirements/in-memory-graph.md) ("Tasks, milestones and
groups are vertices" + `ownedBy` edges) and the already-implemented `GroupEntity`
and Draft [scheduling-engine.md](./scheduling-engine.md) group rollup. **Decision:**
this spec follows `in-memory-graph.md` (groups **are** nodes with `ownedBy`
membership edges); the `graphology-integration.md` line must be corrected to
match.

🔴 High — `GanttModel`/entities public contract — replacing the `Schedulable`
method contract with free accessors is a behavioral refactor of an already
**Implemented** layer ([in-memory-oo-model.md](./in-memory-oo-model.md)). **Decision:**
preserve the `GanttModel` collection API and keep `effective*` results identical;
any direct callers of entity `effectiveStart()` methods (chiefly tests) migrate to
the free accessors in the same change.

🟡 Medium — Bundling — `graphology` lives under a layer (`services`/`common`) that
the browser webview may import, which could pull Graphology into `dist/webview.js`.
**Decision:** keep graph construction host-only; the webview must not import the
graph-backed `GanttModel` — verify with an Architecture Guard pass and a bundle-size
check.

🟡 Medium — Redundant group modeling — a `type: GROUP` node attribute and the
`ownedBy` edge both encode "this is a group / belongs to a group". **Treatment:**
document that `type` classifies the node and `ownedBy` encodes membership; groups
are excluded from determinacy/anchor rules but included in post-order rollup.

🟡 Medium — Dependencies — clarify what `graphology` dependencies are required.

🟢 Low — Duplicate graph logic — `dependencyGraphService` still hand-rolls cycle
detection/topological order on the plain `GanttDocument`. **Treatment:** out of
scope here; the Graph validation spec will migrate that logic onto the Graphology
graph.
