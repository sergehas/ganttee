/**
 * Sidebar-facing mutation entry points: group assignment (drag-and-drop
 * reparent/reposition), single-item move, and recursive mixed-kind sort.
 *
 * Ownership (`groupId`) and order (`sequence`) are updated together so the
 * sidebar and chart never see a valid ownership change with a stale order.
 */

import { Group, Milestone, ProjectDocument, Task } from "@common/documents";
import { EditableEntityRef } from "@common/protocol";
import { entitiesOf } from "@services/document/projectItemService";
import { collectDescendantGroupIds } from "@services/groups/groupHierarchyService";
import {
  bySourceOrder,
  insertIdsIntoOwnerSequence,
  removeIdsFromEverySequence,
  sequenceOf,
  sortSequence,
  withOwnerSequence,
} from "@services/ordering/sequenceOrderingService";
import type {
  EffectiveDateMap,
  EffectiveDates,
  MoveDirection,
  SortDirection,
} from "@services/ordering/sequenceOrderingService";

export type { EffectiveDateMap, EffectiveDates, MoveDirection, SortDirection };

/**
 * Reparents and repositions valid selected entities relative to a drop
 * target.
 *
 * A group target nests the selection into it (list-drop rule: appended at
 * the end of the group's own sequence). A task or milestone target is an
 * item-target drop: the selection receives the target's owner and is
 * inserted immediately before the target. `undefined` (background) targets
 * the project root the same way as a group target. Self-relative inserts,
 * self/descendant group cycles, and stale ids are rejected per-item; the
 * remaining valid items are still applied in one edit.
 *
 * @param projectDoc The document to update.
 * @param entities The dragged (or otherwise selected) entities.
 * @param target The drop target, or `undefined` for the project root.
 */
export function assignEntitiesToGroup(
  projectDoc: ProjectDocument,
  entities: readonly EditableEntityRef[],
  target: EditableEntityRef | undefined,
): ProjectDocument {
  const { ownerId, beforeId } = resolveDropTarget(projectDoc, target);

  const valid = entities.filter((entity) => isValidDrop(projectDoc, entity, target, ownerId));
  if (valid.length === 0) {
    return projectDoc;
  }

  const droppedIds = new Set(valid.map((entity) => entity.id));
  const orderedIds = bySourceOrder(projectDoc, [...droppedIds]);

  let next: ProjectDocument = {
    ...projectDoc,
    groups: updateOwnership(projectDoc.groups, valid, ownerId, "group"),
    tasks: updateOwnership(projectDoc.tasks, valid, ownerId, "task"),
    milestones: updateOwnership(projectDoc.milestones, valid, ownerId, "milestone"),
  };
  next = removeIdsFromEverySequence(next, droppedIds);
  next = insertIdsIntoOwnerSequence(next, ownerId, orderedIds, beforeId);
  return next;
}

/** Moves one entity across the adjacent sibling within its owner's sequence. */
export function moveEntity(
  projectDoc: ProjectDocument,
  entity: EditableEntityRef,
  direction: MoveDirection,
): ProjectDocument {
  const current = entitiesOf(projectDoc, entity.kind).find(
    (candidate) => candidate.id === entity.id,
  );
  if (!current) {
    return projectDoc;
  }
  const ownerId = current.groupId;
  const sequence = sequenceOf(projectDoc, ownerId);
  const index = sequence.indexOf(entity.id);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= sequence.length) {
    return projectDoc;
  }

  const reordered = [...sequence];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  return withOwnerSequence(projectDoc, ownerId, reordered);
}

/** Sorts every owner scope's sequence recursively, interleaving groups, tasks, and milestones. */
export function sortProjectItems(
  projectDoc: ProjectDocument,
  direction: SortDirection,
  effectiveDates: EffectiveDateMap = new Map(),
): ProjectDocument {
  const itemsById = new Map<string, Group | Task | Milestone>();
  for (const item of [...projectDoc.groups, ...projectDoc.tasks, ...projectDoc.milestones]) {
    itemsById.set(item.id, item);
  }
  const sortOwner = (sequence: readonly string[]): string[] =>
    sortSequence(sequence, itemsById, direction, effectiveDates);

  return {
    ...projectDoc,
    sequence: sortOwner(projectDoc.sequence ?? []),
    groups: projectDoc.groups.map((group) => ({
      ...group,
      sequence: sortOwner(group.sequence ?? []),
    })),
  };
}

/** Resolves a drop target into an owner id and, for item targets, the id to insert before. */
function resolveDropTarget(
  projectDoc: ProjectDocument,
  target: EditableEntityRef | undefined,
): { ownerId: string | undefined; beforeId: string | undefined } {
  if (target === undefined || !hasEntity(projectDoc, target)) {
    return { ownerId: undefined, beforeId: undefined };
  }
  if (target.kind === "group") {
    return { ownerId: target.id, beforeId: undefined };
  }
  const owner = entitiesOf(projectDoc, target.kind).find(
    (entity) => entity.id === target.id,
  )?.groupId;
  return { ownerId: owner, beforeId: target.id };
}

function isValidDrop(
  projectDoc: ProjectDocument,
  entity: EditableEntityRef,
  target: EditableEntityRef | undefined,
  ownerId: string | undefined,
): boolean {
  if (!hasEntity(projectDoc, entity)) {
    return false;
  }
  if (target !== undefined && target.kind === entity.kind && target.id === entity.id) {
    // The drop target is also in the dragged selection: no item is inserted relative to itself.
    return false;
  }
  if (entity.kind !== "group" || ownerId === undefined) {
    return true;
  }
  return !collectDescendantGroupIds(projectDoc.groups, entity.id).has(ownerId);
}

function hasEntity(projectDoc: ProjectDocument, entity: EditableEntityRef): boolean {
  return entitiesOf(projectDoc, entity.kind).some((candidate) => candidate.id === entity.id);
}

function updateOwnership<T extends Group | Task | Milestone>(
  entities: readonly T[],
  selected: readonly EditableEntityRef[],
  targetGroupId: string | undefined,
  kind: EditableEntityRef["kind"],
): T[] {
  const selectedIds = new Set(
    selected.filter((entity) => entity.kind === kind).map((entity) => entity.id),
  );
  return entities.map((entity) =>
    selectedIds.has(entity.id) ? { ...entity, groupId: targetGroupId } : entity,
  );
}
