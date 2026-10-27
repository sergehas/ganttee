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
  /** Inclusive holiday ranges excluded from working time. */
  readonly holidays: readonly DateRange[];
}

/** Inclusive ISO date-only range used by project-level settings. */
export interface DateRange {
  /** Inclusive range start in `YYYY-MM-DD` form. */
  readonly start: string;
  /** Inclusive range end in `YYYY-MM-DD` form. */
  readonly end: string;
}

/**
 * Merges inclusive holiday ranges into sorted, disjoint ranges.
 *
 * @param ranges The holiday ranges to normalize.
 * @returns A new sorted range list with overlaps and adjacent dates merged.
 */
export function normalizeHolidayRanges(ranges: readonly DateRange[]): readonly DateRange[] {
  const sorted = [...ranges].sort((left, right) => left.start.localeCompare(right.start));
  const merged: DateRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (
      previous === undefined ||
      addDays(parseIsoDate(previous.end), 1) < parseIsoDate(range.start)
    ) {
      merged.push({ ...range });
    } else if (range.end > previous.end) {
      merged[merged.length - 1] = { ...previous, end: range.end };
    }
  }
  return merged;
}

/**
 * Formats a UTC calendar date using the supplied display language.
 *
 * @param date The date to display.
 * @param locale The requested display language.
 * @returns A locale-aware, short UTC date.
 */
export function formatShortDate(date: Date, locale: string): string {
  try {
    return createDateFormatter(locale).format(date);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    return createDateFormatter().format(date);
  }
}

/** Creates the standard UTC date formatter for a requested display language. */
function createDateFormatter(locale?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
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
 * Parses an ISO timestamp into a `Date`.
 *
 * @param iso The ISO-8601 timestamp to parse.
 * @returns The parsed UTC timestamp.
 * @throws {RangeError} When the timestamp is invalid.
 */
export function parseIsoTimestamp(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid ISO timestamp: ${iso}`);
  }
  return date;
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

/** Formats a `Date` as a complete UTC ISO timestamp. */
export function formatIsoTimestamp(date: Date): string {
  return date.toISOString();
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
export function normalizeToWorkingTime(date: Date, settings: WorkingTimeSettings): Date {
  const epochMilliseconds = date.getTime();
  const day = utcDayStart(epochMilliseconds);
  const currentInterval = intervalOn(day, settings);
  if (currentInterval !== undefined && epochMilliseconds < currentInterval.start) {
    return new Date(currentInterval.start);
  }
  const interval = containingOrNextInterval(epochMilliseconds, settings);
  return new Date(Math.max(epochMilliseconds, interval.start));
}

/**
 * Adds an exact number of working days to a normalized UTC timestamp.
 *
 * @param date The traversal start.
 * @param duration The positive duration in working days.
 * @param settings The active working-time settings.
 */
export function addWorkingDays(date: Date, duration: number, settings: WorkingTimeSettings): Date {
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
export function diffInWorkingDays(from: Date, to: Date, settings: WorkingTimeSettings): number {
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

/** Returns the ISO-8601 weekday number for a timestamp. */
export function isoWeekday(value: number): number {
  return new Date(value).getUTCDay() || 7;
}

/** Returns the ISO-8601 week number for a timestamp. */
export function isoWeekNumber(value: number): number {
  const date = new Date(value);
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - isoWeekday(thursday.getTime()));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil((thursday.getTime() - yearStart.getTime() + MS_PER_DAY) / (7 * MS_PER_DAY));
}

/** Returns the calendar quarter for a timestamp. */
export function quarter(value: number): number {
  return Math.floor(new Date(value).getUTCMonth() / 3) + 1;
}

/** Returns the working interval on a UTC day, or undefined for a day off. */
function intervalOn(day: number, settings: WorkingTimeSettings): WorkingInterval | undefined {
  if (isNonWorkingDate(day, settings)) {
    return undefined;
  }
  const start = day + settings.workingDayStart * MS_PER_HOUR;
  return {
    start,
    end: start + settings.workingDayHours * MS_PER_HOUR,
  };
}

/** Returns whether a calendar date is excluded by weekday or holiday settings. */
function isNonWorkingDate(day: number, settings: WorkingTimeSettings): boolean {
  return (
    settings.daysOff.has(isoWeekday(day)) ||
    holidayContains(formatIsoDate(new Date(day)), settings.holidays)
  );
}

/** Returns whether a normalized holiday range contains an ISO date. */
function holidayContains(date: string, ranges: readonly DateRange[]): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const range = ranges[middle];
    if (date < range.start) {
      high = middle - 1;
    } else if (date > range.end) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}

/** Returns the working interval containing or following a timestamp. */
function containingOrNextInterval(
  epochMilliseconds: number,
  settings: WorkingTimeSettings,
): WorkingInterval {
  let day = utcDayStart(epochMilliseconds);
  while (true) {
    const previousInterval = intervalOn(day - MS_PER_DAY, settings);
    if (
      previousInterval !== undefined &&
      epochMilliseconds >= previousInterval.start &&
      epochMilliseconds < previousInterval.end
    ) {
      return previousInterval;
    }
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
    const nextInterval = intervalOn(day - MS_PER_DAY, settings);
    if (nextInterval !== undefined && epochMilliseconds > nextInterval.start) {
      return nextInterval;
    }
    day -= MS_PER_DAY;
  }
}

/** Normalizes an end timestamp for reverse traversal. */
function normalizeEndToWorkingTime(date: Date, settings: WorkingTimeSettings): number {
  const epochMilliseconds = date.getTime();
  const interval = containingOrPreviousInterval(epochMilliseconds, settings);
  return Math.min(epochMilliseconds, interval.end);
}
