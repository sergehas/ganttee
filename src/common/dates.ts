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
