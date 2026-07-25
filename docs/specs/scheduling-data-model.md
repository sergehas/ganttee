# Feature: Scheduling Data Model (constraints, duration, effective accessors)

> Status: Reviewed · Owner: Copilot · Last updated: 2026-07-20

## 1. Summary

Introduce the constraint-based scheduling data model: a task is defined by exactly
2 of {start date, duration, end date}; milestones fix `duration = 0` with a single
`date`; groups carry no static schedule. Add the `effective*` computed-value
concept (values populated by the scheduling engine) and a user-set `duration`
field. This spec defines shapes, invariants, and the schema migration — not the
computation.

## 2. Goals / Non-goals

### Goals

- Add `duration` (decimal **working** days) to `Task`; make `start`/`end` optional
  user inputs.
- Define the "exactly 2 constraints" invariant at the type/validation boundary.
- Define the `effective*` accessor shape and the `effectiveDuration` derivation.
- Fix milestone (`duration=0`, `date` alias) and group (effective-only) shapes.
- Add a project-level working-calendar placeholder (Saturday/Sunday off, fixed for
  now; per-week configuration deferred to a future requirement).
- Bump schema version and migrate legacy documents (start+end → start+end
  constraint pair, duration derived).

### Non-goals

- Cycle/determinacy/anchor validation logic (see graph-validation spec).
- Effective-date computation, propagation, rollup (see scheduling-engine spec).
- Dependency-type rename (see dependency-type-rename spec — prerequisite).

## 3. User Stories

- As a planner, I want to set a task by start+duration (not just start+end), so
  that durations drive the schedule.
- As a developer, I want computed `effective*` values kept separate from user
  input, so that the source of truth is unambiguous.

## 4. Acceptance Criteria

- Given a task with any 2 of {start, duration, end} set
  When the model is constructed
  Then it is accepted and the third value is marked derived.

- Given a task with all 3 set
  When the constraint-descriptor helper is evaluated
  Then it returns status `hyperstatic` (validation surfacing lives in the
  graph-validation spec).

- Given a task with fewer than 2 set
  When the constraint-descriptor helper is evaluated
  Then it returns status `underConstrained`.

- Given a task defined by start + end
  When `effectiveDuration` is read
  Then it equals `end − start`.

- Given a milestone
  When constructed
  Then `duration` is 0 and `start`/`end` both alias `date`; setting a non-zero
  duration is rejected.

- Given a legacy v1 task with start+end
  When migrated
  Then it maps to the start+end constraint pair with duration derived, round-trip
  stable.

## 5. Domain & Data Model Impact

- `src/common/models/task.ts`:
  - `Task`: `start?`, `end?` become optional; add `duration?: number` (decimal
    working days); document the "exactly 2 constraints" invariant.
  - `Milestone`: enforce `duration = 0`; `date` canonical; helpers for start/end
    aliases.
  - `Group`: remains static-date-free; document its effective-only role.
  - Add a pure constraint-descriptor helper (which 2 are set) in `src/services/`;
    it is not persisted.
- `.ganttee` schema: do not bump `CURRENT_DOCUMENT_VERSION` in
  `src/common/models/document.ts`; add migration process to existing one in `src/services/ganttDocumentService.ts`.
  Reserve (but do not yet populate) a project-level working-calendar field;
  scheduling uses a fixed Saturday/Sunday-off calendar until the future
  configuration requirement lands.
  Reserve (but do not yet populate) a project-level working-day-hours (hour per day) field;
  scheduling ignore it until the future configuration requirement lands.

## 6. Protocol Impact

- `src/common/protocol.ts`: `updateTask`/`updateMilestone` payloads reflect the new
  optional fields and `duration`. Exhaustive `type` handling retained.

## 7. UX

- Timeline (ECharts): no structural change; bars still read start→end (effective).
- Sidebar tree: no structural change.
- Edit form: the task panel lets the user pick any 2 constraints (start /
  duration / end); the third shows as derived/read-only. The milestone panel shows
  a single `date`.

Design rationale (values → principles → moves): Value Clarity · Principle: input
vs computed must be visually distinct · Move: derived field rendered read-only with
a subtle "computed" affordance.

New localized strings: a "computed" / derived-field label for the read-only
affordance, and a rejection message for setting a non-zero duration on a
milestone. Both externalized via `vscode.l10n.t()` with `{0}` placeholders.

## 8. Test Strategy

- Unit (models/services): constraint-descriptor helper for all valid/invalid
  combinations; `effectiveDuration` derivation for start+end; milestone invariants;
  migration.
- Integration: update messages accept the new optional fields.
- Webview interaction: form enforces exactly-2 selection; derived field read-only.
- Coverage: branch coverage ≥ 90% across constraint combinations.

## 9. Risks & Open Questions

- 🟡 Medium — Risk: optional start/end ripples into existing timeline code
  that assumes both are set.
  Treatment: timeline code reads through the always-populated `effective*`
  accessors rather than the raw optional user inputs; the derived and
  under-constrained branches are covered by tests before the model change lands.
- 🟢 Low — Open question: fractional working-day arithmetic convention.
  Resolution: deferred to the scheduling-engine spec (a computation concern),
  referenced here only as a pointer.

### Open Question Resolution

- 🟢 Low — Question: does a user-set static date (task `start`/`end`,
  milestone `date`) that falls on a non-working day stay as-is or snap forward
  to the next working day?
  Resolution: it is stored as-is (no snap). The stored value is the user's
  source of truth; the scheduling engine applies working-day interpretation on
  read via the `effective*` accessors.
  Rationale: keeps persisted input lossless and unambiguous, and confines
  calendar semantics to the engine.

## 10. Review Outcome

- Status is `Reviewed`.
- Resolved the non-working-day open question at the data-model boundary
  (store-as-is; engine interprets on read); deferred only the fractional
  working-day arithmetic to the scheduling-engine spec.
- Added a treatment for the optional start/end timeline-ripple risk (read via
  `effective*`; branch tests before the change).
- Tightened the hyperstatic / under-constrained acceptance criteria to assert an
  explicit constraint-descriptor status, making them independently testable.
- Noted the new localized strings (derived/computed label; milestone non-zero
  duration rejection).
- No layer-boundary or schema-migration gaps found: `version` bump + migration
  are specified and `common`/`services` stay `vscode`-free.
