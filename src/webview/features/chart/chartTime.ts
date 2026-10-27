import { parseIsoTimestamp } from "@common/dates";

/**
 * Converts an ISO calendar date to a local-midnight chart timestamp.
 *
 * Date-only values use local midnight because ECharts renders its time axis in local time.
 * @param isoDate ISO date-only value or timestamp.
 * @returns The corresponding chart timestamp in milliseconds.
 * @throws {RangeError} When an ISO timestamp is invalid.
 */
export function toChartMs(isoDate: string): number {
  if (isoDate.includes("T")) {
    return parseIsoTimestamp(isoDate).getTime();
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
