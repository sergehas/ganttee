import { DateRange, MS_PER_HOUR } from "@common/dates";
import {
  ProjectDocument,
  ProjectItemState,
  ProjectSettings,
  ProjectStatus,
} from "@common/documents";
import { countProjectStatusUsage } from "@services/settings/projectSettingsWorkflow";
import { WebviewTranslator } from "@webview/l10n";

/** Minutes in one hour for decimal-hour display formatting. */
const MINUTES_PER_HOUR = 60;

/** Last whole minute representable before the next day begins. */
const LAST_MINUTE_OF_DAY = 24 * MINUTES_PER_HOUR - 1;

/** Weekday source data in ISO order, Monday first. */
const WEEKDAY_LABELS: readonly WeekdayLabel[] = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 7, label: "Sunday" },
];

/** ISO weekday identity and localization source string. */
interface WeekdayLabel {
  /** ISO weekday number, with Monday represented by 1. */
  readonly weekday: number;
  /** Source string used to resolve the localized label. */
  readonly label: string;
}

/** Localized weekday switch data ready for rendering. */
export interface WeekdayControlPresentation {
  /** ISO weekday number used in the persisted calendar. */
  readonly weekday: number;
  /** Localized weekday name. */
  readonly label: string;
  /** Whether this weekday is currently configured as non-working. */
  readonly isDayOff: boolean;
}

/** Localized list-row data for one inclusive holiday range. */
export interface HolidayRowPresentation {
  /** Stable list key including the original range position. */
  readonly key: string;
  /** Original settings index used to delete exactly this range. */
  readonly index: number;
  /** Persisted inclusive holiday range. */
  readonly range: DateRange;
  /** Localized display text for the range. */
  readonly label: string;
  /** Localized accessible name for its delete action. */
  readonly deleteLabel: string;
}

/** Status definition and aggregate assignment count for one rendered row. */
export interface StatusRowPresentation {
  /** Persisted status definition. */
  readonly status: ProjectStatus;
  /** Assigned groups, tasks, and milestones counted together. */
  readonly usageCount: number;
}

/** Settings-specific data prepared for rendering without React or the DOM. */
export interface SettingsEditorPresentation {
  /** Weekday controls ordered Monday through Sunday. */
  readonly weekdays: readonly WeekdayControlPresentation[];
  /** Holiday rows in document order. */
  readonly holidays: readonly HolidayRowPresentation[];
  /** Status rows with aggregate usage counts in document order. */
  readonly statuses: readonly StatusRowPresentation[];
}

/** Builds localized Settings view data from the current persisted settings. */
export function createSettingsEditorPresentation(
  settings: ProjectSettings,
  projectItems: Pick<ProjectDocument, "groups" | "tasks" | "milestones">,
  translate: WebviewTranslator,
): SettingsEditorPresentation {
  return {
    weekdays: WEEKDAY_LABELS.map(({ weekday, label }) => ({
      weekday,
      label: translate(label),
      isDayOff: settings.workingCalendar.daysOff.includes(weekday),
    })),
    holidays: settings.holidays.map((range, index) => ({
      key: `${range.start}-${range.end}-${index}`,
      index,
      range,
      label: translate("{0} to {1}", range.start, range.end),
      deleteLabel: translate("Delete holiday {0} to {1}", range.start, range.end),
    })),
    statuses: settings.statuses.map((status) => ({
      status,
      usageCount: countProjectStatusUsage(projectItems, status.id),
    })),
  };
}

/** Builds an inclusive holiday range when both dates are present and ordered. */
export function createHolidayRange(start: string, end: string): DateRange | undefined {
  if (!start || !end || end < start) {
    return undefined;
  }
  return { start, end };
}

/** Formats a decimal-hour offset as an HTML time input value. */
export function timeInputValueFromDecimalHour(decimalHour: number): string {
  if (!Number.isFinite(decimalHour) || decimalHour < 0 || decimalHour >= 24) {
    return "";
  }

  const totalMinutes = Math.min(Math.round(decimalHour * MINUTES_PER_HOUR), LAST_MINUTE_OF_DAY);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Converts HTML time input milliseconds since midnight to decimal hours. */
export function decimalHourFromTimeInputValue(valueAsNumber: number): number | undefined {
  if (!Number.isFinite(valueAsNumber) || valueAsNumber < 0 || valueAsNumber >= 24 * MS_PER_HOUR) {
    return undefined;
  }
  return valueAsNumber / MS_PER_HOUR;
}

/** Converts persisted RGB or RGBA status color into a color-input value. */
export function statusColorInputValue(color: string): string {
  if (/^#[\da-fA-F]{8}$/.test(color)) {
    return color.slice(0, 7);
  }
  return /^#[\da-fA-F]{6}$/.test(color) ? color : "#000000";
}

/** Builds new status metadata from form values, returning undefined for a blank name. */
export function createNewStatus(
  nameInput: string,
  colorInput: string,
  state: ProjectItemState | "",
): Omit<ProjectStatus, "id"> | undefined {
  const name = nameInput.trim();
  if (!name) {
    return undefined;
  }
  return {
    name,
    color: `${colorInput}ff`,
    ...(state === "" ? {} : { state }),
  };
}

/** Updates editable status metadata while preserving its identifier and alpha channel. */
export function updateStatusDraft(
  status: ProjectStatus,
  nameInput: string,
  colorInput: string,
  state: ProjectItemState | "",
): ProjectStatus {
  return {
    id: status.id,
    name: nameInput.trim(),
    color: `${colorInput}${status.color.length === 9 ? status.color.slice(7) : "ff"}`,
    ...(state === "" ? {} : { state }),
  };
}
