import { Dependency } from "./dependency";
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
   * Reserved; not yet populated or read by scheduling.
   */
  daysOff?: number[];
}

/**
 * Project-level configuration for a `.ganttee` document.
 *
 * Groups the reserved scheduling settings. Unpopulated until the working-days
 * configuration feature lands; scheduling assumes a fixed Saturday/Sunday-off
 * calendar in the meantime.
 */
export interface ProjectSettings {
  /**
   * Reserved project-level working calendar. Unpopulated until the working-days
   * configuration feature lands.
   */
  workingCalendar?: WorkingCalendar;
  /**
   * Reserved project-level working hours per day. Unpopulated and ignored by
   * scheduling until the configuration feature lands.
   */
  workingDayHours?: number;
}

/** The serialized shape of a `.ganttee` file. */
export interface GanttDocument {
  version: number;
  tasks: Task[];
  groups: Group[];
  milestones: Milestone[];
  dependencies: Dependency[];
  /**
   * Reserved project-level settings (working calendar and hours). Unpopulated
   * until the working-days configuration feature lands.
   */
  settings?: ProjectSettings;
}

/** Creates an empty document at the current schema version. */
export function createEmptyDocument(): GanttDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    tasks: [],
    groups: [],
    milestones: [],
    dependencies: [],
  };
}
