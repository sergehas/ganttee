import { MS_PER_DAY } from "@common/dates";
import { ZoomLevel } from "@common/documents";

/** Display configuration for the selected and parent timeline axes. */
export interface TimelineAxisModel {
  /** Milliseconds between selected-level grid lines. */
  readonly selectedInterval: number;
  /** Milliseconds between parent-level labels. */
  readonly parentInterval?: number;
  /** Formats the selected-level label nearest the chart bars. */
  readonly formatSelected: (value: number) => string;
  /** Formats the parent-level label, when present. */
  readonly formatParent?: (value: number) => string;
  /** Initial visible duration before Fit-to-window is requested. */
  readonly visibleDuration: number;
}

/** One explicit selected-level tick and optional parent boundary label. */
export interface TimelineTick {
  /** Tick timestamp in UTC. */
  readonly value: number;
  /** Selected-level label nearest the bars. */
  readonly label: string;
  /** Parent-level label shown above this tick. */
  readonly parentLabel?: string;
}

/** Creates deterministic axis intervals and labels for one persisted zoom level. */
export function createTimelineAxisModel(
  zoomLevel: ZoomLevel,
  locale: string,
): TimelineAxisModel {
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  });
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" });
  switch (zoomLevel) {
    case "day":
      return {
        selectedInterval: MS_PER_DAY,
        parentInterval: 7 * MS_PER_DAY,
        formatSelected: (value) => String(new Date(value).getUTCDate()),
        formatParent: (value) =>
          isoWeekday(value) === 1 ? `W${pad2(isoWeekNumber(value))}` : "",
        visibleDuration: 14 * MS_PER_DAY,
      };
    case "week":
      return {
        selectedInterval: 7 * MS_PER_DAY,
        parentInterval: 7 * MS_PER_DAY,
        formatSelected: (value) => `W${pad2(isoWeekNumber(value))}`,
        formatParent: (value) =>
          new Date(value).getUTCDate() <= 7 ? month.format(value) : "",
        visibleDuration: 84 * MS_PER_DAY,
      };
    case "month":
      return {
        selectedInterval: 30 * MS_PER_DAY,
        parentInterval: 30 * MS_PER_DAY,
        formatSelected: (value) => month.format(value),
        formatParent: (value) =>
          new Date(value).getUTCMonth() % 3 === 0
            ? `Q${quarter(value)} ${new Date(value).getUTCFullYear()}`
            : "",
        visibleDuration: 365 * MS_PER_DAY,
      };
    case "quarter":
      return {
        selectedInterval: 91 * MS_PER_DAY,
        parentInterval: 91 * MS_PER_DAY,
        formatSelected: (value) =>
          `Q${quarter(value)} ${new Date(value).getUTCFullYear()}`,
        formatParent: (value) =>
          new Date(value).getUTCMonth() < 3 ? year.format(value) : "",
        visibleDuration: 2 * 365 * MS_PER_DAY,
      };
    case "year":
      return {
        selectedInterval: 365 * MS_PER_DAY,
        formatSelected: (value) => year.format(value),
        visibleDuration: 5 * 365 * MS_PER_DAY,
      };
  }
}

/** Aligns a visible range start to the selected calendar unit. */
export function alignTimelineStart(
  zoomLevel: ZoomLevel,
  value: number,
): number {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  switch (zoomLevel) {
    case "day":
    case "week":
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() || 7) - 1));
      return date.getTime();
    case "month":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    case "quarter":
      return Date.UTC(
        date.getUTCFullYear(),
        Math.floor(date.getUTCMonth() / 3) * 3,
        1,
      );
    case "year":
      return Date.UTC(date.getUTCFullYear(), 0, 1);
  }
}

/** Builds one exact calendar tick per selected unit over the project range. */
export function buildTimelineTicks(
  zoomLevel: ZoomLevel,
  locale: string,
  range: { readonly min: number; readonly max: number },
): TimelineTick[] {
  const model = createTimelineAxisModel(zoomLevel, locale);
  const ticks: TimelineTick[] = [];
  let value = alignTimelineStart(zoomLevel, range.min);
  while (value <= range.max) {
    const parentLabel = model.formatParent?.(value) || undefined;
    ticks.push({ value, label: model.formatSelected(value), parentLabel });
    value = nextTimelineTick(zoomLevel, value);
  }
  return ticks;
}

/** Advances one exact calendar unit without fixed month or year approximations. */
function nextTimelineTick(zoomLevel: ZoomLevel, value: number): number {
  const date = new Date(value);
  switch (zoomLevel) {
    case "day":
      return value + MS_PER_DAY;
    case "week":
      return value + 7 * MS_PER_DAY;
    case "month":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    case "quarter":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 1);
    case "year":
      return Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  }
}

/** Returns the ISO-8601 weekday number for a timestamp. */
function isoWeekday(value: number): number {
  return new Date(value).getUTCDay() || 7;
}

/** Returns the ISO-8601 week number for a timestamp. */
function isoWeekNumber(value: number): number {
  const date = new Date(value);
  const thursday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(
    (thursday.getTime() - yearStart.getTime() + MS_PER_DAY) / (7 * MS_PER_DAY),
  );
}

/** Returns the calendar quarter for a timestamp. */
function quarter(value: number): number {
  return Math.floor(new Date(value).getUTCMonth() / 3) + 1;
}

/** Formats a positive integer with two digits. */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
