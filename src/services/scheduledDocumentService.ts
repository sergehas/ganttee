/** Converts Date-based schedules to and from the protocol document shape. */

import { formatIsoTimestamp, parseIsoTimestamp } from "../common/dates";
import {
  GanttModel,
  GanttScheduleDocument,
  ScheduledGroupEntity,
  ScheduledMilestoneEntity,
  ScheduledModel,
  ScheduledTaskEntity,
  SchedulingError,
} from "../common/models";

/** Converts a runtime schedule into its JSON-compatible document projection. */
export function toScheduledDocument(
  scheduledModel: ScheduledModel,
): GanttScheduleDocument {
  return {
    tasks: scheduledModel.tasks.map((task) => ({
      id: task.id,
      effectiveStart: formatIsoTimestamp(task.effectiveStart()),
      effectiveEnd: formatIsoTimestamp(task.effectiveEnd()),
      effectiveDuration: task.effectiveDuration(),
    })),
    milestones: scheduledModel.milestones.map((milestone) => ({
      id: milestone.id,
      effectiveStart: formatIsoTimestamp(milestone.effectiveStart()),
      effectiveEnd: formatIsoTimestamp(milestone.effectiveEnd()),
      effectiveDuration: milestone.effectiveDuration(),
    })),
    groups: scheduledModel.groups.map((group) => ({
      id: group.id,
      effectiveStart: formatIsoTimestamp(group.effectiveStart),
      effectiveEnd: formatIsoTimestamp(group.effectiveEnd),
      effectiveDuration: group.effectiveDuration,
    })),
  };
}

/** Rehydrates a serialized schedule against an already hydrated document model. */
export function fromScheduledDocument(
  model: GanttModel,
  document: GanttScheduleDocument,
): ScheduledModel {
  const tasks = document.tasks.map((scheduledTask) => {
    const task = model.tasks.find(
      (candidate) => candidate.id === scheduledTask.id,
    );
    if (task === undefined) {
      throw new SchedulingError(
        `Unknown scheduled task "${scheduledTask.id}".`,
      );
    }
    return new ScheduledTaskEntity(
      task,
      parseIsoTimestamp(scheduledTask.effectiveStart),
      parseIsoTimestamp(scheduledTask.effectiveEnd),
      scheduledTask.effectiveDuration,
    );
  });
  const milestones = document.milestones.map((scheduledMilestone) => {
    const milestone = model.milestones.find(
      (candidate) => candidate.id === scheduledMilestone.id,
    );
    if (milestone === undefined) {
      throw new SchedulingError(
        `Unknown scheduled milestone "${scheduledMilestone.id}".`,
      );
    }
    return new ScheduledMilestoneEntity(
      milestone,
      parseIsoTimestamp(scheduledMilestone.effectiveStart),
    );
  });
  const groups: ScheduledGroupEntity[] = document.groups.map(
    (scheduledGroup) => {
      const group = model.groups.find(
        (candidate) => candidate.id === scheduledGroup.id,
      );
      if (group === undefined) {
        throw new SchedulingError(
          `Unknown scheduled group "${scheduledGroup.id}".`,
        );
      }
      return {
        id: group.id,
        name: group.name,
        groupId: group.groupId,
        effectiveStart: parseIsoTimestamp(scheduledGroup.effectiveStart),
        effectiveEnd: parseIsoTimestamp(scheduledGroup.effectiveEnd),
        effectiveDuration: scheduledGroup.effectiveDuration,
      };
    },
  );
  return new ScheduledModel(tasks, milestones, groups);
}
