---
Status: Draft
Owner: Copilot
Last updated: 2026-09-22
Related ADRs: none yet
---

# Feature: Scheduling holidays

![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)

## 1. Summary

Project planners need scheduling to treat declared holidays as non-working time. This feature makes
the existing project-level inclusive holiday ranges part of working-time arithmetic, so effective
task, milestone, and group dates skip holidays while authored dates in the `.ganttee` document stay
unchanged.

## 2. Goals / Non-goals

### Goals

- Skip inclusive project holiday ranges during normalization, forward traversal, reverse traversal,
  and working-time duration calculations.
- Preserve existing days-off, working-hours, UTC, and fractional-duration behavior.
- Validate impossible calendars before date traversal can loop indefinitely.
- Define behavior for working intervals that cross midnight.
- Keep host-computed effective schedules consistent across chart, sidebar, and edit surfaces.

### Non-goals

- Adding a project-settings editor or holiday-management command.
- Changing the `.ganttee` document schema or adding a new host-webview message.
- Rendering new holiday indicators. Existing chart holiday shading remains a separate view concern.
- Changing authored task, milestone, or dependency dates.

## 3. Epic

Deliver holiday-aware project scheduling so planners can declare non-working date ranges and receive
effective schedules that consume working time only on eligible calendar intervals.

## 4. User Stories & Acceptance Criteria

- As a planner, I want holiday dates skipped when tasks are scheduled, so that planned work does not
  occur during project holidays.
  - Given a task starts before an inclusive holiday range and has duration spanning that range When
    the host schedules the project Then the effective end skips every holiday date in the range.
  - Given a task starts on a holiday When the host schedules the project Then its effective start is
    normalized to the next eligible working interval.
  - Given a task ends on a holiday and is end-anchored When the host schedules the project Then
    reverse traversal skips the holiday and computes an eligible effective start.

- As a planner, I want holiday handling to match configured days off, so that calendar rules remain
  predictable.
  - Given a holiday range overlaps configured days off When a task is scheduled Then overlapping
    dates are skipped once and no extra duration is removed.
  - Given no holidays are configured When a project is scheduled Then results match existing
    days-off-only scheduling.
  - Given adjacent or overlapping holiday ranges When a project is scheduled Then their union is
    treated as one non-working span.

- As a planner, I want fractional durations to respect holidays, so that partial working days remain
  accurate.
  - Given a task starts inside an eligible working interval and its fractional duration reaches a
    holiday When scheduled Then remaining interval time is consumed before the holiday and the
    balance resumes at the next eligible interval without rounding.
  - Given a task has explicit start and end values spanning holidays When scheduled Then authored
    endpoint values remain unchanged, while effective duration counts eligible working time only.

- As a planner, I want overnight working intervals to behave consistently, so that valid calendars
  do not lose work after midnight.
  - Given a working interval starts at 20:00 UTC and lasts 8 hours When scheduling reaches 02:00 UTC
    on the following date Then that timestamp belongs to the interval that started on the previous
    working date.
  - Given an overnight interval starts on a holiday When scheduling traverses that interval Then the
    complete interval is skipped.
  - Given a holiday is only declared for the calendar date after an overnight interval starts When
    scheduling traverses the interval Then the interval remains eligible because holiday ownership
    is the interval start date.

- As a planner, I want invalid calendars rejected clearly, so that scheduling cannot hang or produce
  misleading dates.
  - Given all seven ISO weekdays are configured as days off When the document is validated Then
    `scheduleGraphValidationService` reports a blocking diagnostic before the edit is written and no
    schedule is produced.
  - Given a holiday range has an invalid date or its end precedes its start When the document is
    validated Then document-shape validation rejects the document with a localized diagnostic and no
    schedule is produced.
  - Given working hours or start values cannot produce a valid interval When the document is
    validated Then `scheduleGraphValidationService` reports a blocking diagnostic before the edit is
    written and no schedule is produced.
  - Given an already-validated document is scheduled and its calendar is nonetheless impossible When
    `schedulingService` runs Then it raises a scheduling error as a defensive last resort, matching
    its existing guard behavior.

- As a planner, I want every schedule consumer to receive the same holiday-aware result, so that
  chart, sidebar, and forms do not disagree.
  - Given a valid holiday setting is persisted and the document is reparsed When the host schedules
    the project Then it broadcasts the resulting effective schedule through the existing document
    update flow.
  - Given a `.ganttee` document contains valid holiday settings When the host opens or reparses the
    document Then it recomputes the schedule from document data rather than applying a webview-only
    adjustment.

## 5. Business Rules

- `ProjectSettings.holidays` is an inclusive list of UTC date-only ranges.
- A holiday date uses the exact same day-boundary and interval arithmetic as a configured day off —
  no new time math is introduced. A holiday range spanning N consecutive dates is computed
  identically to N consecutive dates being configured as days off, including for overnight-interval
  ownership.
- A date is non-working when it is a configured day off, covered by a holiday range, or both; for
  scheduling purposes a holiday date is indistinguishable from that same date being a day off, even
  though the two remain distinct persisted concepts in `ProjectSettings`.
- Overlapping and adjacent holiday ranges have the same effect as their union.
- A date is eligible only when it is not non-working per the rule above.
- Forward and reverse working-time traversal, normalization, and working-time difference use one
  shared non-working-date check for both `daysOff` and `holidays`; there is no separate holiday
  traversal path.
- A working interval is owned by its start calendar date. An overnight interval may continue into
  the next date, but its holiday and weekday status comes from its owner date.
- `workingDayStart` remains in `[0, 24)` and `workingDayHours` remains greater than `0` and no
  greater than `24`; intervals may cross midnight when their sum exceeds `24`.
- `scheduleGraphValidationService` reports impossible-calendar conditions (all seven weekdays
  unavailable, and working-hours/start values that cannot produce a valid interval) as blocking
  `ScheduleDiagnostic`s, checked before a document edit is written — the same pre-write gate already
  used for other semantic scheduling rules.
- Document-shape validation rejects malformed holiday ranges before hydration.
- `schedulingService`'s internal calendar guard is a defensive last resort for an already-validated
  document; it is not the primary rejection path.
- Invalid holiday ranges and invalid working-time settings prevent schedule publication; no partial
  schedule is exposed.
- Authored date fields remain unchanged. Holiday-aware values exist only in computed effective
  schedules.
- The host remains the sole scheduler. The webview consumes the host result and does not calculate
  holiday-aware dates.
- Pure validation and scheduling services expose stable error categories without importing `vscode`.
- Host presentation maps error categories to localized diagnostic strings through the existing
  localization framework.

## 6. Domain & Data Model Impact

- `src/common/dates.ts`: extend `WorkingTimeSettings` with normalized holiday ranges folded into the
  same non-working-date check already used for `daysOff`. All date traversal helpers (normalization,
  forward/reverse traversal, working-time difference, overnight-interval ownership) consume that one
  check; no separate holiday arithmetic is added.
- `src/common/documents/project/projectSettings.ts`: retain existing inclusive `holidays` data and
  document its scheduling meaning rather than adding a second holiday shape.
- `src/services/schedule/scheduleGraphValidationService.ts`: add the impossible-calendar check (all
  seven weekdays off, invalid working hours/start) as a blocking `ScheduleDiagnostic`, evaluated
  pre-write alongside existing semantic scheduling diagnostics.
- `src/services/schedule/schedulingService.ts`: pass holidays into working-time arithmetic through
  the shared non-working-date check. Its internal calendar guard remains only a defensive last
  resort for an already-validated document, consistent with its current `SchedulingError` fallback
  role; it is no longer the primary rejection path.
- `src/services/document/documentShapeValidationService.ts`: retain shape/date/range validation and
  report malformed holiday ranges before hydration. Return stable validation error categories for
  host presentation.
- `.ganttee` schema: no change. `holidays` already exists in document version `2`; no
  `CURRENT_DOCUMENT_VERSION` bump or migration is required.
- Effective schedule values remain derived and are not persisted.

## 7. Protocol Impact

- No new `HostToWebview` or `WebviewToHost` messages.
- Existing `init` and `documentChanged` presentation messages continue carrying project settings and
  host-computed effective schedule.
- Any future holiday editor must submit a document edit through the existing host-owned workflow; it
  must not introduce a webview-only schedule mutation.

## 8. UX

- Timeline (ECharts): preserve current holiday shading and visibility control. Holiday-aware
  effective dates move bars through the existing schedule data; this feature adds no new visual
  layer.
- Sidebar tree: consume the same host-computed effective dates. No new tree nodes or controls.
- Edit form: task and milestone forms keep authored date behavior. Project holiday editing is out of
  scope for this epic.
- Design intent: **Calm** and **Consistent**. Keep holiday semantics visible through existing
  calendar data and shared schedule results, avoiding duplicate controls or competing timeline
  annotations.

## 9. Test Strategy

- Unit (models/services): test holiday range normalization, inclusive boundaries, overlapping and
  adjacent ranges, days-off overlap, forward and reverse traversal, fractional durations, explicit
  start/end duration differences, overnight intervals, holiday-owned overnight intervals, and
  impossible calendars.
- Validation tests: cover malformed holiday dates, reversed ranges, and unsupported values in
  document-shape validation; cover all-weekdays-off, invalid working hours, and invalid working-day
  starts as blocking diagnostics in `scheduleGraphValidationService`.
- Defensive-guard tests: confirm `schedulingService`'s internal calendar guard still rejects an
  impossible calendar if reached directly, without duplicating the diagnostic's own test matrix.
- Scheduling integration: verify host reparse and schedule publication after valid document changes,
  rejection without partial results, and unchanged authored dates.
- Localization: verify host diagnostics map malformed holiday and impossible-calendar error
  categories to localized strings while pure services remain free of `vscode` imports.
- Existing chart/webview tests: confirm holiday visibility behavior remains unchanged and effective
  schedule values are consumed without local date recomputation.
- Regression tests: run current scheduling, document round-trip, model hydration, and protocol
  presentation suites with empty holidays.
- Coverage: branch coverage remains at least 90% for each changed file or class.

## 10. Risks

- 🔴 **R-01** — Overnight intervals require interval lookup to consider a prior-date interval while
  preserving one owner date; an incorrect boundary can double-count or omit midnight work.
  - Status: **Open**
- 🟡 **R-02** — Large holiday ranges can make repeated date eligibility checks expensive during long
  schedules.
  - Status: **Open**
- 🟡 **R-03** — Validation and scheduling may diverge if they use different date-only parsing or
  range-inclusion rules.
  - Status: **Resolved** — impossible-calendar rejection now lives solely in
    `scheduleGraphValidationService`, and both it and `schedulingService`'s defensive guard consume
    the same shared non-working-date check in `src/common/dates.ts`, removing the second
    implementation that could diverge.

## 11. Open Questions

- 🟡 **Q-01** — Should a future project-settings editor be part of this capability or a separate
  feature after scheduling semantics ship?
  - Status: **Open**
- 🟢 **Q-02** — Should the timeline later distinguish holiday shading from configured days-off
  shading, or remain a single non-working-calendar presentation?
  - Status: **Open**
