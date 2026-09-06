/**
 * Structural directed acyclic graph over schedulable entity ids and their
 * scheduling dependencies.
 *
 * The graph is the backbone every downstream concern (graph validation, the
 * scheduling engine) traverses. It is framework-agnostic and browser-safe: it
 * must not import from "vscode" or any browser/node globals, so a future
 * webview pre-flight validator can reuse it.
 *
 * Edges are oriented `targetId → sourceId`, so topological traversal visits a
 * dependency target before the constrained source.
 */

import { DirectedGraph } from "graphology";
import { connectedComponents as graphologyConnectedComponents } from "graphology-components";
import {
  hasCycle as graphologyHasCycle,
  topologicalSort as graphologyTopologicalSort,
  willCreateCycle as graphologyWillCreateCycle,
} from "graphology-dag";
import { Dependency } from "./dependency";

/** Thrown when a dependency links an entity to itself. */
export class SelfLoopDependencyError extends Error {
  /**
   * @param dependencyId The id of the offending dependency.
   */
  constructor(readonly dependencyId: string) {
    super(`Dependency "${dependencyId}" links an entity to itself.`);
  }
}

/** Thrown when two dependencies share the same source/target pair. */
export class ParallelEdgeDependencyError extends Error {
  /**
   * @param sourceId The shared source entity id.
   * @param targetId The shared target entity id.
   */
  constructor(
    readonly sourceId: string,
    readonly targetId: string,
  ) {
    super(
      `Duplicate dependency between "${sourceId}" and "${targetId}": only one edge is allowed per ordered pair.`,
    );
  }
}

/** Thrown when the dependency set contains a directed cycle. */
export class CyclicDependencyError extends Error {
  /**
   * @param cycle The entity ids that participate in the cycle, in traversal
   * order.
   */
  constructor(readonly cycle: readonly string[]) {
    super(`Dependency cycle detected: ${cycle.join(" -> ")}.`);
  }
}

/** Thrown when a dependency references an entity that is not in the document. */
export class DanglingDependencyError extends Error {
  /**
   * @param dependencyId The id of the offending dependency.
   * @param endpointId The missing source or target entity id.
   */
  constructor(
    readonly dependencyId: string,
    readonly endpointId: string,
  ) {
    super(
      `Dependency "${dependencyId}" references unknown entity "${endpointId}".`,
    );
  }
}

/**
 * Directed graph over a set of node ids and typed dependency edges.
 *
 * A graph built by hydration is guaranteed acyclic; instances built directly
 * (for validation of an unvalidated edge set) may contain cycles, which the
 * inspection methods report.
 */
export class DependencyGraph extends DirectedGraph<
  Record<string, never>,
  { dependency: Dependency }
> {
  /**
   * @param nodeIds All schedulable entity ids.
   * @param dependencies The dependency records forming the edges.
   */
  constructor(nodeIds: readonly string[], dependencies: readonly Dependency[]) {
    super({ allowSelfLoops: true, multi: false });
    const nodes = new Set(nodeIds);
    for (const dependency of dependencies) {
      nodes.add(dependency.sourceId);
      nodes.add(dependency.targetId);
    }
    for (const nodeId of nodes) {
      this.addNode(nodeId, {});
    }
    for (const dependency of dependencies) {
      this.addDirectedEdgeWithKey(
        dependency.id,
        dependency.targetId,
        dependency.sourceId,
        { dependency },
      );
    }
  }

  /**
   * Returns `true` if the dependency set contains a directed cycle. Always
   * `false` on a successfully hydrated `GanttModel.graph`.
   */
  hasCycle(): boolean {
    return graphologyHasCycle(this);
  }

  /**
   * Returns the node ids that participate in a directed cycle, or an empty
   * array when the graph is acyclic. Always `[]` on a successfully hydrated
   * `GanttModel.graph`.
   */
  findCycle(): readonly string[] {
    return findCycleIn(this);
  }

  /**
   * Returns `true` if adding `candidate` to the current edges would create a
   * directed cycle. Does not mutate the graph.
   *
   * @param candidate The dependency being considered.
   */
  wouldCreateCycle(candidate: Dependency): boolean {
    if (candidate.sourceId === candidate.targetId) {
      return true;
    }
    if (
      !this.hasNode(candidate.sourceId) ||
      !this.hasNode(candidate.targetId)
    ) {
      return false;
    }
    return graphologyWillCreateCycle(
      this,
      candidate.targetId,
      candidate.sourceId,
    );
  }

  /**
   * Returns every node id in topological order (predecessors before
   * successors). Isolated nodes are included.
   *
   * @throws {CyclicDependencyError} When the graph contains a cycle.
   */
  topologicalSort(): readonly string[] {
    try {
      return graphologyTopologicalSort(this);
    } catch (error) {
      if (!graphologyHasCycle(this)) {
        throw error;
      }
      throw new CyclicDependencyError(this.findCycle());
    }
  }

  /**
   * Returns one array of node ids per weakly-connected component. Isolated
   * nodes appear as single-element arrays.
   */
  connectedComponents(): readonly (readonly string[])[] {
    return graphologyConnectedComponents(this);
  }

  /**
   * Returns the ids of the nodes that `id` depends on (incoming edges).
   *
   * @param id The node to inspect.
   */
  predecessors(id: string): readonly string[] {
    return this.inNeighbors(id);
  }

  /**
   * Returns the ids of the nodes that depend on `id` (outgoing edges).
   *
   * @param id The node to inspect.
   */
  successors(id: string): readonly string[] {
    return this.outNeighbors(id);
  }

  /**
   * Returns every authoring dependency owned by a constrained source.
   *
   * @param sourceId The constrained source entity id.
   */
  dependenciesOf(sourceId: string): readonly Dependency[] {
    if (!this.hasNode(sourceId)) {
      return [];
    }
    return this.inEdges(sourceId).map((edge) =>
      this.getEdgeAttribute(edge, "dependency"),
    );
  }
}

/**
 * Depth-first search for a directed cycle.
 *
 * @param adjacency The forward adjacency map to traverse.
 * @returns The ids forming the first cycle found, or `[]` when acyclic.
 */
function findCycleIn(graph: DependencyGraph): readonly string[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): string[] | undefined => {
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of graph.outNeighbors(node)) {
      if (stack.has(next)) {
        return [...path.slice(path.indexOf(next)), next];
      }
      if (!visited.has(next)) {
        const found = visit(next);
        if (found) {
          return found;
        }
      }
    }
    stack.delete(node);
    path.pop();
    return undefined;
  };

  for (const node of graph.nodes()) {
    if (!visited.has(node)) {
      const found = visit(node);
      if (found) {
        return found;
      }
    }
  }
  return [];
}
