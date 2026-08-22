---
Status: Implementing
Owner: Copilot
Last updated: 2026-08-22
---

# Feature: Scheduling Graph Validation (cycle, determinacy, anchor, dangling)

![Status: Implementing](https://img.shields.io/badge/status-Implementing-F59F00?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Add graph validation on top of the **structural** DAG guarantees the DAG-backbone
feature already enforces at hydration. Structural failures (self-loop, parallel
edge, directed cycle, group dependency endpoint, and dangling dependency) are
invalid graph inputs. This feature also validates endpoint-aware determinacy
and absolute date anchors. The complete task and milestone constraint rules are
defined in [constraint-endpoint-rules.md](../documentation/constraint-endpoint-rules.md).
When an existing document contains an invalid dependency or unanchored
component, the editor warns the user, atomically rewrites the source document
to remove it, and builds the in-memory model from the rewritten document.

### Failure model

This is the decision that governs every acceptance criterion below.

| Rule                                     | Class      | Behavior                                                  |
| ---------------------------------------- | ---------- | --------------------------------------------------------- |
| Self-loop, parallel edge, directed cycle | Structural | **Blocking** — thrown at hydration (already implemented). |
| Under-constrained item                   | Semantic   | Advisory on open; invalid edits cannot be saved.          |
| Ordinary over-constrained item           | Semantic   | Advisory on open; invalid edits cannot be saved.          |
| Duplicate endpoint/date constraint       | Semantic   | Warning on open and save; scheduling resolves it.         |
| Group as either endpoint of a dependency | Structural | Warning on open; dependency removed; save blocked.        |
| Dangling source/target reference         | Structural | Warning on open; dependency removed; save blocked.        |
| Component with no absolute date anchor   | Semantic   | Warning on open; component removed; save blocked.         |

The one _preventive_ path is add-dependency: a candidate that would close a cycle
is rejected before the `WorkspaceEdit` is applied (already implemented).

Task and milestone deletion is also structural maintenance, not semantic
validation: it creates one replacement document that removes every dependency
touching the deleted id so no dangling edge is persisted. Before removing an
incoming `startWith` or `endWith` dependency, it materializes the deleted
anchor's effective start or end on the surviving source task. If a required
effective endpoint cannot be resolved, deletion is blocked.

## 2. Goals / Non-goals

### Goals

- Compute a semantic validation result over the hydrated `GanttModel` and its
  `DependencyGraph`.
- Endpoint-aware determinacy for tasks and milestones: count independent
  endpoint constraints, report fewer than two as under-constrained, report more
  than two as over-constrained, and report static plus outgoing constraints on
  the same endpoint as a duplicate-endpoint over-constraint. Groups are exempt.
- Treat incoming dependency type as irrelevant to the source item's result.
- Allow milestone `date` to be absent and inferred from outgoing dependencies;
  allow milestones to source `endWith`.
- Report a group used as either endpoint of a dependency.
- Remove group dependencies, dangling dependencies, and unanchored components
  from the source document as an atomic automatic edit before building the
  in-memory model.
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
- Effective-date computation and fallback behavior (see scheduling-engine spec;
  it consumes the validated graph).
- Scheduling precedence, aggregation, and default-duration behavior.
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

- Given a task with static constraints selected from `start`, `duration`, and
  `end`
  When the model is validated
  Then the task is determinate only when it has exactly two independent
  constraints, under-constrained with fewer than two, and over-constrained with
  more than two.

- Given a task with one or more outgoing `startAfter` or `startWith`
  dependencies
  When the model is validated
  Then those dependencies supply one effective start constraint for the source
  task, regardless of how many such dependencies exist.

- Given a task with one or more outgoing `endWith` dependencies
  When the model is validated
  Then those dependencies supply one effective end constraint for the source
  task, regardless of how many such dependencies exist.

- Given a task with a static `start` and one or more outgoing `startAfter` or
  `startWith` dependencies
  When the model is validated
  Then it is reported as over-constrained because two constraints define the
  same start endpoint, even if the total independent constraint count is two,
  and the edit remains saveable.

- Given a task with a static `end` and one or more outgoing `endWith`
  dependencies
  When the model is validated
  Then it is reported as over-constrained because two constraints define the
  same end endpoint, even if the total independent constraint count is two,
  and the edit remains saveable.

- Given a task with outgoing dependencies on different endpoints
  When the model is validated
  Then each endpoint contributes at most one independent constraint and the
  task is classified using the complete static-plus-outgoing combination.

- Given a task with any incoming dependency type
  When the task is validated
  Then the incoming dependency does not change the task's constraint result.

- Given a milestone with a static `date`
  When the model is validated
  Then `date` supplies both its start and end and its validation result follows
  the milestone truth table.

- Given a milestone without a static `date` and one or more outgoing
  `startAfter`, `startWith`, or `endWith` dependencies
  When the model is validated
  Then its date is considered dependency-defined and it is determinate when
  the outgoing constraints provide the required endpoint information.

- Given a milestone without a static `date` and without outgoing endpoint
  dependencies
  When the model is validated
  Then it is reported as under-constrained.

- Given a milestone with a static `date` and an outgoing dependency that
  constrains start or end
  When the model is validated
  Then it is reported as over-constrained because `date` represents both
  endpoints and the dependency duplicates that date constraint, but the edit
  remains saveable.

- Given a milestone used as the source of an `endWith` dependency
  When the model is validated
  Then the dependency is accepted as a valid dependency ownership pattern and
  the milestone's date remains its single start/end value.

- Given a dependency whose source or target is a group id
  When the model is validated
  Then it is classified as a structural violation, a warning is raised when
  the document opens, the dependency is removed from the source document, and
  the resulting model contains no such dependency.

- Given a connected component that contains at least one task or milestone and
  no absolute date anchor
  When the model is validated
  Then it is reported as an unanchored (floating) component, a warning is
  raised when the document opens, the complete component is removed from the
  source document, and the resulting model contains no such component.

- Given a component consisting only of group nodes, or an isolated group node
  When the model is validated
  Then it is **not** reported as unanchored (groups are exempt).

- Given a dependency referencing an id that is neither a task, milestone, nor
  group
  When the model is validated
  Then it is classified as a structural violation, a warning is raised when
  the document opens, the dependency is removed from the source document, and
  the resulting model contains no such dependency.

- Given a group
  When the model is validated
  Then determinacy rules are not applied to it.

- Given any semantic violation
  When the document is opened
  Then the editor still opens and renders; no load is cancelled.

- Given an under-constrained task or milestone in an edit form
  When the user attempts to save
  Then the save is blocked and the validation message identifies the missing
  constraint information.

- Given an ordinary over-constrained task or milestone with more than two
  independent constraints
  When the user attempts to save
  Then the save is blocked and the validation message identifies the excess
  constraint information.

- Given an edit that would create or preserve a group dependency endpoint, a
  dangling dependency reference, or an unanchored component
  When the user attempts to save
  Then the save is blocked and the relevant invalid dependency or component is
  not inserted into the source document.

- Given a task or milestone with a duplicate endpoint or date constraint
  When the user attempts to save
  Then the save is allowed and the duplicate constraint warning remains
  visible for scheduling-engine resolution.

The complete editing decision table, including mixed warning and blocking-error
cases, is defined in [constraint-endpoint-rules.md](../documentation/constraint-endpoint-rules.md#editing-behavior).
This spec does not duplicate that functional table.

### Delete cleanup

- Given a task or milestone with one or more dependencies where it is the source
  When the entity is deleted
  Then each such dependency is removed in the same document update without an
  additional validation check.

- Given a task or milestone used as the target of a `startWith` dependency and
  a resolvable effective start
  When the target entity is deleted
  Then the surviving source task receives the deleted target's effective start
  date as its persisted `start`, and the dependency is removed atomically.

- Given a task or milestone used as the target of an `endWith` dependency and a
  resolvable effective end
  When the target entity is deleted
  Then the surviving source task receives the deleted target's effective end
  date as its persisted `end`, and the dependency is removed atomically.

- Given a milestone target whose effective endpoint cannot be resolved
  When the milestone is deleted
  Then deletion is blocked and the dependency and document remain unchanged.

- Given a task or milestone used as either endpoint of any other dependency
  When the entity is deleted
  Then the dependency is removed in the same document update, so the parser
  never observes a dangling reference.

## 6. Domain & Data Model Impact

The persisted milestone shape is relaxed so `date` is optional. This is
backward-compatible with existing documents and does not require a document
version bump or migration. A milestone's date remains its single canonical
value and represents both effective start and effective end.

Milestones may be the source of `endWith` dependencies. The dependency is
validated using the milestone's single date endpoint, just as any other
outgoing endpoint constraint is validated.

**Ownership.** Semantic validation operates on the **hydrated `GanttModel`**, so
it reuses `model.graph` instead of rebuilding adjacency. `dependencyGraphService`
keeps its document-shaped `validateGraph`/`wouldCreateCycle` entry points and
becomes a thin delegate that hydrates (or reuses the graph) and forwards.

**Validation rules.** The task matrix and milestone matrix in
[constraint-endpoint-rules.md](../documentation/constraint-endpoint-rules.md)
are normative for this feature. They define the complete combinations of
static values, outgoing endpoint constraints, and incoming dependency context.
Incoming dependency type never changes the result for the source item.

Static values and outgoing dependencies on different endpoints contribute
separate independent constraints. A static value and an outgoing dependency on
the same endpoint are reported as a duplicate-endpoint over-constraint, even
when the independent constraint count is otherwise two. Multiple outgoing
dependencies for one endpoint count as one endpoint constraint for determinacy.

**Collaborators.** The validation layer must distinguish static endpoint
presence, outgoing start constraints (`startAfter`/`startWith`), and outgoing end
constraints (`endWith`). It must evaluate milestones with an absent date and
must accept milestones as `endWith` sources.

**Deletion.** `buildTaskOrMilestoneDeletionDocument` in
`src/services/entityEditWorkflowService.ts` owns the atomic delete transform.
It hydrates the current document only to read resolvable effective endpoints,
updates surviving source tasks for incoming `startWith`/`endWith` edges, removes
all edges touching the deleted id, and removes the entity in one replacement
document. If a required endpoint cannot be resolved, deletion is blocked and
the document remains unchanged.

**Result shape.** Extend `GraphValidationResult` in
`src/services/dependencyGraphService.ts` with:

| Field                    | Meaning                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `underConstrainedIds`    | Items with fewer than 2 independent constraints.                         |
| `overConstrainedIds`     | Items with more than 2 independent constraints or a duplicate endpoint.  |
| `constraintCounts`       | Independent endpoint constraint count for each validated task/milestone. |
| `groupDependencyIds`     | Dependency ids with a group as source or target.                         |
| `unanchoredComponentIds` | Representative ids of components lacking an absolute date anchor.        |

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

Existing documents with validation violations remain accessible for repair.
Opening a document applies structural and semantic validation before the model
is used by the editor. Parse failures and structural hydration failures show a
localized VS Code error notification that names the offending ids. The previous
valid model is preserved when hydration fails, so the editor does not replace a
working view with an invalid or partial model.

When sanitization finds an invalid dependency or an unanchored component, the
host shows a localized warning and atomically rewrites the source document to
remove the invalid structure. The model is then rebuilt from that rewritten
document. If the cleanup rewrite fails, the host shows a localized cleanup
failure error; it does not silently claim that the invalid structure was
removed.

- Timeline (ECharts): unchanged in this feature — no per-item badge, since no
  validation payload crosses the protocol boundary.
- Sidebar tree: invalid nodes and affected dependencies display a warning badge.
  Its localized tooltip is multiline so it can identify the affected ids and
  describe each violated rule without truncating the diagnostic into one dense
  line.
- Edit form: task and milestone forms recompute the shared validation as static
  fields and dependencies change. Blocking validation errors are shown inline
  and separately from non-blocking duplicate endpoint or date warnings. Invalid
  saves are suppressed; host validation reports localized errors and leaves the
  source document unchanged. Duplicate-only saves are allowed, and their
  warnings remain visible for scheduling-engine resolution. A milestone may use
  a dependency-defined date and can be saved without a static date when its
  outgoing dependencies provide the required endpoint information.

Host notifications and sidebar diagnostics are localized. Current webview form
validation messages are literal English; this is the current form behavior
while the shared validation rules are used by both host and webview.

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

- Unit (services): execute every row of the task truth table (8 static
  combinations × 4 outgoing endpoint groups) and every row of the milestone
  truth table (date present/absent × 4 outgoing endpoint groups). Include
  incoming dependency types and verify they do not alter the result.
- Unit (services): duplicate static/outgoing start and end endpoint cases;
  multiple outgoing dependencies on one endpoint; milestone `endWith` source;
  group-as-endpoint omission; anchor-per-component including omission of an
  unanchored component and the group-only-component exemption; and dangling
  dependency omission.
- Unit (models): structural detection is already covered by the DAG-backbone
  suite — assert only that semantic validation is reached for graphs that
  hydrate successfully.
- Integration: add-dependency rejection path; hydration-failure path renders the
  localized message and preserves the last valid model; a semantically invalid
  document still opens; under-constrained and ordinary over-constrained saves
  are blocked; duplicate endpoint/date saves are allowed and retain warnings.
- Integration: opening a document with a group dependency, dangling dependency,
  or unanchored component raises a warning, atomically rewrites the source
  document, and builds a model without the invalid structure.
- Webview interaction: task and milestone forms display endpoint-aware feedback,
  show warnings and blocking errors independently, allow duplicate-only edits,
  and block edits when any blocking error is also present.
- Unit (edit workflow): task/milestone deletion removes outgoing and incoming
  dependencies atomically, materializes resolvable `startWith`/`endWith` target
  endpoints on surviving source tasks, supports milestones as deleted anchors,
  and blocks deletion when a required endpoint is unresolvable.
- Coverage: branch coverage ≥ 90% across every report path.

## 10. Risks & Open Questions

- 🔴 High — Risk: breaking change — removal of `endBefore` dependency type
  invalidates existing documents containing it. **Treatment**: existing `.ganttee`
  files with `endBefore` dependencies will fail hydration with a localized error
  message; users must either remove the `endBefore` dependencies or upgrade their
  workflow. No forward migration path is provided. Scheduling-engine spec (spec #7)
  should document handling of unschedulable documents.
- 🔴 High — Risk: endpoint-aware duplicate detection can disagree with a
  static-only constraint count and allow an invalid edit to be persisted.
  **Treatment**: the same endpoint-aware rules must be used by validation and the
  edit-form save gate; the functional matrices are the shared oracle.
- 🟡 Medium — Risk: optional milestone dates can make deletion cleanup unable to
  materialize an endpoint. **Treatment**: block the deletion and preserve the
  document when the required effective endpoint is unavailable.
- 🟡 Medium — Risk: sanitizing invalid dependencies and components can make the
  in-memory model differ from the source document. **Treatment**: retain the
  source unchanged, raise a warning on open, identify every omitted structure,
  and block edits that would create or preserve the same invalid structure.
- 🟡 Medium — Risk: relaxing milestone date presence without a version bump could
  expose assumptions in existing consumers. **Treatment**: retain the canonical
  date semantics, add explicit absent-date validation cases, and verify both
  legacy dated documents and dependency-dated milestones.
- 🟡 Medium — Risk: the anchor check depends on `connectedComponents()`, which
  includes group nodes. **Treatment**: filter components to those containing a task
  or milestone before evaluating anchors, covered by a dedicated test.
- 🟡 Medium — Boundary: scheduling behavior for validated violations is outside
  this feature. **Treatment**: the scheduling-engine spec separately defines how
  invalid items are computed; this spec defines only detection and persistence
  gates.
