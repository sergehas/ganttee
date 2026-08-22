/**
 * Validation helpers over a plain {@link GanttDocument}'s dependency set.
 *
 * This is a thin adapter around {@link DependencyGraph}: it keeps a
 * document-shaped API for callers that work with the plain, ISO-string document
 * rather than the hydrated `GanttModel`.
 */

import {
  CyclicDependencyError,
  DanglingDependencyError,
  Dependency,
  DependencyGraph,
  GanttDocument,
  GanttModel,
  ParallelEdgeDependencyError,
  SelfLoopDependencyError,
} from "../common/models";
import {
  describeMilestoneConstraintValidation,
  describeTaskConstraintValidation,
} from "./taskConstraintService";

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
  /** Items with duplicate constraints on the same endpoint. */
  duplicateEndpointIds: string[];
  /** Effective constraint count by task id. */
  constraintCounts: Record<string, number>;
  /** Dependency ids with a group as source or target. */
  groupDependencyIds: string[];
  /** Representative ids of components lacking an absolute date anchor. */
  unanchoredComponentIds: string[];
}

/** Result of removing invalid scheduling structures from a document. */
export interface DocumentSanitizationResult {
  /** The document after invalid dependencies and components are removed. */
  document: GanttDocument;
  /** Dependency ids removed during sanitization. */
  removedDependencyIds: string[];
  /** Entity ids removed as part of unanchored components. */
  removedEntityIds: string[];
}

/**
 * Removes invalid dependencies and unanchored components from a document.
 *
 * This is a pure normalization step. It does not mutate the input document and
 * leaves task and milestone determinacy violations for semantic validation.
 */
export function sanitizeDocument(
  document: GanttDocument,
): DocumentSanitizationResult {
  const entityIds = new Set([
    ...document.tasks.map(task => task.id),
    ...document.milestones.map(milestone => milestone.id),
    ...document.groups.map(group => group.id),
  ]);
  const groupIds = new Set(document.groups.map(group => group.id));
  const removedDependencyIds: string[] = [];
  const validDependencies = document.dependencies.filter(dependency => {
    const isDangling =
      !entityIds.has(dependency.sourceId) ||
      !entityIds.has(dependency.targetId);
    const usesGroup =
      groupIds.has(dependency.sourceId) || groupIds.has(dependency.targetId);
    if (isDangling || usesGroup) {
      removedDependencyIds.push(dependency.id);
      return false;
    }
    return true;
  });

  const graph = new DependencyGraph(
    [...entityIds],
    validDependencies,
  );
  const taskIds = new Set(document.tasks.map(task => task.id));
  const milestoneIds = new Set(document.milestones.map(milestone => milestone.id));
  const removedEntityIds = new Set<string>();

  for (const component of graph.connectedComponents()) {
    const isSchedulable = component.some(
      id => taskIds.has(id) || milestoneIds.has(id),
    );
    if (!isSchedulable || hasAbsoluteAnchor(component, document, taskIds, milestoneIds)) {
      continue;
    }
    for (const id of component) {
      removedEntityIds.add(id);
    }
  }

  const remainingEntityIds = new Set(
    [...entityIds].filter(id => !removedEntityIds.has(id)),
  );
  const dependencies = validDependencies.filter(
    dependency =>
      remainingEntityIds.has(dependency.sourceId) &&
      remainingEntityIds.has(dependency.targetId),
  );
  removedEntityIds.forEach(id => {
    document.dependencies.forEach(dependency => {
      if (
        (dependency.sourceId === id || dependency.targetId === id) &&
        !removedDependencyIds.includes(dependency.id)
      ) {
        removedDependencyIds.push(dependency.id);
      }
    });
  });

  return {
    document: {
      ...document,
      tasks: document.tasks.filter(task => !removedEntityIds.has(task.id)),
      milestones: document.milestones.filter(
        milestone => !removedEntityIds.has(milestone.id),
      ),
      groups: document.groups.filter(group => !removedEntityIds.has(group.id)),
      dependencies,
    },
    removedDependencyIds,
    removedEntityIds: [...removedEntityIds],
  };
}

/** Returns whether a dependency component contains a static date anchor. */
function hasAbsoluteAnchor(
  component: readonly string[],
  document: GanttDocument,
  taskIds: ReadonlySet<string>,
  milestoneIds: ReadonlySet<string>,
): boolean {
  return component.some(id => {
    if (taskIds.has(id)) {
      const task = document.tasks.find(candidate => candidate.id === id);
      return task?.start !== undefined || task?.end !== undefined;
    }
    if (milestoneIds.has(id)) {
      const milestone = document.milestones.find(candidate => candidate.id === id);
      return milestone?.date !== undefined;
    }
    return false;
  });
}

/**
 * Validates dependency endpoints and structural DAG rules before hydration.
 *
 * @param document The plain document whose dependency graph is validated.
 * @param checkCycles Whether to reject directed cycles in the edge set.
 * @throws {DanglingDependencyError} When an endpoint is not an entity id.
 * @throws {SelfLoopDependencyError} When a dependency links an entity to itself.
 * @throws {ParallelEdgeDependencyError} When an ordered pair has two edges.
 * @throws {CyclicDependencyError} When the dependency set contains a cycle.
 */
export function validateStructuralGraph(
  document: GanttDocument,
  checkCycles = true,
  allowDangling = false,
): DependencyGraph {
  const nodeIds = new Set([
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
    ...document.groups.map((group) => group.id),
  ]);

  const seenPairs = new Set<string>();
  for (const dependency of document.dependencies) {
    if (!allowDangling && !nodeIds.has(dependency.sourceId)) {
      throw new DanglingDependencyError(dependency.id, dependency.sourceId);
    }
    if (!allowDangling && !nodeIds.has(dependency.targetId)) {
      throw new DanglingDependencyError(dependency.id, dependency.targetId);
    }
    if (dependency.sourceId === dependency.targetId) {
      throw new SelfLoopDependencyError(dependency.id);
    }
    const pair = `${dependency.sourceId}\u0000${dependency.targetId}`;
    if (seenPairs.has(pair)) {
      throw new ParallelEdgeDependencyError(
        dependency.sourceId,
        dependency.targetId,
      );
    }
    seenPairs.add(pair);
  }

  const graph = new DependencyGraph([...nodeIds], document.dependencies);
  if (checkCycles) {
    const cycle = graph.findCycle();
    if (cycle.length > 0) {
      throw new CyclicDependencyError(cycle);
    }
  }
  return graph;
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
  validateStructuralGraph(document);
  const nodeIds = [
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
  ];
  const nodeIdSet = new Set(nodeIds);
  const dependencies = document.dependencies.filter(
    (dependency) =>
      nodeIdSet.has(dependency.sourceId) && nodeIdSet.has(dependency.targetId),
  );
  return [...new DependencyGraph(nodeIds, dependencies).topologicalSort()];
}

/**
 * Validates the semantic constraints of a hydrated model: determinacy,
 * group-as-endpoint, and component anchoring.
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
  const duplicateEndpointIds: string[] = [];
  const constraintCounts: Record<string, number> = {};

  for (const task of model.tasks) {
    const validation = describeTaskConstraintValidation(
      task,
      model.dependencies,
    );
    constraintCounts[task.id] = validation.count;
    if (validation.underConstrained) {
      underConstrainedIds.push(task.id);
    } else if (validation.overConstrained) {
      overConstrainedIds.push(task.id);
    }
    if (validation.duplicateStart || validation.duplicateEnd) {
      duplicateEndpointIds.push(task.id);
    }
  }

  for (const milestone of model.milestones) {
    const validation = describeMilestoneConstraintValidation(
      {
        id: milestone.id,
        name: milestone.name,
        date:
          milestone.date === undefined
            ? undefined
            : milestone.date.toISOString().slice(0, 10),
      },
      model.dependencies,
    );
    constraintCounts[milestone.id] = validation.count;
    if (validation.underConstrained) {
      underConstrainedIds.push(milestone.id);
    } else if (validation.overConstrained) {
      overConstrainedIds.push(milestone.id);
    }
    if (validation.duplicateStart || validation.duplicateEnd) {
      duplicateEndpointIds.push(milestone.id);
    }
  }

  const knownIds = new Set([
    ...model.tasks.map((task) => task.id),
    ...model.milestones.map((milestone) => milestone.id),
    ...model.groups.map((group) => group.id),
  ]);
  const danglingDependencyIds = model.dependencies
    .filter(
      (dependency) =>
        !knownIds.has(dependency.sourceId) ||
        !knownIds.has(dependency.targetId),
    )
    .map((dependency) => dependency.id);

  // Check group-as-endpoint.
  const groupDependencyIds: string[] = [];

  for (const dependency of model.dependencies) {
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
        const milestone = model.milestones.find(
          (candidate) => candidate.id === id,
        );
        if (milestone?.date !== undefined) {
          hasAnchor = true;
          break;
        }
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
      overConstrainedIds.every((id) => duplicateEndpointIds.includes(id)) &&
      danglingDependencyIds.length === 0 &&
      groupDependencyIds.length === 0 &&
      unanchoredComponentIds.length === 0,
    cycle: [], // Semantic validation operates on a hydrated model, so cycles are already excluded
    danglingDependencyIds,
    underConstrainedIds,
    overConstrainedIds,
    duplicateEndpointIds,
    constraintCounts,
    groupDependencyIds,
    unanchoredComponentIds,
  };
}
