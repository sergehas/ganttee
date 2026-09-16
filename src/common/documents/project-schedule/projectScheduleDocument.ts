import { ScheduledGroup } from "@common/documents/project-schedule/scheduledGroup";
import { ScheduledMilestone } from "@common/documents/project-schedule/scheduledMilestone";
import { ScheduledTask } from "@common/documents/project-schedule/scheduledTask";

/** Complete serialized schedule projection for a project document. */
export interface ProjectScheduleDocument {
  /** Scheduled task projections. */
  tasks: ScheduledTask[];
  /** Scheduled milestone projections. */
  milestones: ScheduledMilestone[];
  /** Scheduled group projections. */
  groups: ScheduledGroup[];
}
