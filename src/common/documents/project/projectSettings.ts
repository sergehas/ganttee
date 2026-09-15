import { DateRange } from "../../dates";

/** A persisted project-level working calendar. */
export interface WorkingCalendar {
  /** ISO weekday numbers that are non-working. */
  daysOff: number[];
}

/** Persisted project-level scheduling configuration. */
export interface ProjectSettings {
  /** Project-level working calendar. */
  workingCalendar: WorkingCalendar;
  /** Project-level working hours per day. */
  workingDayHours: number;
  /** UTC decimal hour at which each working interval starts. */
  workingDayStart: number;
  /** Inclusive project holiday ranges rendered by the chart. */
  holidays: DateRange[];
}

/** Default project calendar used when persisted settings omit one. */
export const DEFAULT_PROJECT_CALENDAR: WorkingCalendar = {
  daysOff: [6, 7],
};

/** Default project settings used to resolve absent or partial persisted settings. */
export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  workingCalendar: DEFAULT_PROJECT_CALENDAR,
  workingDayHours: 8,
  workingDayStart: 9,
  holidays: [],
};

/** Resolves partial project settings into an independent complete object. */
export function resolveProjectSettings(settings: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    ...DEFAULT_PROJECT_SETTINGS,
    ...settings,
    workingCalendar: {
      ...DEFAULT_PROJECT_CALENDAR,
      ...settings.workingCalendar,
      daysOff: [...(settings.workingCalendar?.daysOff ?? DEFAULT_PROJECT_CALENDAR.daysOff)],
    },
    holidays: [...(settings.holidays ?? DEFAULT_PROJECT_SETTINGS.holidays)],
  };
}
