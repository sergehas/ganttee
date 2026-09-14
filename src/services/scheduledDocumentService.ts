/** Converts Date-based schedules to and from the protocol document shape. */

import { formatIsoTimestamp, parseIsoTimestamp } from "../common/dates";
import { ProjectScheduleDocument } from "../common/documents";
import {
  ProjectModel,
  ProjectSchedule,
  ScheduledGroup,
  ScheduledMilestone,
  ScheduledTask,
  SchedulingError,
} from "../common/models";

/** Converts a runtime schedule into its JSON-compatible document projection. */
export function toScheduledDocument(
  scheduledModel: ProjectSchedule,
): ProjectScheduleDocument {
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
  model: ProjectModel,
  document: ProjectScheduleDocument,
): ProjectSchedule {
  // Index model entities once to avoid a linear scan for every schedule entry.
  const tasksById = new Map(model.tasks.map((task) => [task.id, task]));
  const milestonesById = new Map(
    model.milestones.map((milestone) => [milestone.id, milestone]),
  );
  const groupsById = new Map(model.groups.map((group) => [group.id, group]));
  const tasks = document.tasks.map((scheduledTask) => {
    const task = tasksById.get(scheduledTask.id);
    if (task === undefined) {
      throw new SchedulingError(
        `Unknown scheduled task "${scheduledTask.id}".`,
      );
    }
    return new ScheduledTask(
      task,
      parseIsoTimestamp(scheduledTask.effectiveStart),
      parseIsoTimestamp(scheduledTask.effectiveEnd),
      scheduledTask.effectiveDuration,
    );
  });
  const milestones = document.milestones.map((scheduledMilestone) => {
    const milestone = milestonesById.get(scheduledMilestone.id);
    if (milestone === undefined) {
      throw new SchedulingError(
        `Unknown scheduled milestone "${scheduledMilestone.id}".`,
      );
    }
    return new ScheduledMilestone(
      milestone,
      parseIsoTimestamp(scheduledMilestone.effectiveStart),
    );
  });
  const groups: ScheduledGroup[] = document.groups.map((scheduledGroup) => {
    const group = groupsById.get(scheduledGroup.id);
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
  });
  return new ProjectSchedule(tasks, milestones, groups);
}
