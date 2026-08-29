---
Status: Implemented
Owner: Copilot
Last updated: 2026-07-26
---

# Feature: In-memory object-oriented model (Schedulable / BaseTask, Date-typed)

![Status: Implemented](https://img.shields.io/badge/status-Implemented-2B8A3E?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Today the parsed `.ganttee` model is a bag of plain records whose dates are ISO
strings and whose scheduling accessors (`effectiveStart`, `effectiveEnd`,
`effectiveDuration`) are free functions returning `string | undefined`. This spec
introduces a proper object-oriented in-memory model: after a document is loaded,
tasks, milestones, and groups become entity instances that share a `BaseTask`
shape and implement a `Schedulable` behavior interface, with all date attributes
typed as `Date`. The on-disk file and the host↔webview protocol stay plain
(ISO-string) JSON — the OO/`Date` model lives only in host memory, because
`postMessage` and JSON serialization strip `Date` objects and methods. The result
is a clean domain layer that the future scheduling engine can compute over,
without disturbing persistence, the wire protocol, or the current UI beyond a
mandatory field rename.

## 2. Goals / Non-goals

### Goals

- Add a `BaseTask` interface (`id`, `name`, `description?`, `groupId?`) shared by
  every schedulable entity.
- Rename the persisted field `title` → `name` on tasks and milestones, and
  `Group.parentId` → `Group.groupId`, so all three entities share the `BaseTask`
  shape.
- Add a `Schedulable` interface with methods `effectiveStart(): Date`,
  `effectiveEnd(): Date`, and `effectiveDuration(): number`.
- Introduce OO entity classes (`TaskEntity`, `MilestoneEntity`, `GroupEntity`) and
  a `GanttModel` container that implement `BaseTask` + `Schedulable` and carry
  `Date`-typed schedule fields.
- Add a **hydrator** that converts the validated plain `GanttDocument` into a
  `GanttModel` on load (ISO string → `Date`), and format `Date` → ISO string
  (`YYYY-MM-DD`) on serialize.
- Migrate already-saved documents in place — rename legacy fields on load — **without
  bumping** `CURRENT_DOCUMENT_VERSION`.
- Build and store the hydrated `GanttModel` in the editor controller on every
  reparse, establishing the OO model in the load path.

### Non-goals

- Real scheduling computation, dependency propagation, and group rollup — the
  group `effective*` values are placeholders here (see scheduling-engine spec).
- Constraint/determinacy/cycle validation logic (see graph-validation spec).
- Any GUI refactor beyond the mandatory `title`→`name` / `parentId`→`groupId`
  renames (the webview keeps consuming plain, ISO-string data).
- Bumping the on-disk schema version or changing the wire-protocol message shapes.

## 3. User Stories

- As a Ganttee developer, I want tasks, milestones, and groups to be OO entities
  implementing a shared `Schedulable` interface with `Date`-typed accessors, so
  that the scheduling engine can compute over one uniform domain model.
- As a Ganttee developer, I want user-set schedule data kept separate from computed
  values behind `effective*` methods, so that the source of truth stays
  unambiguous as scheduling grows.
- As a planner with an existing `.ganttee` file, I want my document to keep loading
  after the field renames, so that upgrading the extension never corrupts or
  rejects my data.

## 4. Acceptance Criteria

- Given a valid `.ganttee` document with tasks, milestones, and groups (each task
  well-formed, i.e. exactly 2 of {start, duration, end} set)
  When it is loaded and hydrated
  Then a `GanttModel` is produced whose entities implement `BaseTask` +
  `Schedulable`, and every schedule attribute (`start`, `end`, milestone `date`,
  and the `effective*` results) is a `Date` instance — the unset endpoint being
  derived from the other two constraints. (Under-constrained tasks are rejected by
  the graph-validation spec, not here.)

- Given a task with `start` and `end` set
  When `effectiveStart()` / `effectiveEnd()` are read
  Then they return `Date` objects equal to the parsed `start` / `end`, and
  `effectiveDuration()` returns `end − start` in decimal days.

- Given a task with `start` and `duration` set (no `end`)
  When `effectiveEnd()` and `effectiveDuration()` are read
  Then `effectiveDuration()` returns the user-set `duration`, and `effectiveEnd()`
  returns `start + duration` (calendar-day arithmetic in this phase; working-day
  arithmetic is deferred to the scheduling-engine spec).

- Given a task with `end` and `duration` set (no `start`)
  When `effectiveStart()` is read
  Then it returns `end − duration` (calendar-day arithmetic in this phase).

- Given a milestone with `date`
  When `effectiveStart()`, `effectiveEnd()`, and `effectiveDuration()` are read
  Then start and end both equal the parsed `date`, and duration equals
  `MILESTONE_DURATION` (0).

- Given a group
  When `effectiveStart()` / `effectiveEnd()` are read
  Then both return the Unix epoch (`new Date(0)`) as a deterministic placeholder,
  and `effectiveDuration()` is `0` — flagged for replacement by the scheduling
  engine.

- Given a hydrated `GanttModel`
  When it is serialized back to text
  Then every `Date` is written as an ISO date string matching
  `/^\d{4}-\d{2}-\d{2}$/`, and a parse → hydrate → serialize round-trip is stable.

- Given a legacy document that uses `title` on a task/milestone or `parentId` on a
  group
  When it is loaded
  Then the fields are read as `name` / `groupId`, the document loads successfully,
  and re-serializing writes only the new field names (self-healing on next save).

- Given a document that already uses the new field names
  When it is loaded and re-serialized
  Then it is unchanged (round-trip stable) and no `title` / `parentId` keys are
  written.

- Given a document string containing a multi-line `description`
  When it is parsed, hydrated, and re-serialized
  Then the newlines are preserved (JSON-escaped) with no data loss.

## 5. Domain & Data Model Impact

**Persisted / wire types stay plain (ISO strings).** `Task`, `Milestone`,
`Group`, and `GanttDocument` in `src/common/models/` remain the serialized shape
used on disk and over the protocol. Field renames apply to these plain types:

- `src/common/models/task.ts`:
  - `Task`: rename `title` → `name` (see `BaseTask`); `start` / `end` remain
    optional ISO-string inputs; `duration` unchanged.
  - `Milestone`: rename `title` → `name`; `date` stays an ISO string;
    `MILESTONE_DURATION` reused.
  - `Group`: rename `parentId` → `groupId`.
  - Existing free `effective*` / `milestoneStart` / `milestoneEnd` helpers remain
    for the webview, now reading the renamed fields (still string-based). These
    string-returning free functions coexist with the identically named `Date`-
    returning `Schedulable` methods; the two are distinguished by call form
    (`effectiveStart(task)` vs `entity.effectiveStart()`) and are never mixed.

**New `BaseTask` interface** (shared shape) in `src/common/models/`:

- `id: string`
- `name: string`
- `description?: string` (may contain multi-line text; no special handling needed —
  JSON escapes newlines)
- `groupId?: string` — the owning group id. For a `Group`, this is its **parent**
  group (the former `parentId`), since a group's owning container is its parent.

`Task`, `Milestone`, and `Group` extend `BaseTask`.

**New OO domain layer** — new file `src/common/models/entities.ts` (pure; no
`vscode`/DOM/Node imports). Entities are **immutable**: every field is set through
the constructor. Safe, dependency-aware mutation is deferred to the scheduling
engine, which will expose dedicated methods.

- `interface Schedulable` with `effectiveStart(): Date`, `effectiveEnd(): Date`,
  `effectiveDuration(): number` (decimal days).
- `abstract class BaseTaskEntity implements BaseTask, Schedulable` — holds the
  shared identity fields (`id`, `name`, `description?`, `groupId?`) set from a
  `BaseTask` in its constructor and declares the abstract `Schedulable` methods.
  Concrete entities extend it (DRY / OCP / LSP).
- `class TaskEntity extends BaseTaskEntity` — carries `Date`-typed `start?` /
  `end?`, numeric `duration?`. A well-formed task has exactly 2 of the 3
  constraints set; the third endpoint is derived. Rules:
  - `effectiveStart()` → `start` if set, else `end − duration` (calendar days in
    this phase).
  - `effectiveEnd()` → `end` if set, else `start + duration` (calendar days in
    this phase).
  - `effectiveDuration()` → `duration` if defined, else
    `effectiveEnd() − effectiveStart()` in days.
  - Under-constrained tasks (fewer than 2 constraints) are out of scope here;
    their validation lives in the graph-validation spec. If an effective endpoint
    cannot be derived, the accessor throws `UnresolvableScheduleError` (a guard
    that well-formed, validated documents never trigger).
- `class MilestoneEntity extends BaseTaskEntity` — carries `Date` `date`.
  Rules: `effectiveStart()` = `effectiveEnd()` = `date`;
  `effectiveDuration()` = `MILESTONE_DURATION`.
- `class GroupEntity extends BaseTaskEntity` — no static schedule. Rules
  (first-implementation placeholders): `effectiveStart()` = `effectiveEnd()` =
  `new Date(0)` (a deterministic Unix-epoch sentinel); `effectiveDuration()` = `0`.
- `class GanttModel` — in-memory container holding `TaskEntity[]`,
  `MilestoneEntity[]`, `GroupEntity[]`, the plain `Dependency[]`, `version`, and
  the reserved `settings` (working calendar / working-day hours).

> Note on `effectiveStart()`/`effectiveEnd()` derivation: a well-formed task sets
> exactly 2 of {start, duration, end}; the missing endpoint is derived locally
> (`end − duration` or `start + duration`) so both accessors return a `Date`. This
> phase uses calendar-day arithmetic; working-day arithmetic and dependency-driven
> propagation and final resolution belong to the scheduling-engine spec. An under-constrained task
> (fewer than 2 constraints) has no resolvable endpoint; such documents are
> rejected by the graph-validation spec, not here.

**New hydration/serialization service** — new file
`src/services/ganttModelService.ts` (pure; no `vscode`):

- `hydrateDocument(document: GanttDocument): GanttModel` — maps validated plain
  records into entity instances, parsing each ISO date string into a `Date`.
- `toDocument(model: GanttModel): GanttDocument` — projects the model back to a
  plain document (formatting `Date` → ISO string) with parser-matching field
  order, so a parse → hydrate → serialize round-trip is byte-stable. In this
  phase the controller keeps the plain document as its wire/disk buffer, so
  `toDocument` is used for symmetry/tests.

**Shared date util** — new file `src/common/dates.ts` (pure; no `vscode`/DOM/Node
imports), reused by both the entities and the hydrator (DRY / DIP):

- `parseIsoDate(iso: string): Date` = `new Date(iso)` and
  `formatIsoDate(date: Date): string` = `date.toISOString().slice(0, 10)`.
  Because the persisted values are date-only ISO strings (`YYYY-MM-DD`), the
  default `Date` parser interprets them as **UTC midnight** and `toISOString()`
  round-trips them — so no custom UTC construction is needed. Both match the
  `ISO_DATE` (`/^\d{4}-\d{2}-\d{2}$/`) format.
- `addDays(date, days)` and `diffInDays(from, to)` provide the calendar-day
  arithmetic used by `TaskEntity` endpoint derivation and `effectiveDuration`.
- `MS_PER_DAY` lives here as the single source of truth (`task.ts` imports it).

**Schema migration** — `src/services/ganttDocumentMigrationService.ts`:

- Do **not** bump `CURRENT_DOCUMENT_VERSION` (stays `2`).
- Add an **always-run rename pass** (independent of `version`) that normalizes
  legacy field names: `title` → `name` on tasks/milestones, `parentId` → `groupId`
  on groups. Prefer the new name when both are present; drop the legacy key.
- The existing v1 dependency migration is unchanged.

**Parse/validation** — `src/services/ganttDocumentService.ts`:

- `validateTask` / `validateMilestone` read `name`; `validateGroup` reads `groupId`
  (post-migration the legacy names no longer reach the validator).
- `serializeDocument` writes only the new field names.

## 6. Protocol Impact

`src/common/protocol.ts` — **no message-shape change** (field renames propagate
via the shared plain types). `HostToWebview` (`init`,
`documentChanged`, `selectTask`, `editTask`) and `WebviewToHost` (`updateTask`,
`updateMilestone`, …) continue to carry the plain `GanttDocument` / `Task` /
`Milestone` shapes. The `title` → `name` and `parentId` → `groupId` renames
propagate through these payloads because they are the same plain types. The
hydrated `GanttModel` is **never** sent over the wire.

## 7. UX

- Timeline (ECharts) — no behavioral change; bars/markers still read plain
  ISO-string start/end/date. Only the property access renames
  (`task.title` → `task.name`, `milestone.title` → `milestone.name`) in
  `src/webview/GanttChart.tsx`.
- Sidebar tree — no behavioral change; `src/views/sidebar/ganttExplorerProvider.ts`
  updates `group.parentId` → `group.groupId` and `.title` → `.name`; the
  root-group filter and labels are otherwise unchanged.
- Edit form — no behavioral change; `src/webview/TaskForm.tsx` binds
  `draft.title` → `draft.name`.

Design rationale (values → principles → moves): Value **Consistency** · Principle:
one shared identity/labeling shape across entity kinds · Move: unify the display
name behind `BaseTask.name` so the tree, timeline, and form read the same field.
No new user-facing strings are introduced (rename is internal); no localization
changes.

## 8. Test Strategy

- Unit (models/entities) — new `src/test/ganttModelService.test.ts`:
  - `hydrateDocument` produces `Date`-typed fields for tasks/milestones.
  - `TaskEntity.effectiveDuration()` for `start+end` (`end − start`) and for
    `start+duration` (user value).
  - `MilestoneEntity` start/end alias `date`; duration = `MILESTONE_DURATION`.
  - `GroupEntity` placeholder `effective*` behavior.
  - `parseIsoDate` / `formatIsoDate` round-trip; UTC-midnight parsing avoids
    off-by-one across timezones.
  - parse → hydrate → serialize round-trip stability.
- Unit (services) — `src/test/ganttDocumentMigrationService.test.ts`: legacy
  `title` → `name` and `parentId` → `groupId` rename; new names pass through
  unchanged; both-present prefers new; version stays `2`.
- Unit (services) — `src/test/ganttDocumentService.test.ts`: validation/serialize
  use new field names; multi-line `description` round-trips.
- Integration (editor) — `src/test/extension.test.ts`: controller builds a
  `GanttModel` on reparse; upsert/serialize path still writes valid, renamed JSON.
- Coverage: branch coverage stays ≥ 90%, covering the duration branches
  (`duration` set vs derived) and the migration prefer-new / fall-back-to-legacy
  branches.

## 9. Risks & Decisions

### Risk Decisions

- 🟡 Medium — Risk: `Date` cannot cross the webview boundary (`postMessage` /
  structured-clone-to-JSON strips it) and class methods do not survive
  serialization. Decision: accept with mitigation. Mitigation: the OO/`Date` model
  is host-in-memory only; the wire and disk stay plain ISO-string JSON, and the
  webview keeps its existing string-based free functions.
- 🟡 Medium — Risk: renaming without a version bump means both old and new field
  names can appear on disk. Decision: accept (no version bump) with mitigation.
  Rationale: unlike the dependency-type-rename (which swapped `sourceId`/`targetId`
  semantics and so required a versioned, one-shot migration), this is a pure key
  rename with no meaning change, so an **idempotent always-run pass** is safe and
  avoids churning the schema version. Mitigation: the always-run rename pass in the
  migration service accepts both names (prefers new); the serializer writes only
  new names, so files self-heal on the next save. Covered by both-present and
  legacy round-trip tests.
- 🟢 Low — Risk: parsing `YYYY-MM-DD` shifts the day across timezones. Decision:
  reduced. Rationale: date-only ISO strings are parsed as **UTC midnight** by the
  default `Date` constructor, and `toISOString().slice(0, 10)` formats back in UTC,
  so no custom UTC construction is needed; guarded by a timezone round-trip test.
- 🟢 Low — Risk: `Schedulable.effectiveStart()/effectiveEnd()` are typed `Date`
  but an under-constrained task has no resolvable endpoint. Decision: accept.
  Rationale: a well-formed task sets exactly 2 constraints, so the missing endpoint
  is always derivable (`end − duration` / `start + duration`); under-constrained
  documents are rejected by the graph-validation spec, not here. Full resolution is deferred to the scheduling-engine spec.

### Open Question Resolution

- 🟢 Low — Question: should the editor controller switch its in-memory source of
  truth to `GanttModel`, or keep the plain document as the buffer? Resolution:
  keep the plain document as the buffer this phase and build `GanttModel` as a
  **derived view on reparse**. Rationale: minimal wire/disk disruption while
  establishing the OO model in the load path.
- 🔵 Nice to have — Question: where should the ISO↔`Date` helpers live?
  Resolution: **implemented in a shared pure `src/common/dates.ts`** module
  (`parseIsoDate`, `formatIsoDate`, `addDays`, `diffInDays`, `MS_PER_DAY`), reused
  by both the entity classes and the hydrator so the calendar-day arithmetic is
  not duplicated (DRY / DIP). The model files stay pure declarations.

## 10. Review Outcome

- Spec is implementation-ready and remains at `Implementing` before PR.
- Findings resolved:
  - 🔴 Version bump vs precedent — decision recorded to **keep no version bump**
    with an idempotent always-run rename pass; rationale added contrasting it with
    the id-swapping dependency-type-rename migration (§9).
  - 🔴 AC #1 over-claim — task `effectiveStart()`/`effectiveEnd()` now **derive**
    the missing endpoint (`end − duration` / `start + duration`); AC #1 qualified
    to well-formed (exactly-2-constraint) tasks, and new start+duration /
    end+duration criteria added (§4, §5).
  - 🟡 `GroupEntity` placeholder — changed from `Date.now()` to a deterministic
    Unix-epoch sentinel with `effectiveDuration()` = `0` (§4, §5).
  - 🟡 Naming divergence — this spec keeps `effectiveStart()/effectiveEnd()`; the
    scheduling-engine spec was aligned to the same names and now states it computes
    the `Schedulable` values on the `GanttModel` entities.
  - 🟡 Open questions — both resolved with explicit decisions (§9).
  - 🟢 Low items — calendar- vs working-day note, free-function/method name
    collision note, `BaseTask.groupId` parent-group clarification, and §6 wording
    all addressed.
- Date handling: dates persist as date-only ISO strings (UTC midnight); the
  default `Date` parser/serializer is used (no custom UTC math).
