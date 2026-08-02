---
Status: Reviewed
Owner: Tech Lead
Last updated: 2026-08-02
---

# Feature: DAG backbone

![Status: Reviewed](https://img.shields.io/badge/status-Reviewed-0D6EFD?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The host-side in-memory model (`GanttModel` in
[src/common/models/entities.ts](../../src/common/models/entities.ts)) currently
stores dependencies as a plain array with no structural invariants. Every
scheduling and validation concern that follows (graph validation, the scheduling
engine) needs cycle detection, topological ordering, connected-component
enumeration, and predecessor/successor queries on that dependency set. This
feature introduces a `DependencyGraph` class in
[src/common/models/](../../src/common/models/) that provides a typed,
zero-external-dependency DAG implementation over the existing
`Dependency` records, asserting structural acyclicity at hydration time.

The entity classes (`TaskEntity` / `MilestoneEntity` / `GroupEntity`) and the
`Schedulable` contract are **unchanged**. Group membership stays encoded as
the existing `groupId` field on each entity — no edge model is introduced for
containment. `hydrateDocument` builds a `DependencyGraph` and stores it inside
`GanttModel`; it throws on a self-loop, a parallel edge, or a directed cycle.
The `DependencyGraph` algorithms are refactored out of
[src/services/dependencyGraphService.ts](../../src/services/dependencyGraphService.ts),
which continues to exist as a thin adapter for the plain-document validation path
until the [Graph validation](./graph-validation.md) spec migrates it. There is
**no** `.ganttee` schema, disk-format, host↔webview protocol, or `package.json`
change — this is a pure host-in-memory refactor.

## 2. Goals / Non-goals

### Goals

- Introduce a `DependencyGraph` class in `src/common/models/` (browser-safe, no
  `vscode` imports) providing: `hasCycle()`, `findCycle()`,
  `wouldCreateCycle(candidate)`, `topologicalSort()`, `connectedComponents()`,
  `successors(id)`, and `predecessors(id)`.
- Implement the algorithms in `DependencyGraph` by refactoring the DFS cycle
  detection and Kahn's topological-sort already in
  [src/services/dependencyGraphService.ts](../../src/services/dependencyGraphService.ts)
  — no new external libraries.
- Build a `DependencyGraph` in `hydrateDocument` and store it on `GanttModel` as
  a new read-only `graph` property, so validation and scheduling specs can
  traverse it directly.
- **Assert structural acyclicity at hydration:** `hydrateDocument` throws when a
  dependency is a self-loop (`sourceId === targetId`), a parallel edge (same
  `sourceId`/`targetId` pair with a different id), or would close a directed
  cycle, so a hydrated `GanttModel` is always a DAG.
- Accept a **disconnected** graph: the dependency set may form several
  weakly-connected components (a forest); no connectivity is required.
- Preserve the existing public surface of `GanttModel` (`tasks`, `milestones`,
  `groups`, `dependencies`, `version`, `settings`) — existing consumers compile
  and behave unchanged.

### Non-goals

- **No external graph library in this phase.** `graphology` and its companion
  packages are not introduced here. The backbone algorithms (DFS, Kahn's,
  union-find) are simple enough that the hand-rolled adjacency-list
  implementation is defensible. Graphology adoption is explicitly planned for
  the [Scheduling engine](./scheduling-engine.md) spec, where it wraps
  `DependencyGraph` internally — see Resolved decisions.
- **No entity-class changes.** `TaskEntity`, `MilestoneEntity`, `GroupEntity`,
  and the `Schedulable` interface are untouched.
- **No group-membership edges.** `groupId` remains a plain field on each entity;
  `DependencyGraph` contains only scheduling-dependency edges.
- **No scheduling computation.** Constraint propagation is owned by the
  [Scheduling engine](./scheduling-engine.md) spec.
- **No semantic validation rules.** Determinacy, anchor-per-component, and
  normalized-precedence cycle detection are owned by the
  [Graph validation](./graph-validation.md) spec. This feature only guarantees
  the **structural** DAG substrate (self-loop / parallel-edge /
  raw-directed-cycle rejection) that the validator will traverse.
- **No `.ganttee` schema change** and **no `CURRENT_DOCUMENT_VERSION` bump.**
- **No protocol change.** The webview and sidebar keep consuming the plain
  `GanttDocument`.
- **No removal of `dependencyGraphService.ts`.** It stays as-is; this spec only
  extracts its core algorithms into `DependencyGraph` and calls through to them.
- **Dangling-reference check stays task-scoped.** `dependencyGraphService.validateGraph`
  computes dangling references against `document.tasks` only; that check is not
  routed through `DependencyGraph` (whose node set also includes milestones and
  groups). Only cycle detection and topological ordering delegate to `DependencyGraph`
  internally.
  - **Dangling-reference check**: `dependencyGraphService.validateGraph` must computes dangling references against `document.tasks` + `document.milestones`

## 3. User Stories

- As a **Ganttee maintainer**, I want `GanttModel` to carry a `DependencyGraph`
  with proven DAG invariants, so that graph validation and scheduling can reuse
  its traversal helpers instead of rebuilding adjacency state independently.
- As a **feature developer** building the scheduling engine, I want
  `model.graph.topologicalSort()` and `model.graph.predecessors(id)` available
  on the hydrated model, so that I can implement constraint propagation without
  constructing my own adjacency structure.
- As a **consumer of `GanttModel`** (the hydrator and editor controller), I want
  all existing properties unchanged, so that adding `DependencyGraph` requires
  no edits on my side.

## 4. Acceptance Criteria

- Given a valid `GanttDocument` with tasks and dependencies
  When `hydrateDocument(document)` runs
  Then the returned `GanttModel` exposes a `graph` property that is a
  `DependencyGraph` whose node set equals the union of all task, milestone, and
  group ids, and whose edges correspond exactly to the document's
  `dependencies` array.

- Given a hydrated `GanttModel`
  When `model.graph.topologicalSort()` is called
  Then it returns all node ids in a valid execution order (predecessors before
  successors), consistent with the dependency edges, covering every entity id
  exactly once.

- Given a hydrated `GanttModel`
  When `model.graph.successors(id)` and `model.graph.predecessors(id)` are
  called for a node that has outgoing and incoming dependency edges
  Then they return the correct adjacent node ids.

- Given a hydrated `GanttModel`
  When `model.graph.connectedComponents()` is called on a document whose
  entities form several disconnected subsets
  Then it returns one array of ids per weakly-connected component, covering
  every node exactly once.

- Given a dependency whose `sourceId === targetId`
  When `hydrateDocument` runs
  Then hydration throws a typed error identifying the self-loop, and no
  `GanttModel` is returned.

- Given two dependencies that share the same `sourceId` and `targetId` (parallel
  edge)
  When `hydrateDocument` runs
  Then hydration throws a typed error identifying the duplicate pair, and no
  `GanttModel` is returned.

- Given a set of dependencies whose directed edges close a cycle
  When `hydrateDocument` runs
  Then hydration throws a typed cycle error carrying the participating node ids,
  so a successfully hydrated `GanttModel` is always a DAG.

- Given a `GanttDocument` whose entities form several disconnected groups
  When `hydrateDocument` runs
  Then hydration succeeds; no connectivity between components is required.

- Given a candidate `Dependency` not yet in the document
  When `model.graph.wouldCreateCycle(candidate)` is called
  Then it returns `true` if and only if adding the candidate would close a cycle,
  without mutating the graph.

- Given a hydrated `GanttModel`
  When `model.tasks`, `model.milestones`, `model.groups`, `model.dependencies`,
  `model.version`, and `model.settings` are read
  Then they return the same values as before this feature was introduced, so
  existing consumers compile and behave unchanged.

- Given a hydrated `GanttModel`
  When `toDocument(model)` runs
  Then the produced `GanttDocument` is byte-stable and round-trips identically
  to the pre-feature implementation (field order and ISO formatting preserved).

## 5. Domain & Data Model Impact

### New: `DependencyGraph` in `src/common/models/`

A new file `src/common/models/dependencyGraph.ts`, re-exported from
`models/index.ts`, provides the class. It is browser-safe (no `vscode` or
Node imports) so it can later be imported by the webview for pre-flight
validation without a separate bundle entry.

```ts
/**
 * Immutable directed acyclic graph over a set of node ids and typed
 * dependency edges. Constructed once per hydration; all mutation is
 * done through `hydrateDocument`.
 */
export class DependencyGraph {
  /** @param nodeIds All schedulable entity ids (tasks + milestones + groups). */
  /** @param dependencies The validated dependency records. */
  constructor(nodeIds: readonly string[], dependencies: readonly Dependency[]);

  /**
   * Returns `true` if the dependency set contains a directed cycle.
   * Always returns `false` on a successfully hydrated `GanttModel.graph`;
   * useful on intermediate graphs inside the service adapter.
   */
  hasCycle(): boolean;

  /**
   * Returns the node ids that participate in a directed cycle, or an empty
   * array when the graph is acyclic.
   * Always returns `[]` on a successfully hydrated `GanttModel.graph`;
   * useful on intermediate graphs inside the service adapter.
   */
  findCycle(): readonly string[];

  /**
   * Returns `true` if adding `candidate` to the current edges would create
   * a directed cycle. Does not mutate the graph.
   */
  wouldCreateCycle(candidate: Dependency): boolean;

  /**
   * Returns all node ids in topological order (predecessors before
   * successors).
   * @throws {Error} When the graph contains a cycle.
   */
  topologicalSort(): readonly string[];

  /**
   * Returns one array of node ids per weakly-connected component.
   * Isolated nodes appear as single-element arrays.
   */
  connectedComponents(): readonly (readonly string[])[];

  /** Returns the ids of nodes that `id` depends on (incoming edges). */
  predecessors(id: string): readonly string[];

  /** Returns the ids of nodes that depend on `id` (outgoing edges). */
  successors(id: string): readonly string[];
}
```

The algorithms are refactored from
[src/services/dependencyGraphService.ts](../../src/services/dependencyGraphService.ts):

- `findCycle` / `hasCycle` / `wouldCreateCycle` — DFS-based, O(V+E).
- `topologicalSort` — Kahn's algorithm (already implemented in
  `dependencyGraphService`), extended to include milestone and group ids as
  isolated nodes when they carry no dependency edges.
- `connectedComponents` — union-find or DFS over the undirected adjacency
  induced by the dependency edges, covering all node ids (including isolated
  ones).
- `predecessors` / `successors` — adjacency-list lookup, O(1) after construction.

### Changed: `GanttModel`

A new read-only `graph` property is added to the existing `GanttModel` class in
[src/common/models/entities.ts](../../src/common/models/entities.ts):

```ts
/** The structural DAG over all entity ids and scheduling dependencies. */
readonly graph: DependencyGraph;
```

The constructor gains a `graph` parameter; all other constructor parameters and
properties are unchanged.

### Changed: `hydrateDocument`

[src/services/ganttModelService.ts](../../src/services/ganttModelService.ts)
builds the `DependencyGraph` after constructing the entity arrays. The
structural invariants are checked here — before the `GanttModel` is returned —
so an invalid document never produces a `GanttModel`:

1. Collect all entity ids (tasks + milestones + groups).
2. Scan all dependencies with a plain `Set`: reject any self-loop
   (`sourceId === targetId`) and any parallel edge (same `sourceId`/`targetId`
   pair already seen).
3. Build the full adjacency list from the surviving dependencies; call `hasCycle()`
   once and `findCycle()` to obtain the participating ids for
   `CyclicDependencyError`.
4. Construct `new DependencyGraph(entityIds, validatedDependencies)`.
5. Pass the `DependencyGraph` instance to `new GanttModel(...)`.

`toDocument` is unchanged — it serializes from the existing entity arrays and
the plain `dependencies` list; the `graph` property is not serialized.

`.ganttee` schema: **unchanged.** `CURRENT_DOCUMENT_VERSION` stays at `2`; no
migration step.

### New typed errors

```ts
/** Thrown when a dependency would create a self-loop. */
export class SelfLoopDependencyError extends Error {
  constructor(public readonly dependencyId: string) { … }
}

/** Thrown when two dependencies share the same sourceId/targetId pair. */
export class ParallelEdgeDependencyError extends Error {
  constructor(
    public readonly sourceId: string,
    public readonly targetId: string,
  ) { … }
}

/** Thrown when the dependency set contains a directed cycle. */
export class CyclicDependencyError extends Error {
  constructor(public readonly cycle: readonly string[]) { … }
}
```

These are defined in `src/common/models/dependencyGraph.ts` and re-exported
from `models/index.ts`, so they can be caught by both the host and a future
webview pre-flight validator.

### No `package.json` changes

No new runtime or dev dependencies are added. All algorithms are implemented in
TypeScript within the existing source tree.

## 6. Protocol Impact

None. `DependencyGraph` is host-in-memory only and never crosses the webview
boundary. All `HostToWebview` / `WebviewToHost` messages in
[src/common/protocol.ts](../../src/common/protocol.ts) continue to carry the
plain `GanttDocument` and plain entity records.

## 7. UX

None. This is an internal refactor of the host's computed model.

- **Timeline (ECharts):** unchanged.
- **Sidebar tree:** unchanged.
- **Edit form:** unchanged.

No new user-facing strings; no localization impact.

## 8. Test Strategy

- **Unit — `DependencyGraph` (new suite in
  [src/test/dependencyGraph.test.ts](../../src/test/dependencyGraph.test.ts)):**
  - `hasCycle()` returns `false` for an acyclic set and `true` for a cyclic one.
  - `findCycle()` returns the participating ids for a cyclic set and `[]` for
    an acyclic one.
  - `wouldCreateCycle(candidate)` returns `true` when the candidate closes a
    cycle and `false` when it does not, without mutating the graph.
  - `topologicalSort()` returns all node ids in a valid order for an acyclic
    set, including isolated nodes (no dependency edges); throws when the graph
    has a cycle.
  - `connectedComponents()` returns one component per disconnected subset and
    single-element arrays for isolated nodes.
  - `predecessors(id)` / `successors(id)` return the correct adjacent ids.
  - Self-loop detection: a dependency with `sourceId === targetId` is treated as
    a cycle by `hasCycle()` / `findCycle()`.

- **Unit — hydration invariants (existing
  [ganttModelService.test.ts](../../src/test/ganttModelService.test.ts),
  extended):**
  - `hydrateDocument` throws `SelfLoopDependencyError` for a self-loop
    dependency.
  - `hydrateDocument` throws `ParallelEdgeDependencyError` for two dependencies
    sharing the same `sourceId`/`targetId` pair.
  - `hydrateDocument` throws `CyclicDependencyError` (carrying the cycle ids)
    for a dependency set that closes a cycle.
  - `hydrateDocument` succeeds and sets `model.graph` for a valid document with
    disconnected components.
  - `model.graph.topologicalSort()` on a freshly hydrated model returns all
    entity ids in a valid order.
  - `toDocument(hydrateDocument(doc))` byte-stable round-trip on
    [examples/sample.ganttee](../../examples/sample.ganttee).
  - All existing entity-method, collection-surface, and round-trip assertions
    continue to pass unchanged.

- **Integration (editor/controller):** the controller's reparse → hydrate →
  broadcast path still posts the plain document; adding / removing a dependency
  still round-trips through the document.
- **Webview interaction:** no change expected; existing chart / form tests must
  still pass.
- **`dependencyGraphService.test.ts`:** existing assertions pass unchanged;
  they cover the public API, which is preserved.
- **Coverage:** branch coverage stays ≥ 90%; new branches (self-loop /
  parallel-edge / cycle rejection, isolated-node handling in `topologicalSort`
  and `connectedComponents`, `wouldCreateCycle` true/false paths) are covered
  by the unit tests above.

## 9. Risks & Open Questions

🟡 Medium — Structural vs. semantic acyclicity — `hydrateDocument` guarantees the
**structural** DAG substrate: it rejects self-loops, parallel edges, and raw
`source → target` directed cycles on the **literal** dependency edges.
Semantic cycle detection over the **normalized-precedence** graph (where reverse
dependencies such as `endWith` are re-oriented `target → source`) remains owned
by the [Graph validation](./graph-validation.md) spec. **Treatment:** document
this boundary explicitly so a reverse-dependency cycle that only appears after
normalization is not mistaken for a backbone regression.

🟢 Low — `dependencyGraphService` duplication — the service's `findCycle`,
`wouldCreateCycle`, and `topologicalOrder` free functions will share logic with
`DependencyGraph` once this feature lands. **Treatment:** `dependencyGraphService`
delegates to `DependencyGraph` internally in this change, eliminating the
duplication; its public API (used by the plain-document validation path) is
preserved unchanged.

🟢 Low — Graphology deferred to the scheduling engine — the backbone algorithms
(DFS, Kahn's, union-find) are simple enough to hand-roll; adopting Graphology
here would add bundle weight and a new dependency before any concrete consumer
justifies it. The scheduling engine spec is the inflection point: it needs
critical-path / longest-path on a weighted DAG and normalized-precedence
subgraph construction — both non-trivial to implement correctly from scratch.
**Treatment:** the scheduling engine spec adopts Graphology and re-implements
`DependencyGraph` internals against it; the public surface of `DependencyGraph`
is unchanged so no callers are affected.

### Resolved decisions

- **Graphology deferred to the scheduling engine, not rejected.** The backbone
  algorithms (DFS, Kahn's, union-find) are already implemented and tested in
  `dependencyGraphService.ts`; hand-rolling them here costs nothing new and adds
  zero dependencies. Every `DependencyGraph` method (`hasCycle`, `findCycle`,
  `wouldCreateCycle`, `topologicalSort`, `connectedComponents`,
  `predecessors`/`successors`) has a direct equivalent in `graphology-dag` and
  `graphology-components`, but adopting the library for these five methods alone
  would trade ~80 lines of already-working code for a 50–80 KB bundle addition
  and an ongoing maintenance dependency. The inflection point is the scheduling
  engine: critical-path computation on a weighted DAG and normalized-precedence
  subgraph construction are genuinely hard to hand-roll correctly, and
  `graphology-shortest-path` covers both. At that point `DependencyGraph`
  re-implements its internals against Graphology without changing its public
  surface — existing callers are unaffected.
- **Entity classes kept.** `TaskEntity` / `MilestoneEntity` / `GroupEntity` and
  `Schedulable` are unchanged; the complexity of replacing them with attribute
  unions was not justified.
- **`groupId` stays a field.** Group membership is not encoded as graph edges;
  keeping `groupId` as a plain field avoids mixed-edge semantics and the
  O(N) edge-scan serialization that encoding it as `OWNED_BY` edges would require.
- **`DependencyGraph` lives in `common/models/`.** It is browser-safe and
  shared with a future webview pre-flight validator
  ([UI-integration.md](../requirements/UI-integration.md)) without a separate
  bundle entry.
- **DAG asserted at hydration.** `hydrateDocument` throws on a self-loop,
  parallel edge, or directed cycle; a successfully returned `GanttModel` is
  always a DAG. It may still be a disconnected forest.
