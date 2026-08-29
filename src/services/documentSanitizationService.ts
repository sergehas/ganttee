/**
 * Removal of scheduling structures a document cannot represent.
 *
 * Sanitization is destructive by design: it rewrites the document and reports
 * what it removed, so the caller can warn the user after the fact. It never
 * mutates the input.
 */

import { Dependency, DependencyGraph, GanttDocument } from "../common/models";
import {
  anchoredEntityIds,
  schedulableEntityIds,
  unanchoredComponents,
} from "./componentAnchoringService";

/** A sanitized document together with everything sanitization destroyed. */
export interface ScheduleGraphSanitization {
  /** The document with invalid structures removed. */
  document: GanttDocument;
  /** Ids of dependencies that were removed, in document order. */
  removedDependencyIds: string[];
  /** Ids of entities that were removed, in document order. */
  removedEntityIds: string[];
}

/**
 * Removes dependencies with missing or group endpoints, then removes any
 * component left with no absolute date to anchor it.
 *
 * @param document The document to sanitize.
 * @returns The sanitized document and the ids of everything removed.
 */
export function sanitizeScheduleGraph(
  document: GanttDocument,
): ScheduleGraphSanitization {
  const entityIds = new Set([
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
    ...document.groups.map((group) => group.id),
  ]);
  const groupIds = new Set(document.groups.map((group) => group.id));

  const supportedDependencies = document.dependencies.filter(
    (dependency) => !hasUnusableEndpoint(dependency, entityIds, groupIds),
  );
  const removedEntityIds = collectUnanchoredEntityIds(
    document,
    entityIds,
    supportedDependencies,
  );

  const removedDependencyIds = document.dependencies
    .filter(
      (dependency) =>
        hasUnusableEndpoint(dependency, entityIds, groupIds) ||
        touchesAny(dependency, removedEntityIds),
    )
    .map((dependency) => dependency.id);

  return {
    document: {
      ...document,
      tasks: document.tasks.filter((task) => !removedEntityIds.has(task.id)),
      milestones: document.milestones.filter(
        (milestone) => !removedEntityIds.has(milestone.id),
      ),
      groups: document.groups.filter(
        (group) => !removedEntityIds.has(group.id),
      ),
      dependencies: supportedDependencies.filter(
        (dependency) => !touchesAny(dependency, removedEntityIds),
      ),
    },
    removedDependencyIds,
    removedEntityIds: [...removedEntityIds],
  };
}

/** Returns the ids of every entity in a component that has no date anchor. */
function collectUnanchoredEntityIds(
  document: GanttDocument,
  entityIds: ReadonlySet<string>,
  dependencies: readonly Dependency[],
): ReadonlySet<string> {
  const graph = new DependencyGraph([...entityIds], dependencies);
  return new Set(
    unanchoredComponents(
      graph.connectedComponents(),
      anchoredEntityIds(document),
      schedulableEntityIds(document),
    ).flat(),
  );
}

/** Returns whether a dependency points at a missing entity or at a group. */
function hasUnusableEndpoint(
  dependency: Dependency,
  entityIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
): boolean {
  return [dependency.sourceId, dependency.targetId].some(
    (id) => !entityIds.has(id) || groupIds.has(id),
  );
}

/** Returns whether either endpoint of a dependency is in the given set. */
function touchesAny(
  dependency: Dependency,
  entityIds: ReadonlySet<string>,
): boolean {
  return (
    entityIds.has(dependency.sourceId) || entityIds.has(dependency.targetId)
  );
}
