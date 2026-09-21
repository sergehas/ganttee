/**
 * Cross-entity rules a document must satisfy once every field has been coerced.
 *
 * These need the whole document, so they run after
 * `documentShapeValidationService` has produced the typed shape.
 */

import { Group, ProjectDocument, Task } from "@common/documents";
import { assertGraphIntegrity } from "@services/dependency-graph/dependencyGraphService";
import { GanttParseError } from "@services/document/documentShapeValidationService";

/**
 * Asserts every cross-entity rule: unique ids, ordered task dates, a sound
 * group hierarchy, resolvable group references, and well-formed edges.
 *
 * @param projectDoc The document to check.
 * @throws {GanttParseError} When a rule is broken.
 */
export function assertDocumentRelations(projectDoc: ProjectDocument): void {
  assertUniqueEntityIds(projectDoc);
  assertUniqueDependencyIds(projectDoc.dependencies);
  assertTaskDateOrder(projectDoc.tasks);
  assertGroupHierarchy(projectDoc.groups);
  assertGroupReferences(projectDoc);
  assertSequenceIntegrity(projectDoc);
  try {
    assertGraphIntegrity(projectDoc);
  } catch (error) {
    if (error instanceof Error) {
      throw new GanttParseError(error.message);
    }
    throw error;
  }
}

/** Asserts that every dependency id is unique within the document. */
function assertUniqueDependencyIds(dependencies: ProjectDocument["dependencies"]): void {
  const seen = new Set<string>();
  for (const dependency of dependencies) {
    if (seen.has(dependency.id)) {
      throw new GanttParseError(`Dependency id "${dependency.id}" must be unique.`);
    }
    seen.add(dependency.id);
  }
}

/** Asserts that every entity id is unique across all entity kinds. */
function assertUniqueEntityIds(projectDoc: ProjectDocument): void {
  const seen = new Set<string>();
  const entities = [...projectDoc.tasks, ...projectDoc.groups, ...projectDoc.milestones];
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
    if (task.start !== undefined && task.end !== undefined && task.start > task.end) {
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
      throw new GanttParseError(`groups[${index}] cannot reference itself as parent group.`);
    }
    if (!groupById.has(group.groupId)) {
      throw new GanttParseError(`groups[${index}].groupId references an unknown group id.`);
    }

    const visited = new Set<string>([group.id]);
    let cursor: string | undefined = group.groupId;
    while (cursor !== undefined) {
      if (visited.has(cursor)) {
        throw new GanttParseError(`groups[${index}] creates a parent cycle in group hierarchy.`);
      }
      visited.add(cursor);
      cursor = groupById.get(cursor)?.groupId;
    }
  });
}

/** Asserts that every group reference points to an existing group id. */
function assertGroupReferences(projectDoc: ProjectDocument): void {
  const groupIds = new Set(projectDoc.groups.map((group) => group.id));
  projectDoc.tasks.forEach((task, index) => {
    if (task.groupId !== undefined && !groupIds.has(task.groupId)) {
      throw new GanttParseError(`tasks[${index}].groupId references an unknown group id.`);
    }
  });
  projectDoc.milestones.forEach((milestone, index) => {
    if (milestone.groupId !== undefined && !groupIds.has(milestone.groupId)) {
      throw new GanttParseError(`milestones[${index}].groupId references an unknown group id.`);
    }
  });
}

/**
 * Asserts that the root sequence and every group's sequence contain exactly
 * their direct children, each exactly once. Sequence repair normally
 * guarantees this before validation runs; this is the defensive backstop.
 */
function assertSequenceIntegrity(projectDoc: ProjectDocument): void {
  assertOwnerSequence(
    projectDoc.sequence ?? [],
    directChildrenOf(projectDoc, undefined),
    "sequence",
  );
  for (const group of projectDoc.groups) {
    assertOwnerSequence(
      group.sequence ?? [],
      directChildrenOf(projectDoc, group.id),
      `groups["${group.id}"].sequence`,
    );
  }
}

/** Direct child ids of one owner scope across all three item kinds. */
function directChildrenOf(projectDoc: ProjectDocument, ownerId: string | undefined): Set<string> {
  const owned = (entities: readonly { id: string; groupId?: string }[]): string[] =>
    entities.filter((entity) => entity.groupId === ownerId).map((entity) => entity.id);
  return new Set([
    ...owned(projectDoc.groups),
    ...owned(projectDoc.tasks),
    ...owned(projectDoc.milestones),
  ]);
}

/** Asserts one owner's sequence covers exactly its direct children, each once. */
function assertOwnerSequence(
  sequence: readonly string[],
  directChildren: ReadonlySet<string>,
  label: string,
): void {
  const seen = new Set<string>();
  for (const id of sequence) {
    if (!directChildren.has(id)) {
      throw new GanttParseError(`${label} contains an id that is not a direct child.`);
    }
    if (seen.has(id)) {
      throw new GanttParseError(`${label} contains a duplicate id.`);
    }
    seen.add(id);
  }
  if (seen.size !== directChildren.size) {
    throw new GanttParseError(`${label} is missing a direct child id.`);
  }
}
