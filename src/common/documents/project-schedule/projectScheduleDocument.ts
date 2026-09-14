import { ScheduledGroup } from "./scheduledGroup";
import { ScheduledMilestone } from "./scheduledMilestone";
import { ScheduledTask } from "./scheduledTask";

/** Complete serialized schedule projection for a project document. */
export interface ProjectScheduleDocument {
  /** Scheduled task projections. */
  tasks: ScheduledTask[];
  /** Scheduled milestone projections. */
  milestones: ScheduledMilestone[];
  /** Scheduled group projections. */
  groups: ScheduledGroup[];
}
