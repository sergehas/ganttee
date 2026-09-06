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
 * Immutable directed graph over a set of node ids and typed dependency edges.
 *
 * A graph built by hydration is guaranteed acyclic; instances built directly
 * (for validation of an unvalidated edge set) may contain cycles, which the
 * inspection methods report.
 */
export class DependencyGraph extends DirectedGraph<
  Record<string, never>,
  { dependency: Dependency }
> {
  /** Dependencies indexed by their constrained source entity. */
  private readonly _dependenciesBySource = new Map<string, Dependency[]>();

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
      const owned = this._dependenciesBySource.get(dependency.sourceId) ?? [];
      owned.push(dependency);
      this._dependenciesBySource.set(dependency.sourceId, owned);
    }
  }

  /**
   * Returns `true` if the dependency set contains a directed cycle. Always
   * `false` on a successfully hydrated `GanttModel.graph`.
   */
  hasCycle(): boolean {
    return this.findCycle().length > 0;
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
    return isReachable(this, candidate.sourceId, candidate.targetId);
  }

  /**
   * Returns every node id in topological order (predecessors before
   * successors). Isolated nodes are included.
   *
   * @throws {CyclicDependencyError} When the graph contains a cycle.
   */
  topologicalSort(): readonly string[] {
    const inDegree = new Map<string, number>(
      this.nodes().map((id) => [id, this.inDegree(id)]),
    );
    const queue = this.nodes().filter((id) => inDegree.get(id) === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const successor of this.outNeighbors(id)) {
        const next = (inDegree.get(successor) ?? 0) - 1;
        inDegree.set(successor, next);
        if (next === 0) {
          queue.push(successor);
        }
      }
    }

    if (order.length !== this.order) {
      throw new CyclicDependencyError(this.findCycle());
    }
    return order;
  }

  /**
   * Returns one array of node ids per weakly-connected component. Isolated
   * nodes appear as single-element arrays.
   */
  connectedComponents(): readonly (readonly string[])[] {
    const remaining = new Set(this.nodes());
    const components: string[][] = [];
    while (remaining.size > 0) {
      const first = remaining.values().next().value!;
      const component: string[] = [];
      const queue = [first];
      remaining.delete(first);
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        component.push(nodeId);
        for (const neighbor of this.neighbors(nodeId)) {
          if (remaining.delete(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
      components.push(component);
    }
    return components;
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
    return this._dependenciesBySource.get(sourceId) ?? [];
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

/** Returns whether `targetId` is reachable from `sourceId`. */
function isReachable(
  graph: DependencyGraph,
  sourceId: string,
  targetId: string,
): boolean {
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) {
    return false;
  }
  const visited = new Set<string>([sourceId]);
  const queue = [sourceId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const next of graph.outNeighbors(nodeId)) {
      if (next === targetId) {
        return true;
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}
