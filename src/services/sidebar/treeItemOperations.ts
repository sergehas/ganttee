import { Group, Milestone, ProjectDocument, Task } from "@common/documents";
import { EditableEntityRef } from "@common/protocol";
import { entitiesOf } from "@services/document/projectItemService";
import { collectDescendantGroupIds } from "@services/groups/groupHierarchyService";

/** Direction for a single-item authored-order move. */
export type MoveDirection = "up" | "down";

/** Direction for a recursive authored-order sort. */
export type SortDirection = "ascending" | "descending";

/** Effective dates used by sidebar sorting. */
export interface EffectiveDates {
  /** Effective start date. */
  readonly start?: Date;
  /** Effective end date. */
  readonly end?: Date;
}

/** Maps project item ids to schedule-derived effective dates. */
export type EffectiveDateMap = ReadonlyMap<string, EffectiveDates>;

/** Assigns valid selected entities to a group, or to project root when absent. */
export function assignEntitiesToGroup(
  document: ProjectDocument,
  entities: readonly EditableEntityRef[],
  targetGroupId: string | undefined,
): ProjectDocument {
  if (targetGroupId !== undefined && !document.groups.some((group) => group.id === targetGroupId)) {
    return document;
  }

  const valid = entities.filter((entity) => {
    if (!hasEntity(document, entity)) {
      return false;
    }
    if (entity.kind !== "group" || targetGroupId === undefined) {
      return true;
    }
    // Reject self drops and drops onto one of the group's own descendants.
    return !collectDescendantGroupIds(document.groups, entity.id).has(targetGroupId);
  });

  return {
    ...document,
    groups: updateOwnership(document.groups, valid, targetGroupId, "group"),
    tasks: updateOwnership(document.tasks, valid, targetGroupId, "task"),
    milestones: updateOwnership(document.milestones, valid, targetGroupId, "milestone"),
  };
}

/** Moves one entity across the adjacent sibling in its current owner scope. */
export function moveEntity(
  document: ProjectDocument,
  entity: EditableEntityRef,
  direction: MoveDirection,
): ProjectDocument {
  const entities = entitiesOf(document, entity.kind);
  const index = entities.findIndex((candidate) => candidate.id === entity.id);
  if (index < 0) {
    return document;
  }

  const owner = entities[index].groupId;
  const siblingIndexes = entities
    .map((candidate, candidateIndex) => (candidate.groupId === owner ? candidateIndex : -1))
    .filter((candidateIndex) => candidateIndex >= 0);
  const siblingPosition = siblingIndexes.indexOf(index);
  const nextSiblingPosition = direction === "up" ? siblingPosition - 1 : siblingPosition + 1;
  if (
    siblingPosition < 0 ||
    nextSiblingPosition < 0 ||
    nextSiblingPosition >= siblingIndexes.length
  ) {
    return document;
  }

  const nextIndex = siblingIndexes[nextSiblingPosition];
  const reordered = [...entities];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  return withEntities(document, entity.kind, reordered);
}

/** Sorts every owner scope recursively by effective dates and name. */
export function sortProjectItems(
  document: ProjectDocument,
  direction: SortDirection,
  effectiveDates: EffectiveDateMap = new Map(),
): ProjectDocument {
  return {
    ...document,
    groups: sortEntities(document.groups, direction, effectiveDates),
    tasks: sortEntities(document.tasks, direction, effectiveDates),
    milestones: sortEntities(document.milestones, direction, effectiveDates),
  };
}

function hasEntity(document: ProjectDocument, entity: EditableEntityRef): boolean {
  return entitiesOf(document, entity.kind).some((candidate) => candidate.id === entity.id);
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

function withEntities(
  document: ProjectDocument,
  kind: EditableEntityRef["kind"],
  entities: readonly ProjectItem[],
): ProjectDocument {
  switch (kind) {
    case "group":
      return { ...document, groups: entities as Group[] };
    case "task":
      return { ...document, tasks: entities as Task[] };
    case "milestone":
      return { ...document, milestones: entities as Milestone[] };
  }
}

function sortEntities<T extends Group | Task | Milestone>(
  entities: readonly T[],
  direction: SortDirection,
  effectiveDates: EffectiveDateMap,
): T[] {
  const positions = new Map<string, number>();
  entities.forEach((entity, index) => positions.set(entity.id, index));
  const sortedByOwner = new Map<string | undefined, T[]>();
  entities.forEach((entity) => {
    const ownerItems = sortedByOwner.get(entity.groupId) ?? [];
    ownerItems.push(entity);
    sortedByOwner.set(entity.groupId, ownerItems);
  });
  for (const ownerItems of sortedByOwner.values()) {
    ownerItems.sort((left, right) => {
      const comparison = compareItems(left, right, effectiveDates, positions);
      return direction === "ascending" ? comparison : -comparison;
    });
  }

  const result = [...entities];
  for (const [owner, ownerItems] of sortedByOwner) {
    const ownerIndexes = entities
      .map((entity, index) => (entity.groupId === owner ? index : -1))
      .filter((index) => index >= 0);
    ownerIndexes.forEach((index, position) => {
      result[index] = ownerItems[position];
    });
  }
  return result;
}

function compareItems(
  left: Group | Task | Milestone,
  right: Group | Task | Milestone,
  effectiveDates: EffectiveDateMap,
  positions: ReadonlyMap<string, number>,
): number {
  const leftDates = effectiveDates.get(left.id);
  const rightDates = effectiveDates.get(right.id);
  const start = compareDates(leftDates?.start, rightDates?.start);
  if (start !== 0) {
    return start;
  }
  const end = compareDates(leftDates?.end, rightDates?.end);
  if (end !== 0) {
    return end;
  }
  const name = left.name.localeCompare(right.name);
  return name === 0 ? (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0) : name;
}

function compareDates(left: Date | undefined, right: Date | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  return left.getTime() - right.getTime();
}

type ProjectItem = Group | Task | Milestone;
