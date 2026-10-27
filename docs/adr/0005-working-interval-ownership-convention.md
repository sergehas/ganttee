---
Status: accepted
---

# Working interval ownership uses a half-open, start-date-owned convention

## Context

Scheduling holidays introduces overnight working intervals (an interval whose end crosses midnight
UTC) alongside the existing days-off and new holiday non-working checks. Every date-traversal helper
(`normalizeToWorkingTime`, forward/reverse working-day traversal, working-time difference) must
agree on exactly which calendar date "owns" a given instant, and on what happens to an instant that
falls precisely on an interval boundary. Getting this wrong either double-counts or silently drops
working time across midnight, and the same ambiguity would let a holiday declared on the "wrong"
side of an overnight interval unintentionally skip or fail to skip that interval. Because every
future date-arithmetic change depends on this contract, and picking the wrong convention only
surfaces as a subtle off-by-one at runtime, the convention is recorded here rather than left
implicit in each call site.

## Decision

A working interval is **owned by its start calendar date**, and interval containment is
**half-open**: an instant belongs to an interval when `start <= instant < end`. An instant exactly
at `end` belongs to the _next_ interval, never the one that just closed. One shared function maps
any instant to its owning interval's start date; every non-working check (`daysOff`, `holidays`) and
every traversal helper (forward, reverse, normalization, working-time difference) consults that same
function so there is exactly one place the boundary logic can be wrong. A holiday declared for a
given calendar date suppresses the entire interval owned by that date, including one that continues
past midnight.

## Considered Options

### Closed interval (`start <= instant <= end`)

Rejected. A closed interval makes the instant exactly at `end` ambiguous between the closing
interval and the next one, which is exactly the double-counting failure mode this decision exists to
prevent.

### Owned by the calendar date containing the instant's clock time

Rejected. For an overnight interval (e.g. 20:00–04:00 UTC), the portion after midnight would then be
owned by the following date. A holiday declared only on the start date would fail to suppress the
post-midnight portion of the same interval, contradicting the requirement that a holiday-owned
overnight interval is skipped in full.

### Per-call-site boundary logic (no shared function)

Rejected. Duplicating boundary comparisons in each traversal helper is exactly the kind of
divergence already flagged by R-03 in the scheduling-holidays spec; a shared function is the only
way to guarantee every consumer agrees.

## Consequences

Positive consequences:

- One boundary contract, one implementation, and one set of boundary tests (`start`, `start - 1ms`,
  `end - 1ms`, `end`) cover every traversal helper.
- Holidays and days off compose correctly with overnight intervals without special-casing.

Trade-offs:

- Changing this convention later requires touching every date-traversal helper and re-verifying all
  boundary tests, since it is depended on throughout `src/common/dates.ts`.
