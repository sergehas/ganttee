import { DateRange } from "../dates";
import { Dependency } from "./dependency";
import { ProjectView, resolveProjectView } from "./projectView";
import { GanttScheduleDocument } from "./scheduledDocument";
import { Group, Milestone, Task } from "./task";

/** Current on-disk schema version for `.ganttee` documents. */
export const CURRENT_DOCUMENT_VERSION = 2;

/**
 * A project-level working calendar.
 *
 * Reserved for the future working-days configuration feature. Until then it is
 * left unpopulated and scheduling assumes a fixed Saturday/Sunday-off calendar.
 */
export interface WorkingCalendar {
  /**
   * ISO weekday numbers (1 = Monday … 7 = Sunday) that are non-working.
   */
  daysOff: number[];
}

/**
 * Project-level configuration for a `.ganttee` document.
 *
 * Groups the reserved scheduling settings. Unpopulated until the working-days
 * configuration feature lands; scheduling assumes a fixed Saturday/Sunday-off
 * calendar in the meantime.
 */
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
export function resolveProjectSettings(
  settings: Partial<ProjectSettings> = {},
): ProjectSettings {
  return {
    ...DEFAULT_PROJECT_SETTINGS,
    ...settings,
    workingCalendar: {
      ...DEFAULT_PROJECT_CALENDAR,
      ...settings.workingCalendar,
      daysOff: [
        ...(settings.workingCalendar?.daysOff ??
          DEFAULT_PROJECT_CALENDAR.daysOff),
      ],
    },
    holidays: [...(settings.holidays ?? DEFAULT_PROJECT_SETTINGS.holidays)],
  };
}

/** The serialized shape of a `.ganttee` file. */
export interface GanttDocument {
  version: number;
  tasks: Task[];
  groups: Group[];
  milestones: Milestone[];
  dependencies: Dependency[];
  /** Transient schedule projection used only by host/webview messages. */
  schedule?: GanttScheduleDocument;
  /**
   * Reserved project-level settings (working calendar and hours). Unpopulated
   * until the working-days configuration feature lands.
   */
  settings: ProjectSettings;
  /** Resolved chart view preferences. */
  view: ProjectView;
}

/** Creates an empty document at the current schema version. */
export function createEmptyDocument(): GanttDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    tasks: [],
    groups: [],
    milestones: [],
    dependencies: [],
    settings: resolveProjectSettings(),
    view: resolveProjectView(),
  };
}
