# Graphology as backbone for in memory graph

## Goal

Relies on a optimized graph (DAG) library to hydrate a in memory representation of the GanttGraph.

Allows usage of optimized Graphology libraries from graph manipulation, more specifically use [DAG](https://graphology.github.io/standard-library/dag) and [traversal](https://graphology.github.io/standard-library/traversal)

use [Graphology](https://graphology.github.io/) for graph structure.

## dependencies

- `graphology-traversal`
- `graphology-dag`
- suggest any other `graphology` library if needed
  - other libraries listed in [standard library](https://graphology.github.io/standard-library/#standard-library) may be useful
- Rendering & file format specialized libraries (`canvas`, `gexf`, `graphml`, `svg`...) must not be used (no rendering / import-export feature in the service layer)

## Implementation

This implementation replaces actual `GanttModel` implementation (inc. `TaskEntity`, `MilestoneEntity` classes).

## Graph Model

Options: graph is a DAG :

- directed
- self loops not allowed
- parallel edge not allowed

Graph attributes contains :

- (list of) groups
- settings

### nodes & edges

> **Correction (2026-07-31):** This bullet originally read "Tasks and milestones
> are nodes. Groups are **not**", which contradicts
> [in-memory-graph.md](./in-memory-graph.md) (tasks, milestones **and** groups are
> vertices, joined by `ownedBy` membership edges), the implemented `GroupEntity`,
> and the group rollup in the scheduling-engine spec. Per the tech-lead decision,
> the [Graphology graph backbone spec](../specs/graphology-graph-backbone.md)
> follows `in-memory-graph.md`: **groups are nodes** with `ownedBy` edges.

- Tasks, milestones and groups are nodes; group membership is an `ownedBy` edge
  (excluded from scheduling traversal and cycle detection).
  - Nodes extra attributes correspond to `TaskEntityProps` + `MilestoneEntityProps` (group nodes carry the group fields)
  - to segregate node kinds, add an attribute `type` whose value is an `enum`: `TASK`, `MILESTONE`, `GROUP`
  - `effectiveEnd`, `effectiveStart` and `effectiveDuration` are also materialized node's attributes. Apply already defined business rule to initialize them. Definitive computation rules deferred in the scheduling-engine spec.
- dependencies are edges
  - Edge extra attributes are `type:DependencyType` (from `Dependency` interface). Create a `DependencyProps` interface to reflect it.

Ideally

- Nodes should implement interfaces `BaseTask`, `Schedulable` (if possible)
- Edge should implement a new interface `ScheduleConstrain` exposing a `getType():DependencyType` method

## Impact

- no impact expected in document structure
- impacts on GUI to be confirmed

## Roadmap

the derived spec must be inserted in roadmap before 'Graph validation' spec
