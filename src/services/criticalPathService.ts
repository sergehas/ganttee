import { DependencyGraph, Schedulable, ScheduledModel } from "../common/models";

/** Identifies the single derived path emphasized by the chart. */
export interface CriticalPathProjection {
  /** Ordered node ids from the path start to its terminal node. */
  readonly nodeIds: readonly string[];
  /** Dependency ids connecting the projected nodes. */
  readonly dependencyIds: readonly string[];
}

/** Projects one deterministic longest chain from an acyclic scheduled graph. */
export function projectCriticalPath(
  graph: DependencyGraph,
  scheduled: ScheduledModel,
): CriticalPathProjection {
  const entities = new Map<string, Schedulable>([
    ...scheduled.tasks.map(
      (task) => [task.id, task as Schedulable] as [string, Schedulable],
    ),
    ...scheduled.milestones.map(
      (milestone) =>
        [milestone.id, milestone as Schedulable] as [string, Schedulable],
    ),
  ]);
  const scores = new Map<string, number>();
  const paths = new Map<string, string[]>();
  for (const nodeId of graph.topologicalSort()) {
    const entity = entities.get(nodeId);
    if (entity === undefined) {
      continue;
    }
    let bestPath = [nodeId];
    let bestScore = entity.effectiveDuration();
    for (const predecessor of graph.predecessors(nodeId)) {
      const predecessorScore = scores.get(predecessor);
      if (predecessorScore === undefined) {
        continue;
      }
      const candidateScore = predecessorScore + entity.effectiveDuration();
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestPath = [...(paths.get(predecessor) ?? [predecessor]), nodeId];
      }
    }
    scores.set(nodeId, bestScore);
    paths.set(nodeId, bestPath);
  }
  if (scores.size === 0) {
    return { nodeIds: [], dependencyIds: [] };
  }
  const terminal = [...scores.entries()].reduce((best, current) =>
    current[1] > best[1] ? current : best,
  );
  const nodeIds = paths.get(terminal[0]) ?? [];
  const dependencyIds = nodeIds.slice(1).map((nodeId, index) => {
    const edge = graph.edge(nodeIds[index], nodeId);
    return edge === undefined
      ? ""
      : graph.getEdgeAttribute(edge, "dependency").id;
  });
  return { nodeIds, dependencyIds };
}
