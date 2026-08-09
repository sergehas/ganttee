import {
  effectiveEnd,
  effectiveStart,
  GanttDocument,
  Milestone,
  Task,
} from "../../../common/models";
import {
  EditableEntityKind,
  EditableEntityRef,
} from "../../../common/protocol";

/** The full set of group IDs, tasks, and milestones that belong to a group hierarchy. */
export interface GroupScope {
  /** All group IDs in the hierarchy, including the root and all descendants. */
  groupIds: Set<string>;
  /** Tasks directly or transitively assigned to the group hierarchy. */
  tasks: Task[];
  /** Milestones directly or transitively assigned to the group hierarchy. */
  milestones: Milestone[];
}

/** A direct member row shown in the group-owned-entities list. */
export interface DirectGroupMemberRow {
  /** Stable row id (`kind:id`) for React rendering. */
  id: string;
  /** Display name for the member entity. */
  name: string;
  /** Kind of entity (`task`, `milestone`, or `group`). */
  kind: EditableEntityKind;
  /** Navigable reference to the member entity. */
  entity: EditableEntityRef;
}

/**
 * Collects all groups, tasks, and milestones that belong to the given group hierarchy.
 * Traverses nested sub-groups via a breadth-first scan.
 */
export function collectGroupScope(
  document: GanttDocument,
  rootGroupId: string,
): GroupScope {
  const groupIds = new Set<string>([rootGroupId]);
  let frontier = [rootGroupId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const parentId of frontier) {
      for (const group of document.groups) {
        if (group.groupId === parentId && !groupIds.has(group.id)) {
          groupIds.add(group.id);
          next.push(group.id);
        }
      }
    }
    frontier = next;
  }

  const tasks = document.tasks.filter(
    (task) => task.groupId !== undefined && groupIds.has(task.groupId),
  );
  const milestones = document.milestones.filter(
    (milestone) =>
      milestone.groupId !== undefined && groupIds.has(milestone.groupId),
  );

  return { groupIds, tasks, milestones };
}

/**
 * Computes the earliest start, latest end, and total duration (in days) across a set of tasks and milestones.
 * Returns an empty object when no dated entities are present.
 */
export function computeGroupEffectiveSchedule(
  tasks: Task[],
  milestones: Milestone[],
): { start?: string; end?: string; duration?: string } {
  const starts: string[] = [];
  const ends: string[] = [];

  for (const task of tasks) {
    const start = effectiveStart(task);
    const end = effectiveEnd(task);
    if (start) {
      starts.push(start);
    }
    if (end) {
      ends.push(end);
    }
  }

  for (const milestone of milestones) {
    starts.push(milestone.date);
    ends.push(milestone.date);
  }

  if (starts.length === 0 || ends.length === 0) {
    return {};
  }

  const start = starts.reduce(
    (min, date) => (date < min ? date : min),
    starts[0],
  );
  const end = ends.reduce((max, date) => (date > max ? date : max), ends[0]);
  const duration = Math.max(0, diffInDays(start, end));

  return {
    start,
    end,
    duration: duration.toString(),
  };
}

/**
 * Builds direct-member rows for entities owned by a group.
 * Includes only entities with `groupId === ownerGroupId` (no transitive descendants).
 */
export function buildDirectGroupMemberRows(
  document: GanttDocument,
  ownerGroupId: string,
): DirectGroupMemberRow[] {
  const groupRows: DirectGroupMemberRow[] = document.groups
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `group:${item.id}`,
      name: item.name,
      kind: "group",
      entity: { kind: "group", id: item.id },
    }));

  const taskRows: DirectGroupMemberRow[] = document.tasks
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `task:${item.id}`,
      name: item.name,
      kind: "task",
      entity: { kind: "task", id: item.id },
    }));

  const milestoneRows: DirectGroupMemberRow[] = document.milestones
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `milestone:${item.id}`,
      name: item.name,
      kind: "milestone",
      entity: { kind: "milestone", id: item.id },
    }));

  return [...groupRows, ...taskRows, ...milestoneRows];
}

/** Returns the number of whole days between two ISO date strings (end minus start). */
function diffInDays(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  return (endMs - startMs) / (24 * 60 * 60 * 1000);
}
