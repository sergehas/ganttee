/**
 * Validation helpers over a plain {@link GanttDocument}'s dependency set.
 *
 * This is a thin adapter around {@link DependencyGraph}: it keeps a
 * document-shaped API for callers that work with the plain, ISO-string document
 * rather than the hydrated `GanttModel`.
 */

import { Dependency, DependencyGraph, GanttDocument } from "../common/models";

/** Result of validating the dependency graph of a document. */
export interface GraphValidationResult {
  ok: boolean;
  /** Entity ids that participate in a cycle, if any. */
  cycle: string[];
  /** Dependencies that reference a missing source or target entity. */
  danglingDependencyIds: string[];
}

/**
 * Validates a document's dependency graph: detects cycles and dependencies that
 * reference unknown tasks or milestones.
 *
 * @param document The plain document to validate.
 */
export function validateGraph(document: GanttDocument): GraphValidationResult {
  const nodeIds = new Set([
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
  ]);
  const danglingDependencyIds = document.dependencies
    .filter((dep) => !nodeIds.has(dep.sourceId) || !nodeIds.has(dep.targetId))
    .map((dep) => dep.id);

  const validDependencies = document.dependencies.filter(
    (dep) => nodeIds.has(dep.sourceId) && nodeIds.has(dep.targetId),
  );
  const cycle = [
    ...new DependencyGraph([...nodeIds], validDependencies).findCycle(),
  ];

  return {
    ok: cycle.length === 0 && danglingDependencyIds.length === 0,
    cycle,
    danglingDependencyIds,
  };
}

/**
 * Returns whether adding `candidate` to the existing dependencies would create a
 * cycle. The candidate is not mutated into the document.
 *
 * @param dependencies The dependencies already in the document.
 * @param candidate The dependency being considered.
 */
export function wouldCreateCycle(
  dependencies: readonly Dependency[],
  candidate: Dependency,
): boolean {
  return new DependencyGraph([], dependencies).wouldCreateCycle(candidate);
}

/**
 * Returns task ids in a valid execution order (predecessors before successors).
 *
 * @param document The plain document to order.
 * @throws {CyclicDependencyError} When the graph contains a cycle.
 */
export function topologicalOrder(document: GanttDocument): string[] {
  const nodeIds = document.tasks.map((task) => task.id);
  return [
    ...new DependencyGraph(nodeIds, document.dependencies).topologicalSort(),
  ];
}
