/**
 * Hydration and serialization between the plain, ISO-string document shape and
 * the `Date`-typed, object-oriented {@link GanttModel}.
 *
 * The plain {@link GanttDocument} remains the persisted/wire representation; the
 * hydrated model is a host-in-memory computed view. This service is
 * framework-agnostic and must not import from "vscode".
 */

import { formatIsoDate, parseIsoDate } from "../common/dates";
import {
  GanttDocument,
  GanttModel,
  Group,
  GroupEntity,
  Milestone,
  MilestoneEntity,
  Task,
  TaskEntity,
} from "../common/models";

/**
 * Converts a validated plain document into a {@link GanttModel}, parsing each
 * ISO date string into a `Date`.
 *
 * @param document The plain document to hydrate.
 * @returns The hydrated in-memory model.
 */
export function hydrateDocument(document: GanttDocument): GanttModel {
  return new GanttModel(
    document.tasks.map(toTaskEntity),
    document.milestones.map(toMilestoneEntity),
    document.groups.map(toGroupEntity),
    document.dependencies.map((dependency) => ({ ...dependency })),
    document.version,
    document.workingCalendar,
    document.workingDayHours,
  );
}

/**
 * Converts a {@link GanttModel} back into a plain document, formatting each
 * `Date` as a date-only ISO string. Field order mirrors the parser so a
 * parse → hydrate → serialize round-trip is byte-stable.
 *
 * @param model The in-memory model to project.
 * @returns The plain, serializable document.
 */
export function toDocument(model: GanttModel): GanttDocument {
  const document: GanttDocument = {
    version: model.version,
    tasks: model.tasks.map(fromTaskEntity),
    groups: model.groups.map(fromGroupEntity),
    milestones: model.milestones.map(fromMilestoneEntity),
    dependencies: model.dependencies.map((dependency) => ({ ...dependency })),
  };
  if (model.workingCalendar !== undefined) {
    document.workingCalendar = model.workingCalendar;
  }
  if (model.workingDayHours !== undefined) {
    document.workingDayHours = model.workingDayHours;
  }
  return document;
}

/** Maps a plain task record to a {@link TaskEntity}. */
function toTaskEntity(task: Task): TaskEntity {
  return new TaskEntity({
    id: task.id,
    name: task.name,
    description: task.description,
    groupId: task.groupId,
    start: task.start !== undefined ? parseIsoDate(task.start) : undefined,
    end: task.end !== undefined ? parseIsoDate(task.end) : undefined,
    duration: task.duration,
    progress: task.progress,
    status: task.status,
  });
}

/** Maps a plain milestone record to a {@link MilestoneEntity}. */
function toMilestoneEntity(milestone: Milestone): MilestoneEntity {
  return new MilestoneEntity({
    id: milestone.id,
    name: milestone.name,
    description: milestone.description,
    groupId: milestone.groupId,
    date: parseIsoDate(milestone.date),
  });
}

/** Maps a plain group record to a {@link GroupEntity}. */
function toGroupEntity(group: Group): GroupEntity {
  return new GroupEntity({
    id: group.id,
    name: group.name,
    description: group.description,
    groupId: group.groupId,
    collapsed: group.collapsed,
  });
}

/** Projects a {@link TaskEntity} back to a plain task record. */
function fromTaskEntity(task: TaskEntity): Task {
  const plain: Task = { id: task.id, name: task.name };
  if (task.start !== undefined) {
    plain.start = formatIsoDate(task.start);
  }
  if (task.end !== undefined) {
    plain.end = formatIsoDate(task.end);
  }
  if (task.duration !== undefined) {
    plain.duration = task.duration;
  }
  if (task.description !== undefined) {
    plain.description = task.description;
  }
  if (task.progress !== undefined) {
    plain.progress = task.progress;
  }
  if (task.status !== undefined) {
    plain.status = task.status;
  }
  if (task.groupId !== undefined) {
    plain.groupId = task.groupId;
  }
  return plain;
}

/** Projects a {@link GroupEntity} back to a plain group record. */
function fromGroupEntity(group: GroupEntity): Group {
  const plain: Group = { id: group.id, name: group.name };
  if (group.groupId !== undefined) {
    plain.groupId = group.groupId;
  }
  if (group.collapsed !== undefined) {
    plain.collapsed = group.collapsed;
  }
  return plain;
}

/** Projects a {@link MilestoneEntity} back to a plain milestone record. */
function fromMilestoneEntity(milestone: MilestoneEntity): Milestone {
  const plain: Milestone = {
    id: milestone.id,
    name: milestone.name,
    date: formatIsoDate(milestone.date),
  };
  if (milestone.groupId !== undefined) {
    plain.groupId = milestone.groupId;
  }
  return plain;
}
