import { ProjectItem } from "./projectItem";

/** The fixed duration, in working days, of every milestone. */
export const MILESTONE_DURATION = 0;

/** A persisted zero-duration marker at a specific point in time. */
export interface Milestone extends ProjectItem {
  /** ISO-8601 date string. */
  date?: string;
}

/** Returns the effective start date of a milestone. */
export function milestoneStart(milestone: Milestone): string | undefined {
  return milestone.date;
}

/** Returns the effective end date of a milestone. */
export function milestoneEnd(milestone: Milestone): string | undefined {
  return milestone.date;
}
