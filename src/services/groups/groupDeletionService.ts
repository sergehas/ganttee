/**
 * Document transforms for removing a group.
 *
 * Deleting a group is ambiguous: its contents can be deleted with it or
 * promoted to its parent. Both transforms are pure, so the caller only has to
 * decide which one the user asked for.
 */

import { ProjectDocument } from "@common/documents";
import { GroupDeleteStrategy } from "@common/protocol";
import { selectGroupScheduleScope } from "@services/groups/groupHierarchyService";
import {
  insertIdsIntoOwnerSequence,
  removeIdsFromEverySequence,
  sequenceOf,
} from "@services/ordering/sequenceOrderingService";

/**
 * Removes a group from a document using the requested strategy.
 *
 * @param projectDoc The document to transform.
 * @param groupId The group to remove.
 * @param strategy Whether to delete the contents or promote them.
 * @returns The transformed document, or `undefined` when no group has that id.
 */
export function buildGroupDeletionDocument(
  projectDoc: ProjectDocument,
  groupId: string,
  strategy: GroupDeleteStrategy,
): ProjectDocument | undefined {
  const group = projectDoc.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return undefined;
  }
  return strategy === "cascade"
    ? deleteGroupSubtree(projectDoc, groupId)
    : promoteGroupContents(projectDoc, groupId, group.groupId);
}

/**
 * Returns whether a group holds any task, milestone, or nested group.
 *
 * @param projectDoc The document to inspect.
 * @param groupId The group to check.
 */
export function hasGroupContents(projectDoc: ProjectDocument, groupId: string): boolean {
  return [...projectDoc.tasks, ...projectDoc.milestones, ...projectDoc.groups].some(
    (entity) => entity.groupId === groupId,
  );
}

/** Removes the group, everything nested inside it, and their dependencies. */
function deleteGroupSubtree(projectDoc: ProjectDocument, groupId: string): ProjectDocument {
  const scope = selectGroupScheduleScope(projectDoc, groupId);
  const deletedIds = new Set([
    ...scope.groupIds,
    ...scope.tasks.map((task) => task.id),
    ...scope.milestones.map((milestone) => milestone.id),
  ]);

  const next: ProjectDocument = {
    ...projectDoc,
    groups: projectDoc.groups.filter((group) => !scope.groupIds.has(group.id)),
    tasks: projectDoc.tasks.filter((task) => !deletedIds.has(task.id)),
    milestones: projectDoc.milestones.filter((milestone) => !deletedIds.has(milestone.id)),
    dependencies: projectDoc.dependencies.filter(
      (dependency) => !deletedIds.has(dependency.sourceId) && !deletedIds.has(dependency.targetId),
    ),
  };
  return removeIdsFromEverySequence(next, deletedIds);
}

/** Removes the group and reassigns its direct members to the group's parent, at the group's former sequence position. */
function promoteGroupContents(
  projectDoc: ProjectDocument,
  groupId: string,
  parentGroupId: string | undefined,
): ProjectDocument {
  const reparent = <T extends { groupId?: string }>(entity: T): T =>
    entity.groupId === groupId ? { ...entity, groupId: parentGroupId } : entity;

  const promotedGroup = projectDoc.groups.find((group) => group.id === groupId);
  const promotedIds = promotedGroup?.sequence ?? [];
  const parentSequence = sequenceOf(projectDoc, parentGroupId);
  const groupIndex = parentSequence.indexOf(groupId);
  const beforeId =
    groupIndex >= 0 && groupIndex + 1 < parentSequence.length
      ? parentSequence[groupIndex + 1]
      : undefined;

  const next: ProjectDocument = {
    ...projectDoc,
    groups: projectDoc.groups.filter((group) => group.id !== groupId).map(reparent),
    tasks: projectDoc.tasks.map(reparent),
    milestones: projectDoc.milestones.map(reparent),
  };
  const withoutDeleted = removeIdsFromEverySequence(next, new Set([groupId, ...promotedIds]));
  return insertIdsIntoOwnerSequence(withoutDeleted, parentGroupId, promotedIds, beforeId);
}
