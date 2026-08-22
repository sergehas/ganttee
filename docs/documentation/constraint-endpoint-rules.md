# Constraint endpoint rules

## Purpose

A schedulable item is constrained by values that define its schedule and by
outgoing dependencies that constrain one of its endpoints. A warning is needed
when two constraints define the same endpoint, even when the item has only two
constraint records overall.

This document describes the functional rules for tasks and milestones. Incoming
dependencies are references used by another item and do not add a constraint to
the item being evaluated.

## Constraint ownership

The source of a dependency owns the constraint. The target supplies the date
used as the reference.

| Dependency type | Endpoint constrained on the source |
| --------------- | ---------------------------------- |
| `startAfter`    | Start                              |
| `startWith`     | Start                              |
| `endWith`       | End                                |

Multiple outgoing dependencies that constrain the same endpoint count as one
endpoint constraint for determinacy. A static value and an outgoing dependency
on the same endpoint are different constraints on one endpoint and produce an
over-constraint warning.

The type of an incoming dependency may be `startAfter`, `startWith`, or
`endWith`. It does not change the source item's result in the table below.

## Task rules

A task has three possible static constraints: start, duration, and end. A task
is determinate when it has exactly two constraints. Fewer than two is
under-constrained. More than two is over-constrained.

The table uses these outgoing dependency groups:

- **None**: no outgoing endpoint constraint.
- **Start**: one or more outgoing `startAfter` or `startWith` dependencies.
- **End**: one or more outgoing `endWith` dependencies.
- **Start + end**: at least one outgoing start constraint and at least one
  outgoing end constraint.

`Incoming: any` means that no incoming dependency, or any supported incoming
dependency type, gives the same result.

| Static constraints     | Outgoing    | Incoming | Result                                    |
| ---------------------- | ----------- | -------- | ----------------------------------------- |
| None                   | None        | Any      | Under-constrained                         |
| None                   | Start       | Any      | Under-constrained                         |
| None                   | End         | Any      | Under-constrained                         |
| None                   | Start + end | Any      | Determinate                               |
| Start                  | None        | Any      | Under-constrained                         |
| Start                  | Start       | Any      | Over-constrained: duplicate start         |
| Start                  | End         | Any      | Determinate                               |
| Start                  | Start + end | Any      | Over-constrained: duplicate start         |
| Duration               | None        | Any      | Under-constrained                         |
| Duration               | Start       | Any      | Determinate                               |
| Duration               | End         | Any      | Determinate                               |
| Duration               | Start + end | Any      | Over-constrained                          |
| End                    | None        | Any      | Under-constrained                         |
| End                    | Start       | Any      | Determinate                               |
| End                    | End         | Any      | Over-constrained: duplicate end           |
| End                    | Start + end | Any      | Over-constrained: duplicate end           |
| Start + duration       | None        | Any      | Determinate                               |
| Start + duration       | Start       | Any      | Over-constrained: duplicate start         |
| Start + duration       | End         | Any      | Over-constrained                          |
| Start + duration       | Start + end | Any      | Over-constrained: duplicate start         |
| Start + end            | None        | Any      | Determinate                               |
| Start + end            | Start       | Any      | Over-constrained: duplicate start         |
| Start + end            | End         | Any      | Over-constrained: duplicate end           |
| Start + end            | Start + end | Any      | Over-constrained: duplicate start and end |
| Duration + end         | None        | Any      | Determinate                               |
| Duration + end         | Start       | Any      | Over-constrained                          |
| Duration + end         | End         | Any      | Over-constrained: duplicate end           |
| Duration + end         | Start + end | Any      | Over-constrained: duplicate end           |
| Start + duration + end | None        | Any      | Over-constrained                          |
| Start + duration + end | Start       | Any      | Over-constrained: duplicate start         |
| Start + duration + end | End         | Any      | Over-constrained: duplicate end           |
| Start + duration + end | Start + end | Any      | Over-constrained: duplicate start and end |

A duplicate endpoint is always an over-constraint warning. It is not cancelled
by the fact that the total number of constraints is otherwise two.

A duplicate endpoint is a validation warning, not a persistence blocker. The
edit may be saved so that the scheduling engine can resolve the conflict. This
exception applies to duplicate task start or end constraints and to duplicate
milestone date constraints. It does not apply to an under-constrained item or
to an ordinary over-constrained item with more than two independent
constraints.

## Invalid dependency and component handling

Group dependency endpoints, dangling dependency references, and unanchored
components are invalid inputs for the scheduling model. They are not resolved
as scheduling conflicts.

When an existing document is opened, each invalid dependency or component
raises a warning through the standard warning diagnostic. The application then
performs an atomic automatic edit on the source document:

- a group dependency endpoint is removed;
- a dangling dependency reference is removed;
- an unanchored component and its dependencies are removed.

The rewritten document is the source of truth. The in-memory model is built
only after this rewrite and therefore contains none of the removed invalid
dependencies or components.

An edit that would create or preserve a group dependency endpoint, a dangling
dependency reference, or an unanchored component is blocked before it is
persisted. Duplicate endpoint and date conflicts remain warning-only because
they can be resolved by the scheduling engine.

## Editing behavior

The edit form evaluates blocking errors and warnings independently. A warning
does not make an otherwise invalid edit saveable.

| Validation state                                | User feedback              | Save result |
| ----------------------------------------------- | -------------------------- | ----------- |
| No warning or error                             | None                       | Allowed     |
| Duplicate endpoint or milestone date only       | Warning                    | Allowed     |
| Under-constrained item                          | Blocking error             | Blocked     |
| Ordinary over-constrained item                  | Blocking error             | Blocked     |
| Duplicate warning plus under-constraint         | Warning and blocking error | Blocked     |
| Duplicate warning plus ordinary over-constraint | Warning and blocking error | Blocked     |

When an item has both a duplicate warning and a blocking error, the form shows
both diagnostics and the blocking error determines the save result.

## Milestone rules

A milestone has one optional canonical static value: `date`.[^milestone-date]
The date represents both its start and its end. Its duration is always zero and
is not an independent editable constraint. When `date` is absent, it may be
inferred from outgoing dependencies.

An outgoing start dependency (`startAfter` or `startWith`) constrains the
milestone's date as a start. An outgoing `endWith` dependency constrains the
same date as an end. Because the milestone date is both endpoints, either type
duplicates the static date and produces an over-constraint warning.

A milestone may be the source of `endWith`.[^milestone-endwith] This is useful
when the milestone's date must follow the end of another item; the date remains
the single value used for both milestone endpoints.

| Static constraint | Outgoing    | Incoming | Result                           |
| ----------------- | ----------- | -------- | -------------------------------- |
| Date              | None        | Any      | Determinate                      |
| Date              | Start       | Any      | Over-constrained: duplicate date |
| Date              | End         | Any      | Over-constrained: duplicate date |
| Date              | Start + end | Any      | Over-constrained: duplicate date |
| None              | None        | Any      | Under-constrained                |
| None              | Start       | Any      | Determinate                      |
| None              | End         | Any      | Determinate                      |
| None              | Start + end | Any      | Over-constrained                 |

The type of an incoming dependency does not affect the milestone's own result.
A milestone can still provide its date as the target reference for another
item's outgoing dependency.

## Diagnostic meaning

Under-constrained means that the item does not have enough independent schedule
information to determine its dates. Over-constrained means either that it has
more than the allowed number of constraints or that two constraints define the
same endpoint.

The duplicate-endpoint rule is therefore distinct from simple endpoint
substitution. An outgoing dependency does not replace an existing static start
or end value; it adds another constraint on that endpoint and must be reported.

## Scheduling engine behavior

Semantic validation remains advisory: an over-constrained or under-constrained
item may still reach the scheduling engine. The engine must apply deterministic
fallback rules so that warnings do not prevent a schedule from being produced.

For an over-constrained task or milestone, dependency constraints always take
precedence over conflicting static values. The precedence is endpoint-specific:

- outgoing start dependencies override a static `start`;
- outgoing end dependencies override a static `end`;
- for a milestone, outgoing dependencies override its static `date`, because
  `date` represents both start and end;
- a static task `duration` remains active unless duration is missing.

When multiple dependencies constrain the same effective endpoint, the engine
uses the greatest date inferred by those dependencies. This is an intentional
latest-constraint-wins policy for both effective start and effective end,
including multiple `endWith` dependencies. Processing order must not change the
result.

For a task without a static duration, the engine first infers duration from
its effective start and effective end when both are available. If duration
cannot be inferred, the task remains under-constrained and the warning remains
visible because the source document still lacks a duration. For scheduling only,
the engine must then use a default duration of `1`; this fallback is not
persisted as a task value.

[^milestone-date]:
    Milestone `date` is currently required by the persisted model,
    but it must be made optional so that the scheduling engine can infer it from
    dependencies.

[^milestone-endwith]:
    The current restriction preventing a milestone from being
    the source of `endWith` is unnecessary and must be removed.
