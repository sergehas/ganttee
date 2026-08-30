# fractional working-day convention

## Prerequisites

- in ganttee document, add a new properties in settings :

  ```jsonc
    "settings": {
      "workingCalendar": {
        "daysOff": [/*no change*/]
      },
      "workingDayHours": 7.0, //no change
      "workingDayStart": 8.5, // new property : time the working day start,
                            // in 24h decimal format: 8.5 means '08.30 AM"
                            // optional when loading document, default to 9.0
      "workingTimezone": "UTC", //new property, define the timezone for tasks.. not sure it is useful
    }
  ```

- do not bump document version, assume these attributes are part of the document V2 format

## effective start / end computation basics

- effective dates are always full date + time
- for a task defined with `"startDate": "2026-08-25", "duration" : 2`, then
  - its `effectiveStartDate` is the _`startDate + workingDayStart`_ so `"2026-08-25 00:00:00" + 8.5 hours = "2026-08-25 08:30:00"`
  - its `effectiveEndDate` is _`effectiveStartDate + duration (in days)`_ so "2026-08-25 08:30:00" + (2-1) days + workingDayHours (decimal) = "2026-08-27 08:30:00"
- all duration / date offset should be computed with epochs( milliseconds) for performance matter

  principle illustration snippet

  ```javascript
  /**
   * this code is for illustration purpose only as it does not consider 'workingCalendar.daysOff',
   * nor the case where the effectiveStart is inferred from dependencies
   */

  // from task / milestone
  const startDate = new Date("2026-08-25");
  const duration = 2.0;
  // from settings
  const workingDayHours = 8.0;
  const workingDayStart = 9.5;

  const HOUR_TO_MS = 1000 * 60 * 60;
  const DAY_TO_MS = HOUR_TO_MS * 24;

  const effectiveStart = new Date(
    startDate.getTime() + HOUR_TO_MS * workingDayStart,
  );

  let durationDays = Math.trunc(duration);
  let durationFraction = duration - durationDays; //decimal day fraction

  //days to add to the date
  const fullDays =
    durationFraction > 0 ? durationDays : Math.max(0, durationDays - 1);
  //hours to add to the ending day
  const fracDays = durationFraction > 0 ? durationFraction : 1;

  const effectiveEnd = new Date(
    effectiveStart.getTime() +
      fullDays * DAY_TO_MS +
      fracDays * workingDayHours * HOUR_TO_MS,
  );

  console.log(effectiveStart.toISOString());
  console.log(effectiveEnd.toISOString());
  ```

## Inferring start and end dates

### with `startAfter`

when the current task `startAfter` another, then the current task `effectiveStart` (for this dependency) computation rule is :

- if `target.effectiveEnd` is greater or equals to `endOfWorkingDay(target.effectiveEnd)`, then `source.effectiveStart=startOfWorkingDay(target.effectiveEnd + 1 day)`
  else `source.effectiveStart=target.effectiveEnd`, with

  ```javascript
  // returns end of working date for a given date, considering settings workingDayHours & workingDayStart
  endOfWorkingDay(date:Date): Date {
    return new Date(date.getYear(), date.getMonth(), date.getDate(), 0, 0, 0, (workingDayStart+workingDayHours)*HOUR_TO_MS)
  }

  // returns start of working date for a given date, considering settings workingDayStart
  startOfWorkingDay(date:Date): Date {
    return new Date(date.getYear(), date.getMonth(), date.getDate(), 0, 0, 0, workingDayStart*HOUR_TO_MS)
  }
  ```

- as inferred `effectiveStart`

### with `startWith` & `endWith`

In this cases, no computation, just assignment :

- current task `startWith` another, then the current task `source.effectiveStart` = `target.effectiveStart`
- current task `endWith` another, then the current task `source.effectiveEnd` = `target.effectiveEnd`

## Fractional duration

Effective date boundaries can be within the ]'start of working day' - ' end of working day'[ range (so not strictly equals to start/end of working day ). In such a case, the computation logic is to 'extend' the duration with the already 'allocated time' of the start date, then compute as if the effectiveStart was the `startOfWorkingDay`

a fraction of the duration (if defined) is 'assigned' to current start (wtr. end) day, clamped by end of day. for example:

- task effectiveStart = "2026-08-25 14:30:00"
- task duration = 2.5
- workingDayHours = 8.0
- workingDayStart = 9.5 // 09:30:00
- then
  - workingDayEnd = 17.5 // 17:30:00
  - allocatedFraction for the day of effectiveStart is `(hourEndDecimal(effectiveStart) - workingDayStart)/ workingDayHours`, so `allocatedFraction = (14.5 - 9.5 )/8 = 0.625`
  - effectiveEnd can then be computed as described in "effective start / end computation basics" section, with `startDate = dateOf(effectiveStart)` and `duration = duration + allocatedFraction`
