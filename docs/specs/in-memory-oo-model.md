# Feature: In-memory object-oriented model (Schedulable / BaseTask, Date-typed)

> Status: Draft · Owner: Copilot · Last updated: 2026-07-26

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

- Given a valid `.ganttee` document with tasks, milestones, and groups
  When it is loaded and hydrated
  Then a `GanttModel` is produced whose entities implement `BaseTask` +
  `Schedulable`, and every schedule attribute (`start`, `end`, milestone `date`,
  and the `effective*` results) is a `Date` instance.

- Given a task with `start` and `end` set
  When `effectiveStart()` / `effectiveEnd()` are read
  Then they return `Date` objects equal to the parsed `start` / `end`, and
  `effectiveDuration()` returns `end − start` in decimal days.

- Given a task with `start` and `duration` set (no `end`)
  When `effectiveDuration()` is read
  Then it returns the user-set `duration` value.

- Given a milestone with `date`
  When `effectiveStart()`, `effectiveEnd()`, and `effectiveDuration()` are read
  Then start and end both equal the parsed `date`, and duration equals
  `MILESTONE_DURATION` (0).

- Given a group
  When `effectiveStart()` / `effectiveEnd()` are read
  Then both return the current time (`Date.now()`) as a placeholder, and
  `effectiveDuration()` is the placeholder difference (0) — flagged for
  replacement by the scheduling engine.

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
    for the webview, now reading the renamed fields (still string-based).

**New `BaseTask` interface** (shared shape) in `src/common/models/`:

- `id: string`
- `name: string`
- `description?: string` (may contain multi-line text; no special handling needed —
  JSON escapes newlines)
- `groupId?: string`

`Task`, `Milestone`, and `Group` extend `BaseTask`.

**New OO domain layer** — new file `src/common/models/entities.ts` (pure; no
`vscode`/DOM/Node imports):

- `interface Schedulable` with `effectiveStart(): Date`, `effectiveEnd(): Date`,
  `effectiveDuration(): number` (decimal days).
- `class TaskEntity implements BaseTask, Schedulable` — carries `Date`-typed
  `start?` / `end?`, numeric `duration?`. Rules:
  - `effectiveStart()` → `start`; `effectiveEnd()` → `end`.
  - `effectiveDuration()` → `duration` if defined, else
    `effectiveEnd() − effectiveStart()` in days.
- `class MilestoneEntity implements BaseTask, Schedulable` — carries `Date` `date`.
  Rules: `effectiveStart()` = `effectiveEnd()` = `date`;
  `effectiveDuration()` = `MILESTONE_DURATION`.
- `class GroupEntity implements BaseTask, Schedulable` — no static schedule. Rules
  (first-implementation placeholders): `effectiveStart()` = `effectiveEnd()` =
  `new Date()` (i.e. `Date.now()`); `effectiveDuration()` = placeholder difference.
- `class GanttModel` — in-memory container holding `TaskEntity[]`,
  `MilestoneEntity[]`, `GroupEntity[]`, the plain `Dependency[]`, `version`, and
  the reserved `workingCalendar` / `workingDayHours`.

> Note on `effectiveStart()`/`effectiveEnd()` for a task lacking that endpoint:
> until scheduling lands, an unset endpoint has no `Date`. The first
> implementation returns the user-set value and treats a missing endpoint as
> undefined at the type level (methods typed `Date`, but the entity documents that
> an under-constrained task's endpoints are not yet resolvable). Final resolution
> belongs to the scheduling-engine spec.

**New hydration/serialization service** — new file
`src/services/ganttModelService.ts` (pure; no `vscode`):

- `hydrateDocument(document: GanttDocument): GanttModel` — maps validated plain
  records into entity instances, parsing each ISO date string into a `Date`.
- Date helpers: `parseIsoDate(iso: string): Date` (parse as **UTC midnight** to
  avoid timezone drift) and `formatIsoDate(date: Date): string`
  (`date.toISOString().slice(0, 10)`), matching the `ISO_DATE`
  (`/^\d{4}-\d{2}-\d{2}$/`) format.
- Optionally `toDocument(model: GanttModel): GanttDocument` for a full round-trip;
  in this phase the controller keeps the plain document as its wire/disk buffer, so
  `toDocument` is provided for symmetry/tests.

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

`src/common/protocol.ts` — **no structural change.** `HostToWebview` (`init`,
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

## 9. Risks & Open Questions

- 🟡 Medium — Risk: `Date` cannot cross the webview boundary (`postMessage` /
  structured-clone-to-JSON strips it) and class methods do not survive
  serialization. Treatment: the OO/`Date` model is host-in-memory only; the wire
  and disk stay plain ISO-string JSON, and the webview keeps its existing
  string-based free functions.
- 🟡 Medium — Risk: parsing `YYYY-MM-DD` in local time shifts the day across
  timezones. Treatment: parse as **UTC midnight** and format via
  `toISOString().slice(0, 10)`; covered by a timezone round-trip test.
- 🟡 Medium — Risk: renaming without a version bump means both old and new field
  names can appear on disk. Treatment: an always-run rename pass in the migration
  service accepts both (prefers new); the serializer writes only new names, so
  files self-heal on the next save.
- 🟢 Low — Risk: `Schedulable.effectiveStart()/effectiveEnd()` are typed `Date`
  but an under-constrained task has no resolvable endpoint yet. Treatment:
  first-implementation returns user-set values only; full resolution is deferred
  to the scheduling-engine spec, which owns computed endpoints.
- 🟢 Low — Open question: should the editor controller fully switch its in-memory
  source of truth to `GanttModel` (dehydrating for wire/disk) now, or keep the
  plain document as the buffer and treat `GanttModel` as a derived view? Proposed:
  keep the plain document as the buffer this phase (minimal wire disruption) and
  build `GanttModel` as a derived view on reparse.
- 🔵 Nice to have — Open question: should ISO↔`Date` helpers live in
  `ganttModelService.ts` or a shared `common/models` date util? Proposed: keep them
  in `ganttModelService.ts` so model files stay pure declarations; promote later if
  reused.
