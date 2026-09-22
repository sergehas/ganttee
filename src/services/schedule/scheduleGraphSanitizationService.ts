/**
 * Removal of scheduling structures a document cannot represent.
 *
 * Sanitization is destructive by design: it rewrites the document and reports
 * what it removed, so the caller can warn the user after the fact. It never
 * mutates the input.
 */

import { Dependency, ProjectDocument } from "@common/documents";
import { ProjectDependencyGraph } from "@common/models";
import {
  anchoredEntityIds,
  schedulableEntityIds,
  unanchoredComponents,
} from "@services/dependency-graph/componentAnchoringService";
import { removeIdsFromEverySequence } from "@services/ordering/sequenceOrderingService";

/** A sanitized document together with everything sanitization destroyed. */
export interface ScheduleGraphSanitization {
  /** The document with invalid structures removed. */
  document: ProjectDocument;
  /** Ids of dependencies that were removed, in document order. */
  removedDependencyIds: string[];
  /** Ids of entities that were removed, in document order. */
  removedEntityIds: string[];
}

/**
 * Removes dependencies with missing or group endpoints, then removes any
 * component left with no absolute date to anchor it, stripping removed ids
 * from every stored sequence.
 *
 * @param projectDoc The document to sanitize.
 * @returns The sanitized document and the ids of everything removed.
 */
export function sanitizeScheduleGraph(projectDoc: ProjectDocument): ScheduleGraphSanitization {
  const entityIds = new Set([
    ...projectDoc.tasks.map((task) => task.id),
    ...projectDoc.milestones.map((milestone) => milestone.id),
    ...projectDoc.groups.map((group) => group.id),
  ]);
  const groupIds = new Set(projectDoc.groups.map((group) => group.id));

  const supportedDependencies = projectDoc.dependencies.filter(
    (dependency) => !hasUnusableEndpoint(dependency, entityIds, groupIds),
  );
  const removedEntityIds = collectUnanchoredEntityIds(projectDoc, entityIds, supportedDependencies);

  const removedDependencyIds = projectDoc.dependencies
    .filter(
      (dependency) =>
        hasUnusableEndpoint(dependency, entityIds, groupIds) ||
        touchesAny(dependency, removedEntityIds),
    )
    .map((dependency) => dependency.id);

  const prunedDocument: ProjectDocument = {
    ...projectDoc,
    tasks: projectDoc.tasks.filter((task) => !removedEntityIds.has(task.id)),
    milestones: projectDoc.milestones.filter((milestone) => !removedEntityIds.has(milestone.id)),
    groups: projectDoc.groups.filter((group) => !removedEntityIds.has(group.id)),
    dependencies: supportedDependencies.filter(
      (dependency) => !touchesAny(dependency, removedEntityIds),
    ),
  };

  return {
    document:
      removedEntityIds.size > 0
        ? removeIdsFromEverySequence(prunedDocument, removedEntityIds)
        : prunedDocument,
    removedDependencyIds,
    removedEntityIds: [...removedEntityIds],
  };
}

/** Returns the ids of every entity in a component that has no date anchor. */
function collectUnanchoredEntityIds(
  projectDoc: ProjectDocument,
  entityIds: ReadonlySet<string>,
  dependencies: readonly Dependency[],
): ReadonlySet<string> {
  const graph = new ProjectDependencyGraph([...entityIds], dependencies);
  return new Set(
    unanchoredComponents(
      graph.connectedComponents(),
      anchoredEntityIds(projectDoc),
      schedulableEntityIds(projectDoc),
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
function touchesAny(dependency: Dependency, entityIds: ReadonlySet<string>): boolean {
  return entityIds.has(dependency.sourceId) || entityIds.has(dependency.targetId);
}
