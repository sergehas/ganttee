---
Status: Draft
Owner: Copilot
Last updated: 2026-08-07
---

# Feature: Scheduling Graph Validation (cycle, determinacy, anchor, dangling)

![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Add the **semantic** layer of scheduling-graph validation on top of the
**structural** DAG guarantees the DAG-backbone feature already enforces at
hydration. Structural failures (self-loop, parallel edge, directed cycle) are
already hard errors thrown by `hydrateDocument`; this feature adds the rules that
cannot be expressed structurally: per-item determinacy (exactly 2 constraints,
counting both static fields and dependency-supplied endpoints), conflicting end
constraints, milestone-as-reverse-owner, dangling references, and an absolute
date anchor per schedulable component. Semantic results are **advisory** — they
are reported on the hydrated model, never thrown — so an invalid document still
opens and can be repaired in the editor.

### Failure model

This is the decision that governs every acceptance criterion below.

| Rule                                                  | Class      | Behavior                                                  |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------- |
| Self-loop, parallel edge, directed cycle              | Structural | **Blocking** — thrown at hydration (already implemented). |
| Under-/over-constrained item                          | Semantic   | Advisory — reported, document still opens.                |
| Mixed `endWith` + `endBefore` on one owner            | Semantic   | Advisory — reported, document still opens.                |
| Milestone as owner (`source`) of a reverse dependency | Semantic   | Advisory — reported, document still opens.                |
| Group as either endpoint of a dependency              | Semantic   | Advisory — reported, document still opens.                |
| Dangling source/target reference                      | Semantic   | Advisory — reported, document still opens.                |
| Component with no absolute date anchor                | Semantic   | Advisory — reported, document still opens.                |

The one _preventive_ path is add-dependency: a candidate that would close a cycle
is rejected before the `WorkspaceEdit` is applied (already implemented).

## 2. Goals / Non-goals

### Goals

- Compute a semantic validation result over the hydrated `GanttModel` and its
  `DependencyGraph`.
- Determinacy check per task/milestone counting **static constraints plus
  dependency-supplied endpoints** (exactly 2; groups exempt).
- Reject mixing `endWith` + `endBefore` reverse dependencies on the same owner.
- Reject a milestone used as the owner (`source`) of a reverse dependency.
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
  uniform edge reversal `target ⟶ source` for **all four** dependency types, so it
  is a whole-graph reversal that cannot change whether a cycle exists. It is
  therefore not required for detection and is deferred to the scheduling engine,
  which needs precedence _order_.
- Optimizing `wouldCreateCycle` (today it rebuilds adjacency and runs a full DFS);
  performance work is out of scope (would be addressed when introducing `graphology`).
- Effective-date computation (see scheduling-engine spec — it consumes the
  validated graph).
- Model shapes / duration field (see scheduling-data-model spec — prerequisite).
- Rename/migration (see dependency-type-rename spec — prerequisite).

## 3. User Stories

- As a planner, I want a dependency that would create a cycle to be blocked, so
  that my schedule stays computable.
- As a planner, I want a warning when a task has too few or too many constraints,
  so that I can spot ambiguous items while still working on the chart.
- As a planner, I want a document with semantic problems to still open, so that I
  can repair it in the editor instead of being locked out of my file.

## 4. Acceptance Criteria

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

- Given a task that owns both an `endWith` and an `endBefore` reverse dependency
  When the model is validated
  Then it is reported as having conflicting end constraints.

- Given a milestone used as the owner (`source`) of a reverse dependency
  When the model is validated
  Then it is reported (milestones may only be the anchor of a reverse
  dependency).

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

## 5. Domain & Data Model Impact

No persisted shape change.

**Ownership.** Semantic validation operates on the **hydrated `GanttModel`**, so
it reuses `model.graph` instead of rebuilding adjacency. `dependencyGraphService`
keeps its document-shaped `validateGraph`/`wouldCreateCycle` entry points and
becomes a thin delegate that hydrates (or reuses the graph) and forwards.

**Collaborators.** The determinacy rule composes the existing
`describeTaskConstraints` helper in `src/services/taskConstraintService.ts` with
the incoming edges from `model.graph.predecessors(id)`; it must not re-derive the
static constraint count. `describeTaskConstraints` remains static-only — a new
pure helper combines it with the dependency-supplied endpoints (`startAfter` /
`startWith` supply _start_; `endWith` / `endBefore` supply _end_).

**Result shape.** Extend `GraphValidationResult` in
`src/services/dependencyGraphService.ts` with:

| Field                      | Meaning                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `underConstrainedIds`      | Items with fewer than 2 effective constraints.                        |
| `overConstrainedIds`       | Items with more than 2 effective constraints.                         |
| `conflictingEndIds`        | Owners mixing `endWith` and `endBefore`.                              |
| `milestoneReverseOwnerIds` | Dependency ids whose source is a milestone and whose type is reverse. |
| `groupDependencyIds`       | Dependency ids with a group as source or target.                      |
| `unanchoredComponentIds`   | Representative ids of components lacking an absolute date anchor.     |

The existing `cycle` field is retained but is always empty for a hydrated model
(cycles throw earlier); it stays populated only on the unhydrated document path.

## 6. Protocol Impact

`src/common/protocol.ts` gains no new message in this feature. Aggregated
validation results stay host-side: the sidebar and error surfaces read them from
the controller, and the webview receives no structured payload. The edit form's
local pre-check does not need one either — the constraint helpers live in
`src/services/` and are pure, so the webview imports them directly. Revisit only
when the timeline needs per-item badges (see §7).

## 7. UX

Because every semantic rule is advisory, the document always renders.

- Timeline (ECharts): unchanged in this feature — no per-item badge, since no
  validation payload crosses the protocol boundary.
- Sidebar tree: invalid nodes flagged with a warning affordance and a localized
  tooltip describing the violated rule.
- Edit form: inline validation of the effective constraint count on save,
  computed in the webview by importing the pure constraint helper — the host
  remains the canonical check when the edit is applied.
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
- conflicting `endWith`/`endBefore` on one owner (id)
- milestone used as reverse-dependency owner (id)
- group used as a dependency endpoint (id)
- unanchored component (member ids)
- self-loop dependency (dependency id)
- parallel-edge dependency (source id, target id)

## 8. Test Strategy

- Unit (services): determinacy across every combination of static constraints ×
  incoming dependency types, including the `duration` + `startAfter` determinate
  case; mixed `endWith`/`endBefore` rejection; milestone-as-reverse-owner;
  group-as-endpoint; anchor-per-component including the group-only-component
  exemption; dangling references.
- Unit (models): structural detection is already covered by the DAG-backbone
  suite — assert only that semantic validation is reached for graphs that
  hydrate successfully.
- Integration: add-dependency rejection path; hydration-failure path renders the
  localized message and preserves the last valid model; a semantically invalid
  document still opens.
- Webview interaction: constraint-count pre-check blocks save in the edit form.
- Coverage: branch coverage ≥ 90% across every report path.

## 9. Risks & Open Questions

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
