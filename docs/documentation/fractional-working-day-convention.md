# Fractional Working-Day Convention

## Scope and settings

- Effective values use the existing names: `effectiveStart`, `effectiveEnd`,
  and `effectiveDuration`.
- Persisted task inputs remain `start`, `end`, and `duration`. Effective values
  are computed in memory and are not written to the `.ganttee` file.
- Settings are part of document version 2. No version bump is required:

  ```jsonc
  {
    "settings": {
      "workingCalendar": { "daysOff": [] },
      "workingDayHours": 8.0,
      "workingDayStart": 9.0,
    },
  }
  ```

- `workingDayStart` is decimal hours in the range `[0, 24)`. For example,
  `8.5` means 08:30 UTC. Its default is `9.0`.
- `workingDayHours` is a positive number no greater than 24. Its default is
  `8.0`.
- `daysOff` contains ISO weekday numbers (`1` = Monday, `7` = Sunday). An
  omitted or empty list means every day is working.
- All timestamps and working-day boundaries use UTC. No configurable timezone
  is stored in the document.

## Time representation

- Effective dates are UTC date-times represented as JavaScript `Date` objects
  during scheduling. This convention does not define their wire or disk
  serialization.
- Date-only inputs are interpreted at `00:00:00Z`; a static `start` is normally
  placed at `workingDayStart` on that date.
- Scheduling traverses working intervals, not calendar milliseconds. Epoch
  milliseconds are suitable for the internal representation and comparisons.
- The implementation may use `Temporal.Instant` and `Temporal.ZonedDateTime`
  with the UTC time zone. If the runtime does not provide Temporal, use the
  project's compatible polyfill. The arithmetic layer must still expose epoch
  millisecond values to the scheduling service.

## Working intervals

- A working interval is:
  - start: `workingDayStart`;
  - end: `workingDayStart + workingDayHours`;
  - only on a weekday not listed in `daysOff`.
- A duration is measured in working days. A fractional part consumes the same
  fraction of `workingDayHours`.
- Traversal consumes only time inside working intervals. Crossing an interval
  end continues at the next working-day start, skipping `daysOff`.
- A positive two-working-day task that starts Tuesday at 08:30 and uses an
  eight-hour working day ends Wednesday at 16:30.
- A zero-duration task is invalid. Milestones remain zero-duration.

Illustrative arithmetic for a full-day-aligned start:

```text
start = Tuesday 08:30Z
duration = 2.0 working days
end = Wednesday 16:30Z
```

## Boundary normalization

- A timestamp before the working interval is normalized to that day's working
  start.
- A timestamp at or after the working interval end is normalized to the next
  working day's start.
- A timestamp on a `daysOff` date is normalized to the next working day's start.
- A timestamp inside the interval is preserved, including its fractional
  position.
- Static date values are retained as entered in the source document; only the
  effective value is normalized for scheduling.

## Dependency-derived endpoints

The source is the constrained successor and the target supplies the reference
date.

- `source startAfter target`:
  - candidate start is `target.effectiveEnd` when it is inside the working
    interval;
  - candidate start is the next working-day start when the target ends at or
    after the interval end;
  - multiple candidates use the maximum timestamp.
- `source startWith target`: candidate start is `target.effectiveStart`.
- `source endWith target`: candidate end is `target.effectiveEnd`.
- `startWith` and `endWith` preserve the target timestamp. Multiple candidates
  use the maximum timestamp, consistent with the scheduling specification.
- After dependency candidates are collected, the complementary endpoint is
  computed by working-time traversal and the entity's effective duration.

## Fractional start and duration

- A start inside a working interval consumes the remaining time in that
  interval before subsequent full working intervals are counted.
- Example with an eight-hour day from 09:30 to 17:30:
  - start: Tuesday 14:30 UTC;
  - duration: `2.5` working days;
  - remaining Tuesday capacity: `3` hours (`0.375` working day);
  - consume the remaining Tuesday, then two full working days and one hour;
  - end: Friday 10:30 UTC.
- No extra duration is added for time before the effective start. The elapsed
  working time consumed is exactly the requested duration.

## Invalid scheduling input

- Validation reports under-constrained items as errors. Such an item
  is not supposed to reach scheduling.
- Negative duration, reversed effective endpoints, invalid settings, and
  non-finite numeric values are scheduling errors.
- When a scheduling error is encountered, the service raises a typed scheduling
  error and returns no partial schedule.
