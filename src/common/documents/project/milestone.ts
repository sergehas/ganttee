import { formatIsoDate } from "@common/dates";
import { ProjectItem } from "@common/documents/project/projectItem";
import { generateId } from "@common/idFactory";

/** The fixed duration, in working days, of every milestone. */
export const MILESTONE_DURATION = 0;

/** A persisted zero-duration marker at a specific point in time. */
export interface Milestone extends ProjectItem {
  /** ISO-8601 date string. */
  date?: string;
}

/** Creates a new milestone template with today's date. */
export function createDefaultMilestone(name: string): Milestone {
  return { id: generateId(), name, date: formatIsoDate(new Date()) };
}

/** Returns the start date of a milestone. */
export function milestoneStart(milestone: Milestone): string | undefined {
  return milestone.date;
}

/** Returns the  end date of a milestone. */
export function milestoneEnd(milestone: Milestone): string | undefined {
  return milestone.date;
}
