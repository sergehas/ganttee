# Feature: Gantt graph structure

## Summary

The purpose of this feature is an abstract in-memory representation of a Gantt
graph. It focuses on scheduling (date/duration) data. It does not affect other
attributes. It also defines the structure and constraints applicable to all task
kinds.

To segregate user-input schedule data (start date, end date, duration) from
computed data, the in-memory representation of Task, Milestone and Group exposes
accessors prefixed with `effective` (`effectiveStartDate`, `effectiveEndDate`,
`effectiveDate` — milestone only, `effectiveDuration`).

`effectiveDuration` is derived: it equals the user-defined `duration` when one is
set, otherwise it is computed as `effectiveEndDate − effectiveStartDate` (the
case where a task is defined by start date + end date).

## Entities definitions

### Dependency

Dependencies are constraints to apply. A dependency is a directed edge from a
`source` to a `target`. For each dependency type, exactly one endpoint is the
**owner** (the entity whose date the dependency constrains); the other is the
**anchor** (the referenced entity).

| Type         | Class   | Owner  | Anchor | Temporal constraint                                          |
| ------------ | ------- | ------ | ------ | ------------------------------------------------------------ |
| `startAfter` | direct  | target | source | `target.start ≥ source.end` (finish-to-start)                |
| `startWith`  | direct  | target | source | `target.start ≥ source.start` (start-to-start)               |
| `endWith`    | reverse | source | target | `source.end` aligned to `target.end` (finish-to-finish)      |
| `endBefore`  | reverse | source | target | `source.end ≤ target.start` (finish-to-start, reverse-owned) |

> Note (design): direct dependencies constrain the **target**, reverse
> dependencies constrain the **source**. This asymmetry is intentional but
> error-prone; see Open Questions.

`endWith` is renamed from `finishWith`; `endBefore` is renamed from `finishAfter`.

Groups cannot have dependencies (group dependency management may be implemented
later).

### Task

A task scheduling supports 3 kinds of constraint:

* **start date** — defined by exactly one of:
  * a user-defined static start date, or
  * one or more direct dependencies (`startWith`, `startAfter`); the effective
    start is the `max` across them.
* **duration** — a user-defined static duration (decimal number, in days). Only a
  static value; never dependency-defined.
* **end date** — defined by exactly one of:
  * a user-defined static end date, or
  * one or more reverse dependencies (`endWith`, `endBefore`); the effective end
    is the aggregate (`max` for `endWith`, `min` for `endBefore`) across them.

When defining a task, **exactly 2** of {start date, duration, end date} must be
set. Setting fewer than 2 (under-constrained) or more than 2 (hyperstatic) is
rejected.

### Milestone

A milestone is a specialization of a task. Key differences:

* `duration` is `0` (enforced, not editable).
* `startDate` and `endDate` are equal and exposed as the `date` property;
  references to `endDate`/`startDate` are aliases of `date`.

A milestone's schedule is defined by a single property, `date`, defined by exactly
one of:

* a user-defined static date, or
* one or more direct dependencies (`startWith`, `startAfter`); effective date is
  the `max` across them.

### Group

A group can contain multiple tasks, milestones or groups. Each task, milestone or
group belongs to 0 or 1 group.

A group has no static (user-defined) scheduling. It only exposes effective dates
and duration, computed by rolling up its descendants (see Group rollup). The
hyperstaticity/under-constraint rules do **not** apply to groups.

## In memory graph

The in-memory representation of a Gantt chart is a directed sparse graph. All
scheduling computations (effective start/end date, effective duration) are done
via graph traversal.

### Loading the graph

* Tasks, milestones and groups are vertices.
* Scheduling dependencies are edges, each with a type (`startAfter`, `startWith`,
  `endWith`, `endBefore`) as defined in [Dependency](#dependency).
* Group membership is an edge of type `ownedBy`: each task, milestone and group
  has 0 or 1 such edge; its target must be a group. `ownedBy` edges are excluded
  from cycle detection and from scheduling traversal.

### Temporal precedence normalization

For scheduling and cycle detection, each scheduling dependency is normalized to a
**precedence edge** `anchor ⟶ owner` (the anchor must be computed before the
owner):

* direct (`startAfter`, `startWith`): `source ⟶ target`
* reverse (`endWith`, `endBefore`): `target ⟶ source`

Cycle detection and topological ordering operate on this normalized precedence
graph, not on raw `source → target` edges.

### Cycle detection

A cycle exists when a path in the normalized precedence graph starts and ends at
the same vertex. Only scheduling dependencies are considered (not `ownedBy`).

This cycle detection must be triggered when:

* a dependency is added to a task or milestone: adding the dependency is rejected
  (with an error message);
* loading the graph: loading is cancelled (with an error message).

### Determinacy detection (hyperstaticity & under-constraint)

Each task and milestone must have **exactly 2** scheduling constraints among
{start date, duration, end date} (milestone: `duration = 0` fixed + `date`).

* More than 2 → **hyperstatic**, rejected.
* Fewer than 2 → **under-constrained**, rejected.
* Groups are exempt (no static constraints).

This detection must be triggered when:

* a task/milestone is authored: the change is rejected (with an error message);
* loading the graph: loading is cancelled (with an error message).

### Anchor requirement

Every connected component of the scheduling graph must contain at least one vertex
with an absolute (static) date (a static start date, end date, or milestone date).
A component with no absolute anchor cannot be scheduled and is rejected on load.

### Scheduling computation

#### Purpose

Compute the effective dates and duration (preparing data for graphical display).

#### Representation

Dates are handled internally as integer epoch-days for O(1) arithmetic; ISO date
strings are parsed once at load. Decimal-day durations follow the rounding policy
defined by the scheduling data-model specification.

#### Algorithm (topological constraint propagation)

The scheduling graph is guaranteed acyclic (cycle detection). Scheduling is a
single-pass longest/shortest-path relaxation over the normalized precedence DAG:

1. Build adjacency once. Detect connected components (union-find over scheduling
   edges) and verify the anchor requirement per component.
2. Compute a topological order of the normalized precedence DAG.
3. Seed static values: for each vertex with a static start/end/date, set the
   corresponding effective value.
4. Process vertices in topological order. For each vertex, resolve its constrained
   endpoint by aggregating all incoming constraints (see Setting effectivities),
   then compute the complementary endpoint from `effectiveDuration`.
5. After all tasks/milestones are scheduled, compute group effective dates by
   post-order rollup over the `ownedBy` tree.

Because vertices are processed only after all their precedence predecessors, a
single pass converges even when a vertex has multiple incoming constraints.

#### Setting effectivities

`effectiveDuration = duration` when user-set, else `effectiveEndDate −effectiveStartDate`.
 Milestones: `effectiveDuration = 0`,`effectiveStartDate = effectiveEndDate = effectiveDate`.

##### Direct dependencies (owner = target)

* `startAfter`: `target.effectiveStartDate = max(existing, source.effectiveEndDate)`;
  `target.effectiveEndDate = target.effectiveStartDate + effectiveDuration`.
* `startWith`: `target.effectiveStartDate = max(existing, source.effectiveStartDate)`;
  `target.effectiveEndDate = target.effectiveStartDate + effectiveDuration`.

##### Reverse dependencies (owner = source)

* `endWith`: `source.effectiveEndDate = max(existing, target.effectiveEndDate)`;
  `source.effectiveStartDate = source.effectiveEndDate − effectiveDuration`.
* `endBefore`: `source.effectiveEndDate = min(existing, target.effectiveStartDate)`;
  `source.effectiveStartDate = source.effectiveEndDate − effectiveDuration`.

#### Group rollup

For each group, in post-order over the `ownedBy` tree:
`effectiveStartDate = min` of descendants' `effectiveStartDate`;
`effectiveEndDate = max` of descendants' `effectiveEndDate`;
`effectiveDuration = effectiveEndDate − effectiveStartDate`.

## Open questions

* Should start/end aggregation stay asymmetric per type (`max` for start deps,
  `max`/`min` for end deps), and should we allow multiple end dependencies?
* Decimal-day duration rounding policy; is a working-day calendar out of scope for
  this phase?
* Should the direct/reverse owner asymmetry be normalized in storage so the owner
  role is consistent across all dependency kinds?
* Can a milestone be the target (anchor) of a reverse dependency?
