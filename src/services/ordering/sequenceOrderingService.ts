/**
 * Pure sequence math shared by creation, deletion, move, sort, and
 * drag-and-drop. A root or group `sequence` is the canonical order of its
 * direct children; every mutation that can add, remove, or reposition an
 * item goes through the helpers here so ordering never drifts from
 * ownership.
 */

import { Group, Milestone, ProjectContent, Task } from "@common/documents";

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

/** Returns a sequence with `id` inserted immediately before `beforeId`, or appended when `beforeId` is absent or unresolved. */
export function insertBeforeInSequence(
  sequence: readonly string[],
  id: string,
  beforeId: string | undefined,
): string[] {
  return insertManyBefore(sequence, [id], beforeId);
}

/** Returns a sequence with `ids` (in the given order) inserted immediately before `beforeId`, or appended at the end. */
export function insertManyBefore(
  sequence: readonly string[],
  ids: readonly string[],
  beforeId: string | undefined,
): string[] {
  const index = beforeId === undefined ? -1 : sequence.indexOf(beforeId);
  if (index < 0) {
    return [...sequence, ...ids];
  }
  return [...sequence.slice(0, index), ...ids, ...sequence.slice(index)];
}

/** Returns a sequence with every id in `removedIds` removed. */
export function removeFromSequence(
  sequence: readonly string[],
  removedIds: ReadonlySet<string>,
): string[] {
  return sequence.filter((id) => !removedIds.has(id));
}

/** Reads the sequence for an owner scope: the root sequence when `ownerId` is `undefined`, else that group's own sequence. */
export function sequenceOf(projectDoc: ProjectContent, ownerId: string | undefined): string[] {
  if (ownerId === undefined) {
    return projectDoc.sequence ?? [];
  }
  return projectDoc.groups.find((group) => group.id === ownerId)?.sequence ?? [];
}

/** Returns a document with one owner scope's sequence replaced. */
export function withOwnerSequence<T extends ProjectContent>(
  projectDoc: T,
  ownerId: string | undefined,
  sequence: readonly string[],
): T {
  if (ownerId === undefined) {
    return { ...projectDoc, sequence: [...sequence] };
  }
  return {
    ...projectDoc,
    groups: projectDoc.groups.map((group) =>
      group.id === ownerId ? { ...group, sequence: [...sequence] } : group,
    ),
  };
}

/** Returns a document with `removedIds` stripped from the root sequence and every group's sequence. */
export function removeIdsFromEverySequence<T extends ProjectContent>(
  projectDoc: T,
  removedIds: ReadonlySet<string>,
): T {
  return {
    ...projectDoc,
    sequence: removeFromSequence(projectDoc.sequence ?? [], removedIds),
    groups: projectDoc.groups.map((group) => ({
      ...group,
      sequence: removeFromSequence(group.sequence ?? [], removedIds),
    })),
  };
}

/** Returns a document with `ids` inserted into one owner scope's sequence, immediately before `beforeId` or appended. */
export function insertIdsIntoOwnerSequence<T extends ProjectContent>(
  projectDoc: T,
  ownerId: string | undefined,
  ids: readonly string[],
  beforeId: string | undefined,
): T {
  if (ids.length === 0) {
    return projectDoc;
  }
  const sequence = insertManyBefore(sequenceOf(projectDoc, ownerId), ids, beforeId);
  return withOwnerSequence(projectDoc, ownerId, sequence);
}

/** Depth-first preorder of every item id: the root sequence, with each group immediately followed by its own sequence. */
export function depthFirstOrder(projectDoc: ProjectContent): string[] {
  const groupById = new Map(projectDoc.groups.map((group) => [group.id, group]));
  const order: string[] = [];
  const visit = (sequence: readonly string[]): void => {
    for (const id of sequence) {
      order.push(id);
      const group = groupById.get(id);
      if (group) {
        visit(group.sequence ?? []);
      }
    }
  };
  visit(projectDoc.sequence ?? []);
  return order;
}

/** Orders `ids` by their position in the document's depth-first sequence order. */
export function bySourceOrder(projectDoc: ProjectContent, ids: readonly string[]): string[] {
  const rank = new Map(depthFirstOrder(projectDoc).map((id, index) => [id, index]));
  return [...ids].sort((left, right) => (rank.get(left) ?? 0) - (rank.get(right) ?? 0));
}

/** Sorts one owner's sequence by effective dates then name, with a stable position tie-break. */
export function sortSequence(
  sequence: readonly string[],
  itemsById: ReadonlyMap<string, Group | Task | Milestone>,
  direction: SortDirection,
  effectiveDates: EffectiveDateMap,
): string[] {
  const positions = new Map(sequence.map((id, index) => [id, index]));
  return [...sequence].sort((left, right) => {
    const comparison = compareIds(left, right, itemsById, effectiveDates, positions);
    return direction === "ascending" ? comparison : -comparison;
  });
}

function compareIds(
  leftId: string,
  rightId: string,
  itemsById: ReadonlyMap<string, Group | Task | Milestone>,
  effectiveDates: EffectiveDateMap,
  positions: ReadonlyMap<string, number>,
): number {
  const left = itemsById.get(leftId);
  const right = itemsById.get(rightId);
  const leftDates = effectiveDates.get(leftId);
  const rightDates = effectiveDates.get(rightId);
  const start = compareDates(leftDates?.start, rightDates?.start);
  if (start !== 0) {
    return start;
  }
  const end = compareDates(leftDates?.end, rightDates?.end);
  if (end !== 0) {
    return end;
  }
  const name = (left?.name ?? "").localeCompare(right?.name ?? "");
  return name === 0 ? (positions.get(leftId) ?? 0) - (positions.get(rightId) ?? 0) : name;
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
