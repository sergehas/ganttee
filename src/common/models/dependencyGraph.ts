/**
 * Structural directed acyclic graph over schedulable entity ids and their
 * scheduling dependencies.
 *
 * The graph is the backbone every downstream concern (graph validation, the
 * scheduling engine) traverses. It is framework-agnostic and browser-safe: it
 * must not import from "vscode" or any browser/node globals, so a future
 * webview pre-flight validator can reuse it.
 *
 * Edges are oriented `sourceId → targetId`, mirroring the persisted
 * {@link Dependency} records.
 */

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
export class DependencyGraph {
  /** Every node id, in insertion order. */
  private readonly _nodes: readonly string[];
  /** Outgoing adjacency: source id → target ids. */
  private readonly _outgoing: ReadonlyMap<string, readonly string[]>;
  /** Incoming adjacency: target id → source ids. */
  private readonly _incoming: ReadonlyMap<string, readonly string[]>;

  /**
   * @param nodeIds All schedulable entity ids (tasks + milestones + groups).
   * Ids referenced by a dependency but absent from this list are added to the
   * node set so an unvalidated edge set is still fully traversable.
   * @param dependencies The dependency records forming the edges.
   */
  constructor(
    nodeIds: readonly string[],
    private readonly dependencies: readonly Dependency[],
  ) {
    const nodes = new Set(nodeIds);
    for (const dependency of dependencies) {
      nodes.add(dependency.sourceId);
      nodes.add(dependency.targetId);
    }
    this._nodes = [...nodes];
    this._outgoing = buildAdjacency(dependencies, false);
    this._incoming = buildAdjacency(dependencies, true);
  }

  /** All node ids in the graph. */
  get nodes(): readonly string[] {
    return this._nodes;
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
    return findCycleIn(this._outgoing);
  }

  /**
   * Returns `true` if adding `candidate` to the current edges would create a
   * directed cycle. Does not mutate the graph.
   *
   * @param candidate The dependency being considered.
   */
  wouldCreateCycle(candidate: Dependency): boolean {
    const adjacency = buildAdjacency([...this.dependencies, candidate], false);
    return findCycleIn(adjacency).length > 0;
  }

  /**
   * Returns every node id in topological order (predecessors before
   * successors). Isolated nodes are included.
   *
   * @throws {CyclicDependencyError} When the graph contains a cycle.
   */
  topologicalSort(): readonly string[] {
    const inDegree = new Map<string, number>(
      this._nodes.map((id) => [id, this._incoming.get(id)?.length ?? 0]),
    );
    const queue = this._nodes.filter((id) => inDegree.get(id) === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const target of this._outgoing.get(id) ?? []) {
        const next = (inDegree.get(target) ?? 0) - 1;
        inDegree.set(target, next);
        if (next === 0) {
          queue.push(target);
        }
      }
    }

    if (order.length !== this._nodes.length) {
      throw new CyclicDependencyError(this.findCycle());
    }
    return order;
  }

  /**
   * Returns one array of node ids per weakly-connected component. Isolated
   * nodes appear as single-element arrays.
   */
  connectedComponents(): readonly (readonly string[])[] {
    const parent = new Map<string, string>(this._nodes.map((id) => [id, id]));

    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) !== root) {
        root = parent.get(root)!;
      }
      let cursor = id;
      while (parent.get(cursor) !== root) {
        const next = parent.get(cursor)!;
        parent.set(cursor, root);
        cursor = next;
      }
      return root;
    };

    for (const dependency of this.dependencies) {
      const sourceRoot = find(dependency.sourceId);
      const targetRoot = find(dependency.targetId);
      if (sourceRoot !== targetRoot) {
        parent.set(sourceRoot, targetRoot);
      }
    }

    const components = new Map<string, string[]>();
    for (const id of this._nodes) {
      const root = find(id);
      const members = components.get(root) ?? [];
      members.push(id);
      components.set(root, members);
    }
    return [...components.values()];
  }

  /**
   * Returns the ids of the nodes that `id` depends on (incoming edges).
   *
   * @param id The node to inspect.
   */
  predecessors(id: string): readonly string[] {
    return this._incoming.get(id) ?? [];
  }

  /**
   * Returns the ids of the nodes that depend on `id` (outgoing edges).
   *
   * @param id The node to inspect.
   */
  successors(id: string): readonly string[] {
    return this._outgoing.get(id) ?? [];
  }
}

/**
 * Builds an adjacency map from the dependency edges.
 *
 * @param dependencies The edges to index.
 * @param reversed When `true`, indexes `targetId → sourceId` instead of
 * `sourceId → targetId`.
 */
function buildAdjacency(
  dependencies: readonly Dependency[],
  reversed: boolean,
): ReadonlyMap<string, readonly string[]> {
  const adjacency = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const from = reversed ? dependency.targetId : dependency.sourceId;
    const to = reversed ? dependency.sourceId : dependency.targetId;
    const neighbours = adjacency.get(from) ?? [];
    neighbours.push(to);
    adjacency.set(from, neighbours);
  }
  return adjacency;
}

/**
 * Depth-first search for a directed cycle.
 *
 * @param adjacency The forward adjacency map to traverse.
 * @returns The ids forming the first cycle found, or `[]` when acyclic.
 */
function findCycleIn(
  adjacency: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): string[] | undefined => {
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
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

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      const found = visit(node);
      if (found) {
        return found;
      }
    }
  }
  return [];
}
