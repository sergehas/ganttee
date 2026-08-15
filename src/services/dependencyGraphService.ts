/**
 * Validation helpers over a plain {@link GanttDocument}'s dependency set.
 *
 * This is a thin adapter around {@link DependencyGraph}: it keeps a
 * document-shaped API for callers that work with the plain, ISO-string document
 * rather than the hydrated `GanttModel`.
 */

import {
  Dependency,
  DependencyGraph,
  GanttDocument,
  GanttModel,
} from "../common/models";
import { getEffectiveConstraintCount } from "./taskConstraintService";

/** Result of validating the dependency graph of a document. */
export interface GraphValidationResult {
  ok: boolean;
  /** Entity ids that participate in a cycle, if any. */
  cycle: string[];
  /** Dependencies that reference a missing source or target entity. */
  danglingDependencyIds: string[];
  /** Task/milestone ids that are under-constrained (fewer than 2 effective constraints). */
  underConstrainedIds: string[];
  /** Task/milestone ids that are over-constrained (more than 2 effective constraints). */
  overConstrainedIds: string[];
  /** Dependency ids whose source is a milestone and whose type is `endWith`. */
  milestoneReverseOwnerIds: string[];
  /** Dependency ids with a group as source or target. */
  groupDependencyIds: string[];
  /** Representative ids of components lacking an absolute date anchor. */
  unanchoredComponentIds: string[];
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
    underConstrainedIds: [],
    overConstrainedIds: [],
    milestoneReverseOwnerIds: [],
    groupDependencyIds: [],
    unanchoredComponentIds: [],
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

/**
 * Validates the semantic constraints of a hydrated model: determinacy,
 * milestone-as-reverse-owner, group-as-endpoint, and component anchoring.
 *
 * @param model The hydrated GanttModel.
 * @returns A validation result with semantic violation ids.
 */
export function validateSemanticGraph(
  model: GanttModel,
): GraphValidationResult {
  const graph = model.graph;
  const taskIds = new Set(model.tasks.map((t) => t.id));
  const milestoneIds = new Set(model.milestones.map((m) => m.id));
  const groupIds = new Set(model.groups.map((g) => g.id));

  // Check determinacy per task
  const underConstrainedIds: string[] = [];
  const overConstrainedIds: string[] = [];

  for (const task of model.tasks) {
    const effectiveCount = getEffectiveConstraintCount(task.id, model, graph);
    if (effectiveCount < 2) {
      underConstrainedIds.push(task.id);
    } else if (effectiveCount > 2) {
      overConstrainedIds.push(task.id);
    }
  }

  // For milestones, apply determinacy check as well
  // (they have a single `date` constraint, so they need 1 incoming dependency to be determinate)
  // For now, we'll consider milestones as always determinate (they have a hard date).
  // This may need adjustment based on the scheduling engine's requirements.

  // Check milestone-as-reverse-owner and group-as-endpoint
  const milestoneReverseOwnerIds: string[] = [];
  const groupDependencyIds: string[] = [];

  for (const dependency of model.dependencies) {
    // Milestone as source of endWith dependency
    if (
      dependency.type === "endWith" &&
      milestoneIds.has(dependency.sourceId)
    ) {
      milestoneReverseOwnerIds.push(dependency.id);
    }

    // Group as source or target
    if (
      groupIds.has(dependency.sourceId) ||
      groupIds.has(dependency.targetId)
    ) {
      groupDependencyIds.push(dependency.id);
    }
  }

  // Check component anchoring: each weakly-connected component containing
  // at least one task or milestone must have an absolute date anchor.
  const unanchoredComponentIds: string[] = [];
  const components = graph.connectedComponents();

  for (const component of components) {
    // Check if component has any tasks or milestones (not just groups)
    const hasSchedulableItem = component.some(
      (id) => taskIds.has(id) || milestoneIds.has(id),
    );
    if (!hasSchedulableItem) {
      // Component consists only of groups; exempt from anchor requirement
      continue;
    }

    // Check if component has an absolute date anchor
    let hasAnchor = false;
    for (const id of component) {
      if (taskIds.has(id)) {
        const task = model.tasks.find((t) => t.id === id);
        if (task && (task.start !== undefined || task.end !== undefined)) {
          hasAnchor = true;
          break;
        }
      } else if (milestoneIds.has(id)) {
        // Milestones always have a date, so they always provide an anchor
        hasAnchor = true;
        break;
      }
    }

    if (!hasAnchor) {
      // Report the first task/milestone id in the component as the representative
      const representative = component.find(
        (id) => taskIds.has(id) || milestoneIds.has(id),
      );
      if (representative) {
        unanchoredComponentIds.push(representative);
      }
    }
  }

  return {
    ok:
      underConstrainedIds.length === 0 &&
      overConstrainedIds.length === 0 &&
      milestoneReverseOwnerIds.length === 0 &&
      groupDependencyIds.length === 0 &&
      unanchoredComponentIds.length === 0,
    cycle: [], // Semantic validation operates on a hydrated model, so cycles are already excluded
    danglingDependencyIds: [],
    underConstrainedIds,
    overConstrainedIds,
    milestoneReverseOwnerIds,
    groupDependencyIds,
    unanchoredComponentIds,
  };
}
