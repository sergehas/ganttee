/**
 * Cross-entity rules a document must satisfy once every field has been coerced.
 *
 * These need the whole document, so they run after
 * `documentShapeValidationService` has produced the typed shape.
 */

import { GanttDocument, Group, Task } from "../common/models";
import { assertGraphIntegrity } from "./dependencyGraphService";
import { GanttParseError } from "./documentShapeValidationService";

/**
 * Asserts every cross-entity rule: unique ids, ordered task dates, a sound
 * group hierarchy, resolvable group references, and well-formed edges.
 *
 * @param document The document to check.
 * @throws {GanttParseError} When a rule is broken.
 */
export function assertDocumentRelations(document: GanttDocument): void {
  assertUniqueEntityIds(document);
  assertTaskDateOrder(document.tasks);
  assertGroupHierarchy(document.groups);
  assertGroupReferences(document);
  try {
    assertGraphIntegrity(document);
  } catch (error) {
    if (error instanceof Error) {
      throw new GanttParseError(error.message);
    }
    throw error;
  }
}

/** Asserts that every entity id is unique across all entity kinds. */
function assertUniqueEntityIds(document: GanttDocument): void {
  const seen = new Set<string>();
  const entities = [
    ...document.tasks,
    ...document.groups,
    ...document.milestones,
  ];
  for (const entity of entities) {
    if (seen.has(entity.id)) {
      throw new GanttParseError(
        `Entity id "${entity.id}" must be unique across tasks, groups, and milestones.`,
      );
    }
    seen.add(entity.id);
  }
}

/** Asserts that each task keeps `start <= end` when both endpoints exist. */
function assertTaskDateOrder(tasks: Task[]): void {
  tasks.forEach((task, index) => {
    if (
      task.start !== undefined &&
      task.end !== undefined &&
      task.start > task.end
    ) {
      throw new GanttParseError(
        `tasks[${index}] has an invalid date range: start must be on or before end.`,
      );
    }
  });
}

/** Asserts group self-parent, parent existence, and ancestor-cycle rules. */
function assertGroupHierarchy(groups: Group[]): void {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  groups.forEach((group, index) => {
    if (group.groupId === undefined) {
      return;
    }
    if (group.groupId === group.id) {
      throw new GanttParseError(
        `groups[${index}] cannot reference itself as parent group.`,
      );
    }
    if (!groupById.has(group.groupId)) {
      throw new GanttParseError(
        `groups[${index}].groupId references an unknown group id.`,
      );
    }

    const visited = new Set<string>([group.id]);
    let cursor: string | undefined = group.groupId;
    while (cursor !== undefined) {
      if (visited.has(cursor)) {
        throw new GanttParseError(
          `groups[${index}] creates a parent cycle in group hierarchy.`,
        );
      }
      visited.add(cursor);
      cursor = groupById.get(cursor)?.groupId;
    }
  });
}

/** Asserts that every group reference points to an existing group id. */
function assertGroupReferences(document: GanttDocument): void {
  const groupIds = new Set(document.groups.map((group) => group.id));
  document.tasks.forEach((task, index) => {
    if (task.groupId !== undefined && !groupIds.has(task.groupId)) {
      throw new GanttParseError(
        `tasks[${index}].groupId references an unknown group id.`,
      );
    }
  });
  document.milestones.forEach((milestone, index) => {
    if (milestone.groupId !== undefined && !groupIds.has(milestone.groupId)) {
      throw new GanttParseError(
        `milestones[${index}].groupId references an unknown group id.`,
      );
    }
  });
}
