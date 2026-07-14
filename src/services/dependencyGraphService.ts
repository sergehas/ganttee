import { Dependency, GanttDocument } from "../common/models";

/** Result of validating the dependency graph of a document. */
export interface GraphValidationResult {
  ok: boolean;
  /** Task ids that participate in a cycle, if any. */
  cycle: string[];
  /** Dependencies that reference a missing source or target task. */
  danglingDependencyIds: string[];
}

/**
 * Validates a document's dependency graph: detects cycles and dependencies that
 * reference unknown tasks.
 */
export function validateGraph(document: GanttDocument): GraphValidationResult {
  const taskIds = new Set(document.tasks.map((task) => task.id));
  const danglingDependencyIds = document.dependencies
    .filter((dep) => !taskIds.has(dep.sourceId) || !taskIds.has(dep.targetId))
    .map((dep) => dep.id);

  const validDependencies = document.dependencies.filter(
    (dep) => taskIds.has(dep.sourceId) && taskIds.has(dep.targetId),
  );
  const cycle = findCycle(validDependencies);

  return {
    ok: cycle.length === 0 && danglingDependencyIds.length === 0,
    cycle,
    danglingDependencyIds,
  };
}

/**
 * Returns whether adding `candidate` to the existing dependencies would create a
 * cycle. The candidate is not mutated into the document.
 */
export function wouldCreateCycle(
  dependencies: readonly Dependency[],
  candidate: Dependency,
): boolean {
  return findCycle([...dependencies, candidate]).length > 0;
}

/**
 * Returns task ids in a valid execution order (predecessors before successors).
 * Throws if the graph contains a cycle.
 */
export function topologicalOrder(document: GanttDocument): string[] {
  const adjacency = buildAdjacency(document.dependencies);
  const inDegree = new Map<string, number>();
  for (const task of document.tasks) {
    inDegree.set(task.id, 0);
  }
  for (const targets of adjacency.values()) {
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const target of adjacency.get(id) ?? []) {
      const next = (inDegree.get(target) ?? 0) - 1;
      inDegree.set(target, next);
      if (next === 0) {
        queue.push(target);
      }
    }
  }

  if (order.length !== inDegree.size) {
    throw new Error(
      "Cannot compute a topological order: the graph has a cycle.",
    );
  }
  return order;
}

function buildAdjacency(
  dependencies: readonly Dependency[],
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const dep of dependencies) {
    const targets = adjacency.get(dep.sourceId) ?? [];
    targets.push(dep.targetId);
    adjacency.set(dep.sourceId, targets);
  }
  return adjacency;
}

function findCycle(dependencies: readonly Dependency[]): string[] {
  const adjacency = buildAdjacency(dependencies);
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
