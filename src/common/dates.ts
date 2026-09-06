/**
 * Pure calendar-day date arithmetic shared between the extension host and the
 * webview.
 *
 * Persisted `.ganttee` dates are date-only ISO strings (`YYYY-MM-DD`). The
 * default `Date` constructor interprets such strings as UTC midnight and
 * {@link Date.toISOString} formats them back in UTC, so the parse/format helpers
 * round-trip a calendar date without any timezone drift. This module must not
 * import from "vscode" or any browser/node globals.
 */

/** Milliseconds in a single day, used for date arithmetic. */
export const MS_PER_DAY = 86_400_000;

/** Milliseconds in one hour. */
export const MS_PER_HOUR = 3_600_000;

/** Calendar settings used by UTC working-time arithmetic. */
export interface WorkingTimeSettings {
  /** ISO weekday numbers excluded from working time. */
  readonly daysOff: ReadonlySet<number>;
  /** Number of working hours represented by one duration day. */
  readonly workingDayHours: number;
  /** UTC decimal hour at which a working interval starts. */
  readonly workingDayStart: number;
}

/** A UTC working interval represented as epoch milliseconds. */
interface WorkingInterval {
  /** Inclusive interval start. */
  readonly start: number;
  /** Inclusive traversal endpoint. */
  readonly end: number;
}

/**
 * Parses a date-only ISO string (`YYYY-MM-DD`) into a `Date` at UTC midnight.
 *
 * @param iso The ISO-8601 date string to parse.
 * @returns The parsed `Date` instance.
 */
export function parseIsoDate(iso: string): Date {
  return new Date(iso);
}

/**
 * Formats a `Date` as a date-only ISO string (`YYYY-MM-DD`) in UTC.
 *
 * @param date The date to format.
 * @returns The `YYYY-MM-DD` string representation.
 */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns a new `Date` offset from `date` by a whole or fractional number of
 * calendar days.
 *
 * @param date The base date.
 * @param days The number of days to add (may be negative or fractional).
 * @returns A new `Date` shifted by `days`.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Returns the number of calendar days between two dates as a decimal value.
 *
 * @param from The start date.
 * @param to The end date.
 * @returns `to − from` expressed in decimal days.
 */
export function diffInDays(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

/**
 * Returns the number of calendar days between two date-only ISO strings.
 *
 * Parsing goes through {@link parseIsoDate}, so the result is free of the
 * daylight-saving drift that local-midnight parsing introduces.
 *
 * @param start The inclusive start date (`YYYY-MM-DD`).
 * @param end The end date (`YYYY-MM-DD`).
 * @returns `end − start` expressed in decimal days.
 */
export function diffIsoDates(start: string, end: string): number {
  return diffInDays(parseIsoDate(start), parseIsoDate(end));
}

/**
 * Normalizes a timestamp to the containing or next UTC working interval.
 *
 * @param date The timestamp to normalize.
 * @param settings The active working-time settings.
 */
export function normalizeToWorkingTime(
  date: Date,
  settings: WorkingTimeSettings,
): Date {
  let day = utcDayStart(date.getTime());
  while (true) {
    const interval = intervalOn(day, settings);
    if (interval !== undefined) {
      if (date.getTime() < interval.start) {
        return new Date(interval.start);
      }
      if (date.getTime() < interval.end) {
        return new Date(date.getTime());
      }
    }
    day += MS_PER_DAY;
  }
}

/**
 * Adds an exact number of working days to a normalized UTC timestamp.
 *
 * @param date The traversal start.
 * @param duration The positive duration in working days.
 * @param settings The active working-time settings.
 */
export function addWorkingDays(
  date: Date,
  duration: number,
  settings: WorkingTimeSettings,
): Date {
  let cursor = normalizeToWorkingTime(date, settings).getTime();
  let remaining = duration * settings.workingDayHours * MS_PER_HOUR;
  while (remaining > 0) {
    const interval = containingOrNextInterval(cursor, settings);
    cursor = Math.max(cursor, interval.start);
    const available = interval.end - cursor;
    if (remaining <= available) {
      return new Date(cursor + remaining);
    }
    remaining -= available;
    cursor = interval.end;
  }
  return new Date(cursor);
}

/**
 * Subtracts an exact number of working days from a UTC timestamp.
 *
 * @param date The traversal end.
 * @param duration The positive duration in working days.
 * @param settings The active working-time settings.
 */
export function subtractWorkingDays(
  date: Date,
  duration: number,
  settings: WorkingTimeSettings,
): Date {
  let cursor = normalizeEndToWorkingTime(date, settings);
  let remaining = duration * settings.workingDayHours * MS_PER_HOUR;
  while (remaining > 0) {
    const interval = containingOrPreviousInterval(cursor, settings);
    cursor = Math.min(cursor, interval.end);
    const available = cursor - interval.start;
    if (remaining <= available) {
      return new Date(cursor - remaining);
    }
    remaining -= available;
    cursor = interval.start;
  }
  return new Date(cursor);
}

/**
 * Measures working time between two timestamps in configured working days.
 *
 * @param from The inclusive start timestamp.
 * @param to The end timestamp.
 * @param settings The active working-time settings.
 */
export function diffInWorkingDays(
  from: Date,
  to: Date,
  settings: WorkingTimeSettings,
): number {
  let cursor = from.getTime();
  const end = to.getTime();
  let elapsed = 0;
  while (cursor < end) {
    const interval = containingOrNextInterval(cursor, settings);
    const segmentStart = Math.max(cursor, interval.start);
    const segmentEnd = Math.min(end, interval.end);
    if (segmentEnd > segmentStart) {
      elapsed += segmentEnd - segmentStart;
    }
    cursor = interval.end;
  }
  return elapsed / (settings.workingDayHours * MS_PER_HOUR);
}

/** Returns the UTC midnight containing an epoch timestamp. */
function utcDayStart(epochMilliseconds: number): number {
  const date = new Date(epochMilliseconds);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Returns the ISO weekday number for a UTC day boundary. */
function isoWeekday(day: number): number {
  return new Date(day).getUTCDay() || 7;
}

/** Returns the working interval on a UTC day, or undefined for a day off. */
function intervalOn(
  day: number,
  settings: WorkingTimeSettings,
): WorkingInterval | undefined {
  if (settings.daysOff.has(isoWeekday(day))) {
    return undefined;
  }
  const start = day + settings.workingDayStart * MS_PER_HOUR;
  return {
    start,
    end: start + settings.workingDayHours * MS_PER_HOUR,
  };
}

/** Returns the working interval containing or following a timestamp. */
function containingOrNextInterval(
  epochMilliseconds: number,
  settings: WorkingTimeSettings,
): WorkingInterval {
  let day = utcDayStart(epochMilliseconds);
  while (true) {
    const interval = intervalOn(day, settings);
    if (interval !== undefined && epochMilliseconds < interval.end) {
      return interval;
    }
    day += MS_PER_DAY;
  }
}

/** Returns the working interval containing or preceding a timestamp. */
function containingOrPreviousInterval(
  epochMilliseconds: number,
  settings: WorkingTimeSettings,
): WorkingInterval {
  let day = utcDayStart(epochMilliseconds);
  while (true) {
    const interval = intervalOn(day, settings);
    if (interval !== undefined && epochMilliseconds > interval.start) {
      return interval;
    }
    day -= MS_PER_DAY;
  }
}

/** Normalizes an end timestamp for reverse traversal. */
function normalizeEndToWorkingTime(
  date: Date,
  settings: WorkingTimeSettings,
): number {
  const epochMilliseconds = date.getTime();
  const interval = containingOrPreviousInterval(epochMilliseconds, settings);
  return Math.min(epochMilliseconds, interval.end);
}
