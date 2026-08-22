/**
 * Selection over the group ownership tree.
 *
 * Groups nest through `groupId`, so answering "what belongs to this group?"
 * needs a traversal. Both the host (cascading deletes) and the webview (group
 * edit form) need that answer, so it is stated once here.
 */

import { GanttDocument, Group, Milestone, Task } from "../common/models";

/** Everything owned by a group hierarchy, directly or transitively. */
export interface GroupScheduleScope {
  /** The root group id and every descendant group id. */
  groupIds: ReadonlySet<string>;
  /** Tasks assigned anywhere in the hierarchy. */
  tasks: readonly Task[];
  /** Milestones assigned anywhere in the hierarchy. */
  milestones: readonly Milestone[];
}

/**
 * Collects the root group and every group nested beneath it.
 *
 * @param groups Every group in the document.
 * @param rootGroupId The group to start from.
 * @returns The root id together with all descendant group ids.
 */
export function collectDescendantGroupIds(
  groups: readonly Group[],
  rootGroupId: string,
): ReadonlySet<string> {
  const collected = new Set([rootGroupId]);
  let frontier = [rootGroupId];
  while (frontier.length > 0) {
    const children = groups.filter(
      (group) =>
        group.groupId !== undefined &&
        frontier.includes(group.groupId) &&
        !collected.has(group.id),
    );
    children.forEach((group) => collected.add(group.id));
    frontier = children.map((group) => group.id);
  }
  return collected;
}

/**
 * Selects every entity owned by a group hierarchy.
 *
 * @param document The document to select from.
 * @param rootGroupId The group at the top of the hierarchy.
 * @returns The groups, tasks, and milestones in the hierarchy.
 */
export function selectGroupScheduleScope(
  document: GanttDocument,
  rootGroupId: string,
): GroupScheduleScope {
  const groupIds = collectDescendantGroupIds(document.groups, rootGroupId);
  return {
    groupIds,
    tasks: document.tasks.filter((task) => isOwnedBy(task.groupId, groupIds)),
    milestones: document.milestones.filter((milestone) =>
      isOwnedBy(milestone.groupId, groupIds),
    ),
  };
}

/** Returns whether an optional owning group id is inside the hierarchy. */
function isOwnedBy(
  groupId: string | undefined,
  groupIds: ReadonlySet<string>,
): boolean {
  return groupId !== undefined && groupIds.has(groupId);
}
