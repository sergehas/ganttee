/**
 * Structural rules over a plain {@link GanttDocument}'s dependency edges.
 *
 * The three assertions form an escalating ladder: integrity checks the edges
 * themselves, acyclic adds ordering, and resolvable additionally requires every
 * endpoint to exist. Semantic rules live in `scheduleGraphValidationService`.
 */

import {
  CyclicDependencyError,
  DanglingDependencyError,
  Dependency,
  DependencyGraph,
  GanttDocument,
  ParallelEdgeDependencyError,
  SelfLoopDependencyError,
} from "../common/models";

/**
 * Asserts that every edge is well formed: no entity depends on itself and no
 * ordered pair is connected twice. Missing endpoints and cycles are tolerated.
 *
 * @param document The document whose dependency edges are checked.
 * @returns The dependency graph built from the document.
 * @throws {SelfLoopDependencyError} When a dependency links an entity to itself.
 * @throws {ParallelEdgeDependencyError} When an ordered pair has two edges.
 */
export function assertGraphIntegrity(document: GanttDocument): DependencyGraph {
  const seenPairs = new Set<string>();
  for (const dependency of document.dependencies) {
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
  return new DependencyGraph([...nodeIdsOf(document)], document.dependencies);
}

/**
 * Asserts graph integrity and that the edges can be ordered. Missing endpoints
 * are tolerated.
 *
 * @param document The document whose dependency edges are checked.
 * @returns The dependency graph built from the document.
 * @throws {CyclicDependencyError} When the dependency set contains a cycle.
 */
export function assertAcyclicGraph(document: GanttDocument): DependencyGraph {
  const graph = assertGraphIntegrity(document);
  const cycle = graph.findCycle();
  if (cycle.length > 0) {
    throw new CyclicDependencyError(cycle);
  }
  return graph;
}

/**
 * Asserts that the graph is acyclic and that every endpoint resolves to an
 * entity in the document.
 *
 * @param document The document whose dependency edges are checked.
 * @returns The dependency graph built from the document.
 * @throws {DanglingDependencyError} When an endpoint is not an entity id.
 */
export function assertResolvableGraph(
  document: GanttDocument,
): DependencyGraph {
  const nodeIds = nodeIdsOf(document);
  for (const dependency of document.dependencies) {
    for (const endpointId of [dependency.sourceId, dependency.targetId]) {
      if (!nodeIds.has(endpointId)) {
        throw new DanglingDependencyError(dependency.id, endpointId);
      }
    }
  }
  return assertAcyclicGraph(document);
}

/**
 * Returns whether adding `candidate` to a document would close a cycle. The
 * document is not modified.
 *
 * @param document The document the dependency would be added to.
 * @param candidate The dependency being considered.
 */
export function wouldCreateCycle(
  document: GanttDocument,
  candidate: Dependency,
): boolean {
  return new DependencyGraph(
    [...nodeIdsOf(document)],
    document.dependencies,
  ).wouldCreateCycle(candidate);
}

/**
 * Returns task and milestone ids in an order where every entity follows the
 * entities it depends on. Groups are excluded: they carry no dependencies.
 *
 * @param document The document to order.
 * @returns The ordered entity ids.
 * @throws {CyclicDependencyError} When the graph contains a cycle.
 * @throws {DanglingDependencyError} When an endpoint is not an entity id.
 */
export function topologicalOrder(document: GanttDocument): string[] {
  assertResolvableGraph(document);
  const nodeIds = [
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
  ];
  const scheduled = new Set(nodeIds);
  const dependencies = document.dependencies.filter(
    (dependency) =>
      scheduled.has(dependency.sourceId) && scheduled.has(dependency.targetId),
  );
  return [...new DependencyGraph(nodeIds, dependencies).topologicalSort()];
}

/** Returns the id of every entity that can take part in the dependency graph. */
function nodeIdsOf(document: GanttDocument): ReadonlySet<string> {
  return new Set([
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
    ...document.groups.map((group) => group.id),
  ]);
}
