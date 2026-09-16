import { ScheduledGroup } from "@common/models/project/group";
import { ScheduledMilestone } from "@common/models/project/scheduledMilestone";
import { ScheduledTask } from "@common/models/project/scheduledTask";

/** Complete in-memory scheduling result for a project. */
export class ProjectSchedule {
  /**
   * @param tasks Scheduled task projections.
   * @param milestones Scheduled milestone projections.
   * @param groups Scheduled non-empty group rollups.
   */
  constructor(
    readonly tasks: readonly ScheduledTask[],
    readonly milestones: readonly ScheduledMilestone[],
    readonly groups: readonly ScheduledGroup[],
  ) {}
}
