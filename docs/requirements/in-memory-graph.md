# Feature: Gantt graph structure

## summary

the purpose of this feature is to abstract in memory representation of a Gantt graph.
It focuses on scheduling (date/duration) data.
It does not affect other attributes

It also defined the structure & constrain applicable to all task kind.

To Segregate user input schedule data (end/start date, duration -immutable a computation time-) from computed data, in memory representation of Task, Milestone and group expose accessors prefixed with 'effective' (effectiveEndDate, effectiveStartDate, effectiveDate -for milestone only-, effectiveDuration)

## Entities definitions

### dependency

Dependencies are constrains to apply. "DependencyType" are:

* "startAfter": target starts when source ends (end-to-start). This is a **direct** constrain.
* "startWith": target starts when source starts (start-to-start). This is a **direct** constrain.
* "endWith" (to be renamed from "finishWith"): target ends when target ends (end-to-end). This is a **reverse** constrain.
* "endBefore" (to be renamed from "finishAfter"): target ends when target starts (start-to-end). This is a **reverse** constrain.

Group cannot have dependency (NB: group dependency management feature may be implemented later)

### Task

a task scheduling support 3 types of constrain:

* start date
  It can be defined by one (exactly) of the two:
  * defined by a user defined static start date
  * defined by one or more dependency ("startWith", "startAfter")
* duration (new)
  * defined by a user defined static duration (decimal number, in days)
* end date
  It can be defined by one (exactly) of the two:
  * defined by a user defined static end date
  * defined by one one dependency ("endWith", "endBefore")

When defining a task, exactly 2 constrains must be set among start date, duration, end date

### Milestone

A milestone is a specialization of a task.
The Key difference are :

* duration is 0 (enforced, not editable/modifiable)
* "startDate" and "endDate" are the same (and exposed as `date` property): any references to "endDate" or  "startDate" are aliases to `date`

So a milestone scheduling is end user define by a single property:

* date
  It can be defined by one (exotically) of the two:
  * defined by a user defined static date
  * defined by one or more dependency ("startWith", "startAfter")

### Group

A group can contains multiple tasks, milestones or groups.

tasks, milestones or groups belong to 0 or 1 group.

A group has no static (user defined) scheduling date. It only exposes 'effective' dates and duration

## In memory graph

The in memory representation of a gantt char is a directed (sparse) graph.
All scheduling computation (effective end/start date, effective duration computation) are done via graph traversal algorithms.

### loading the graph

When creating the in memory graph :

* tasks, milestones and groups are vertices
* scheduling dependency are edges
  * each dependency has a type:
    * `startAfter`: target starts after the source finishes (end-to-start)
    * `startWith`: target starts when the source starts (start-to-start)
    * `endWith`: target finishes when the source finishes. (end-to-end)
    * `endBefore`: target finishes when the source finishes. (end-to-start)
* group belonging are edges of type "ownedBy: task, milestone and group have 0 or 1 edge of this type. Target must be a group.

### cycle detection

A cycle is detected when a path starts and ends at the same vertex, following the direction of edges.
Only "scheduling dependency" are considered. (so not ownBy dependencies).

This cycle detection must be triggered when:

* a dependency is added to a task or milestone: adding the dependency is rejected (with a error message)
* loading the graph: loading is canceled (with a error message)

### "hyperstaticity" detection

hyperstaticity happens when a task, milestone or group have more than 2 scheduling constrains defined. see [Entities definitions](#entities-definitions) for rules on constrains.

This hyperstaticity detection must be triggered when:

* a task/milestone/group is authored: adding the authored is rejected (with a error message)
* loading the graph: loading is canceled (with a error message)

### Scheduling computation

#### purpose

 compute the effective dates and duration (preparing data for graphical display)

#### principle

the approach is to start with the 'earliest' task then to compute scheduling by following the dependencies. Of course, some tasks may be then scheduled before this 'earliest task'.

1. 1st step is to detect subgraphs if any
2. scheduling each subgraphs (or the 'only' graph if no subgraph):
   1. pivot task / milestone: find (and tag as 'pivot') the task/milestone with the earliest 'start date'. it can be
      * the task (wtr milestone) with the earliest `startDate`
      * the task with the earliest `endDate` - `duration`
   2. from that pivot task, start exploring the graph in both direction (BFS algo)
      1. forward: dependencies where the target is the current task/milestone ("startWith", "startAfter"). On each task, set set effective start/end date & effective duration (detail bellow) for each task/milestone
      2. backward: dependencies where the source is the current task/milestone ("endWith", "endBefore"). On each task, set set effective start/end date & effective duration (detail bellow) for each task/milestone

A the end (when alo is applied to all subgraph), all vertices should have been explored (and scheduled)at least once.

#### Setting effectivities

By definition,  tasks & milestones a duration has always been defined. So `effectiveDuration` is an alias to `duration`

##### when a task is the target of a dependency (forward traversal, direct dependencies)

* dependency type is 'startAfter': target `effectiveStartDate` is set to the max of target `effectiveStartDate` (if already set) and the dependency source `effectiveEndDate`. The current task's `effectiveEndDate` is set to `effectiveStartDate` + `duration`.
* dependency type is 'startWith': target `effectiveStartDate` is set to the max of target `effectiveStartDate` (if already set) and the dependency source `effectiveStartDate`. The current task's `effectiveEndDate` is set to `effectiveStartDate` + `duration`.

##### when a task is the source of a dependency (backward traversal, reverse dependencies)

Important: computing effective dates on this traversal applies **only** to tasks/milestones not visited/scheduled during the forward traversal.

* dependency type is 'endWith': source `effectiveEndDate` is set to the max of `effectiveEndDate` (if already set) and the dependency target `effectiveEndDate`. The current task's `effectiveStartDate` is set to `effectiveEndDate` - `duration`.
* dependency type is 'endBefore': `effectiveEndDate` is set to the min of `effectiveEndDate` (if already set) and the dependency source `effectiveStartDate`. The current task's `effectiveStartDate` is set to `effectiveEndDate` - `duration`.
