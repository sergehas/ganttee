/**
 * Document transforms for removing a group.
 *
 * Deleting a group is ambiguous: its contents can be deleted with it or
 * promoted to its parent. Both transforms are pure, so the caller only has to
 * decide which one the user asked for.
 */

import { GanttDocument } from "../common/models";
import { GroupDeleteStrategy } from "../common/protocol";
import { selectGroupScheduleScope } from "./groupHierarchyService";

/**
 * Removes a group from a document using the requested strategy.
 *
 * @param document The document to transform.
 * @param groupId The group to remove.
 * @param strategy Whether to delete the contents or promote them.
 * @returns The transformed document, or `undefined` when no group has that id.
 */
export function buildGroupDeletionDocument(
  document: GanttDocument,
  groupId: string,
  strategy: GroupDeleteStrategy,
): GanttDocument | undefined {
  const group = document.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return undefined;
  }
  return strategy === "cascade"
    ? deleteGroupSubtree(document, groupId)
    : promoteGroupContents(document, groupId, group.groupId);
}

/**
 * Returns whether a group holds any task, milestone, or nested group.
 *
 * @param document The document to inspect.
 * @param groupId The group to check.
 */
export function hasGroupContents(
  document: GanttDocument,
  groupId: string,
): boolean {
  return [...document.tasks, ...document.milestones, ...document.groups].some(
    (entity) => entity.groupId === groupId,
  );
}

/** Removes the group, everything nested inside it, and their dependencies. */
function deleteGroupSubtree(
  document: GanttDocument,
  groupId: string,
): GanttDocument {
  const scope = selectGroupScheduleScope(document, groupId);
  const deletedIds = new Set([
    ...scope.tasks.map((task) => task.id),
    ...scope.milestones.map((milestone) => milestone.id),
  ]);

  return {
    ...document,
    groups: document.groups.filter((group) => !scope.groupIds.has(group.id)),
    tasks: document.tasks.filter((task) => !deletedIds.has(task.id)),
    milestones: document.milestones.filter(
      (milestone) => !deletedIds.has(milestone.id),
    ),
    dependencies: document.dependencies.filter(
      (dependency) =>
        !deletedIds.has(dependency.sourceId) &&
        !deletedIds.has(dependency.targetId),
    ),
  };
}

/** Removes the group and reassigns its direct members to the group's parent. */
function promoteGroupContents(
  document: GanttDocument,
  groupId: string,
  parentGroupId: string | undefined,
): GanttDocument {
  const reparent = <T extends { groupId?: string }>(entity: T): T =>
    entity.groupId === groupId ? { ...entity, groupId: parentGroupId } : entity;

  return {
    ...document,
    groups: document.groups
      .filter((group) => group.id !== groupId)
      .map(reparent),
    tasks: document.tasks.map(reparent),
    milestones: document.milestones.map(reparent),
  };
}
