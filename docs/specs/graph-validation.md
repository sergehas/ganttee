---
Status: Implementing
Owner: Copilot
Last updated: 2026-08-15
---

# Feature: Scheduling Graph Validation (cycle, determinacy, anchor, dangling)

![Status: Implementing](https://img.shields.io/badge/status-Implementing-F59F00?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Add the **semantic** layer of scheduling-graph validation on top of the
**structural** DAG guarantees the DAG-backbone feature already enforces at
hydration. Structural failures (self-loop, parallel edge, directed cycle) are
already hard errors thrown by `hydrateDocument`; this feature adds the rules that
cannot be expressed structurally: per-item determinacy (exactly 2 constraints,
counting both static fields and dependency-supplied endpoints),
dangling references, and an absolute date anchor per schedulable component.
Semantic results are **advisory** — they
are reported on the hydrated model, never thrown — so an invalid document still
opens and can be repaired in the editor.

### Failure model

This is the decision that governs every acceptance criterion below.

| Rule                                                  | Class      | Behavior                                                  |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------- |
| Self-loop, parallel edge, directed cycle              | Structural | **Blocking** — thrown at hydration (already implemented). |
| Under-/over-constrained item                          | Semantic   | Advisory — reported, document still opens.                |
| Group as either endpoint of a dependency              | Semantic   | Advisory — reported, document still opens.                |
| Dangling source/target reference                      | Semantic   | Advisory — reported, document still opens.                |
| Component with no absolute date anchor                | Semantic   | Advisory — reported, document still opens.                |

The one _preventive_ path is add-dependency: a candidate that would close a cycle
is rejected before the `WorkspaceEdit` is applied (already implemented).

Task and milestone deletion is also structural maintenance, not semantic
validation: it creates one replacement document that removes every dependency
touching the deleted id so no dangling edge is persisted. Before removing an
incoming `startWith` or `endWith` dependency, it materializes the deleted
anchor's effective start or end on the surviving source task when that endpoint
can be resolved.

## 2. Goals / Non-goals

### Goals

- Compute a semantic validation result over the hydrated `GanttModel` and its
  `DependencyGraph`.
- Determinacy check per task/milestone counting **static constraints plus
  dependency-supplied endpoints** (exactly 2; groups exempt).
- Report a group used as either endpoint of a dependency.
- Anchor-per-component check (≥1 absolute date), scoped to components that
  contain at least one task or milestone.
- Surface structural hydration failures (`SelfLoopDependencyError`,
  `ParallelEdgeDependencyError`, `CyclicDependencyError`) to the user with
  localized messages naming the offending ids.

### Non-goals

- Structural DAG detection itself (see DAG-backbone spec — prerequisite, already
  implemented in `DependencyGraph` and `hydrateDocument`).
- Precedence normalization: per
  [in-memory-graph.md](../requirements/in-memory-graph.md), normalization is the
  uniform edge reversal `target ⟶ source` for **all three** dependency types, so it
  is a whole-graph reversal that cannot change whether a cycle exists. It is
  therefore not required for detection and is deferred to the scheduling engine,
  which needs precedence _order_.
- Optimizing `wouldCreateCycle` (today it rebuilds adjacency and runs a full DFS);
  performance work is out of scope (would be addressed when introducing `graphology`).
- Effective-date computation (see scheduling-engine spec — it consumes the
  validated graph).
- Model shapes / duration field (see scheduling-data-model spec — prerequisite).
- Rename/migration (see dependency-type-rename spec — prerequisite).

## 3. Breaking Changes

- **Remove support for `endBefore` dependency type:** This feature removes one of
  the four supported dependency types. The `endBefore` type will be deleted from
  the codebase (enum, UI, serialization, and all handlers). Existing documents
  containing `endBefore` dependencies will become invalid at parse time. When a
  document with an `endBefore` dependency is parsed, hydration throws a validation
  error, the controller shows a localized message naming the dependency, and the
  last valid model is preserved (per §1 Failure Model). **No document version
  bump or migration logic is added** — documents containing `endBefore` are
  already broken for the purposes of the scheduling engine (see [§9](#9-test-strategy)
  and the [scheduling-engine spec](./scheduling-engine.md) for handling of
  unschedulable documents).

## 4. User Stories

- As a planner, I want a dependency that would create a cycle to be blocked, so
  that my schedule stays computable.
- As a planner, I want a warning when a task has too few or too many constraints,
  so that I can spot ambiguous items while still working on the chart.
- As a planner, I want a document with semantic problems to still open, so that I
  can repair it in the editor instead of being locked out of my file.

## 5. Acceptance Criteria

### Structural (already implemented — surfacing only)

- Given a dependency whose addition closes a cycle
  When the user adds it
  Then it is rejected with a localized error and no document change is applied.

- Given a document whose dependencies close a cycle, contain a self-loop, or
  contain a parallel edge
  When it is parsed
  Then `hydrateDocument` throws the corresponding typed error, and the controller
  shows a localized message naming the offending ids while preserving the last
  valid in-memory model.

### Semantic (new)

- Given a task whose count of _static_ constraints ({start, duration, end} that
  are set) plus _dependency-supplied_ endpoints is not exactly 2
  When the model is validated
  Then it is reported as under- or over-constrained with a localized message.

- Given a task with `duration` set and one or more direct dependencies
  (`startAfter`/`startWith`)
  When the model is validated
  Then it counts as determinate (the dependencies supply the start endpoint) and
  is **not** reported.

- Given a milestone used as the source of an `endWith` dependency
  When the model is validated
  Then it follows the same rule as a task, using its date as its effective end.

- Given a dependency whose source or target is a group id
  When the model is validated
  Then it is reported as an unsupported group dependency (groups cannot carry
  dependencies).

- Given a connected component that contains at least one task or milestone and
  no absolute date anchor
  When the model is validated
  Then it is reported as an unanchored (floating) component.

- Given a component consisting only of group nodes, or an isolated group node
  When the model is validated
  Then it is **not** reported as unanchored (groups are exempt).

- Given a dependency referencing an id that is neither a task, milestone, nor
  group
  When the model is validated
  Then it is reported as dangling (existing behavior preserved).

- Given a group
  When the model is validated
  Then determinacy rules are not applied to it.

- Given any semantic violation
  When the document is opened
  Then the editor still opens and renders; no load is cancelled.

### Delete cleanup

- Given a task or milestone with one or more dependencies where it is the source
  When the entity is deleted
  Then each such dependency is removed in the same document update without an
  additional validation check.

- Given a task or milestone used as the target of a `startWith` dependency
  When the target entity is deleted
  Then the surviving source task receives the deleted target's effective start
  date as its persisted `start`, and the dependency is removed atomically.

- Given a task or milestone used as the target of an `endWith` dependency
  When the target entity is deleted
  Then the surviving source task receives the deleted target's effective end
  date as its persisted `end`, and the dependency is removed atomically.

- Given a task or milestone used as either endpoint of any other dependency
  When the entity is deleted
  Then the dependency is removed in the same document update, so the parser
  never observes a dangling reference.

## 6. Domain & Data Model Impact

No persisted shape change.

**Ownership.** Semantic validation operates on the **hydrated `GanttModel`**, so
it reuses `model.graph` instead of rebuilding adjacency. `dependencyGraphService`
keeps its document-shaped `validateGraph`/`wouldCreateCycle` entry points and
becomes a thin delegate that hydrates (or reuses the graph) and forwards.

**Collaborators.** The determinacy rule composes the existing
`describeTaskConstraints` helper in `src/services/taskConstraintService.ts` with
the incoming edges from `model.graph.predecessors(id)`; it must not re-derive the
static constraint count. `describeTaskConstraints` remains static-only — a new
pure helper `getEffectiveConstraintCount(taskId, model, graph): number` combines
it with the dependency-supplied endpoints (`startAfter` / `startWith` supply
_start_; `endWith` supplies _end_).

**Deletion.** `buildTaskOrMilestoneDeletionDocument` in
`src/services/entityEditWorkflowService.ts` owns the atomic delete transform.
It hydrates the current document only to read resolvable effective endpoints,
updates surviving source tasks for incoming `startWith`/`endWith` edges, removes
all edges touching the deleted id, and removes the entity in one replacement
document. If an endpoint cannot be resolved, deletion still removes the edge and
leaves that endpoint unset; ordinary semantic validation then reports any
resulting under-constrained task.

**Result shape.** Extend `GraphValidationResult` in
`src/services/dependencyGraphService.ts` with:

| Field                      | Meaning                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `underConstrainedIds`      | Items with fewer than 2 effective constraints.                          |
| `overConstrainedIds`       | Items with more than 2 effective constraints.                           |
| `groupDependencyIds`       | Dependency ids with a group as source or target.                        |
| `unanchoredComponentIds`   | Representative ids of components lacking an absolute date anchor.       |

The existing `cycle` field is retained but is always empty for a hydrated model
(cycles throw earlier); it stays populated only on the unhydrated document path.

## 7. Protocol Impact

`src/common/protocol.ts` gains no new message in this feature. Aggregated
validation results stay host-side: the sidebar and error surfaces read them from
the controller, and the webview receives no structured payload. The edit form's
local pre-check does not need one either — the constraint helpers live in
`src/services/` and are pure, so the webview imports them directly. Revisit only
when the timeline needs per-item badges (see §9).

## 8. UX

Because every semantic rule is advisory, the document always renders.

- Timeline (ECharts): unchanged in this feature — no per-item badge, since no
  validation payload crosses the protocol boundary.
- Sidebar tree: invalid nodes flagged with a warning affordance and a localized
  tooltip describing the violated rule.
- Edit form: the task form recalculates the effective constraint count as the
  user edits static fields or dependencies and shows an inline advisory warning
  unless the count is exactly two. The warning does **not** block Save; the host
  remains the canonical check after the edit is applied. Milestones use their
  date as both effective endpoints and follow the same dependency rules as
  tasks.
- Structural hydration failures continue to surface as a localized error message
  naming the offending ids.

Design rationale (values → principles → moves): Value Trust · Principle: never
trap the user in a file they cannot open · Move: block only what corrupts the
graph structure, and report everything else in place, next to the item at fault.

### New localized strings

All externalized via `vscode.l10n.t()` with `{0}` placeholders and added to
`l10n/bundle.l10n.json`:

- under-constrained item (id, current constraint count)
- over-constrained item (id, current constraint count)
- group used as a dependency endpoint (id)
- unanchored component (member ids)
- self-loop dependency (dependency id)
- parallel-edge dependency (source id, target id)

## 9. Test Strategy

- Unit (services): determinacy across every combination of static constraints ×
  incoming dependency types, including the `duration` + `startAfter` determinate
  case and the scenario matrix covering: zero static constraints
  (under-constrained), two static (determinate), three static (hyperstatic);
  end-anchored (`endWith`) constraint detection; milestone `endWith` ownership;
  group-as-endpoint; anchor-per-component including the group-only-component
  exemption; dangling references.
- Unit (models): structural detection is already covered by the DAG-backbone
  suite — assert only that semantic validation is reached for graphs that
  hydrate successfully.
- Integration: add-dependency rejection path; hydration-failure path renders the
  localized message and preserves the last valid model; a semantically invalid
  document still opens.
- Webview interaction: task-form warnings use the dependency-aware effective
  count; they remain advisory and do not block save. Milestones do not receive
  a special dependency warning.
- Unit (edit workflow): task/milestone deletion removes outgoing and incoming
  dependencies atomically, materializes `startWith`/`endWith` target endpoints
  on surviving source tasks, and supports milestones as deleted anchors.
- Coverage: branch coverage ≥ 90% across every report path.

## 10. Risks & Open Questions

- 🔴 High — Risk: breaking change — removal of `endBefore` dependency type
  invalidates existing documents containing it. Treatment: existing `.ganttee`
  files with `endBefore` dependencies will fail hydration with a localized error
  message; users must either remove the `endBefore` dependencies or upgrade their
  workflow. No forward migration path is provided. Scheduling-engine spec (spec #7)
  should document handling of unschedulable documents.
- 🔴 High — Risk: determinacy that counts dependency-supplied endpoints can
  disagree with the static-only `describeTaskConstraints` already used by the
  edit form, producing two different verdicts for one task. Treatment: the edit
  form must call the new combined helper, and `describeTaskConstraints` is
  documented as static-only and never used for validation directly.
- 🟡 Medium — Risk: the anchor check depends on `connectedComponents()`, which
  includes group nodes. Treatment: filter components to those containing a task
  or milestone before evaluating anchors, covered by a dedicated test.
- 🟡 Medium — Risk: reporting every violation as advisory lets an unschedulable
  document reach the scheduling engine. Treatment: the scheduling-engine spec
  must define its behavior for items flagged here (skip vs. best-effort).
