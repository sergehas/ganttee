/**
 * Guards that decide whether an entity draft may be persisted.
 *
 * The same guards apply whether the edit came from the form or from a direct
 * chart gesture, so both paths reject the same drafts.
 */

import { Dependency, Group, Milestone, Task } from "../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
} from "../common/protocol";
import {
  validateMilestoneConstraints,
  validateTaskConstraints,
} from "./scheduleConstraintService";

/** Optional behavior flags for save actions initiated by the webview. */
export interface SaveEntityOptions {
  keepEditorOpen?: boolean;
}

/** A typed entity update routed through the shared edit workflow. */
export type EditableEntityUpdate = {
  [K in EditableEntityKind]: {
    kind: K;
    entity: EditableEntityMap[K];
    options?: SaveEntityOptions;
  };
}[EditableEntityKind];

/**
 * Returns whether an entity draft is valid for saving.
 *
 * @param kind The kind of the draft.
 * @param entity The draft to check.
 * @param dependencies Every dependency in the document.
 */
export function canSaveEntity<K extends EditableEntityKind>(
  kind: K,
  entity: EditableEntityMap[K],
  dependencies: readonly Dependency[] = [],
): boolean {
  switch (kind) {
    case "task":
      return canSaveTask(entity as Task, dependencies);
    case "milestone":
      return canSaveMilestone(entity as Milestone, dependencies);
    default:
      return canSaveGroup(entity as Group);
  }
}

/**
 * Wraps a draft in a save update when it passes the guards.
 *
 * @param kind The kind of the draft.
 * @param entity The draft to save.
 * @param options Behavior flags for the save.
 * @param dependencies Every dependency in the document.
 * @returns The update payload, or `undefined` when the draft is invalid.
 */
export function buildSaveUpdate<K extends EditableEntityKind>(
  kind: K,
  entity: EditableEntityMap[K],
  options?: SaveEntityOptions,
  dependencies: readonly Dependency[] = [],
): EditableEntityUpdate | undefined {
  if (!canSaveEntity(kind, entity, dependencies)) {
    return undefined;
  }
  return { kind, entity, options } as EditableEntityUpdate;
}

/** A task must be determinate and must not end before it starts. */
function canSaveTask(task: Task, dependencies: readonly Dependency[]): boolean {
  if (
    task.start !== undefined &&
    task.end !== undefined &&
    task.start > task.end
  ) {
    return false;
  }
  return !validateTaskConstraints(task, dependencies).blocking;
}

/** A milestone must resolve to exactly one date. */
function canSaveMilestone(
  milestone: Milestone,
  dependencies: readonly Dependency[],
): boolean {
  return !validateMilestoneConstraints(milestone, dependencies).blocking;
}

/** A group must not be its own parent. */
function canSaveGroup(group: Group): boolean {
  return group.groupId !== group.id;
}
