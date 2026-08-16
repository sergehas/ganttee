import {
  Dependency,
  DependencyGraph,
  GanttModel,
  Task,
} from "../common/models";

/**
 * Classification of a task's scheduling constraints based on how many of
 * {start, duration, end} are set.
 * - `determinate`: exactly 2 are set; the third is derived.
 * - `hyperstatic`: all 3 are set (over-constrained).
 * - `underConstrained`: fewer than 2 are set.
 */
export type TaskConstraintStatus =
  | "determinate"
  | "hyperstatic"
  | "underConstrained";

/**
 * Describes which scheduling constraints a task has set and the resulting
 * {@link TaskConstraintStatus}. This descriptor is a pure, non-persisted view of
 * the task used by validation and the edit form; it never mutates the task.
 */
export interface TaskConstraintDescriptor {
  /** Whether {@link Task.start} is set. */
  hasStart: boolean;
  /** Whether {@link Task.duration} is set. */
  hasDuration: boolean;
  /** Whether {@link Task.end} is set. */
  hasEnd: boolean;
  /** Number of set constraints (0..3). */
  count: number;
  /** The classification derived from {@link TaskConstraintDescriptor.count}. */
  status: TaskConstraintStatus;
}

/**
 * Returns the constraint descriptor for a task, classifying it as determinate
 * (exactly 2 constraints), hyperstatic (all 3), or under-constrained (fewer than
 * 2). Surfacing and validation of the non-determinate states is handled by the
 * graph-validation feature.
 *
 * Works with both Task (plain document) and TaskEntity (hydrated) forms.
 */
export function describeTaskConstraints(
  task: Task | { start?: unknown; duration?: number; end?: unknown },
): TaskConstraintDescriptor {
  const hasStart = task.start !== undefined;
  const hasDuration = task.duration !== undefined;
  const hasEnd = task.end !== undefined;
  const count = Number(hasStart) + Number(hasDuration) + Number(hasEnd);

  let status: TaskConstraintStatus;
  if (count === 2) {
    status = "determinate";
  } else if (count === 3) {
    status = "hyperstatic";
  } else {
    status = "underConstrained";
  }

  return { hasStart, hasDuration, hasEnd, count, status };
}

/**
 * Returns the effective constraint count for a task, combining static
 * constraints ({start, duration, end} that are set) with dependency-supplied
 * endpoints.
 *
 * Dependency-supplied endpoints:
 * - `startAfter` or `startWith` dependencies (where the task is the source)
 *   supply the start endpoint
 * - `endWith` dependencies (where the task is the source) supply the end endpoint
 *
 * A task with `duration` set and one or more outgoing `startAfter`/`startWith`
 * dependencies is considered determinate even if `start` is unset.
 *
 * @param taskId The id of the task to evaluate.
 * @param model The hydrated GanttModel (used to inspect outgoing dependencies).
 * @param graph The dependency graph (used to find successors).
 * @returns The effective constraint count (0..3).
 */
export function getEffectiveConstraintCount(
  taskId: string,
  model: GanttModel,
  graph: DependencyGraph,
): number {
  const task = model.tasks.find((t) => t.id === taskId);
  if (!task) {
    return 0;
  }

  return getEffectiveTaskConstraintCount(task, model.dependencies);
}

/**
 * Returns the effective constraint count for a plain task and its dependency
 * set. This is suitable for the webview, where only the document shape exists.
 *
 * @param task The task to evaluate.
 * @param dependencies The dependencies belonging to the document.
 * @returns The effective constraint count (0..3).
 */
export function getEffectiveTaskConstraintCount(
  task:
    | Task
    | { id: string; start?: unknown; duration?: number; end?: unknown },
  dependencies: readonly Dependency[],
): number {
  const staticDescriptor = describeTaskConstraints(task);
  const hasDependencyStart = dependencies.some(
    (dependency) =>
      dependency.sourceId === task.id &&
      (dependency.type === "startAfter" || dependency.type === "startWith"),
  );
  const hasDependencyEnd = dependencies.some(
    (dependency) =>
      dependency.sourceId === task.id && dependency.type === "endWith",
  );

  return (
    staticDescriptor.count +
    Number(hasDependencyStart && !staticDescriptor.hasStart) +
    Number(hasDependencyEnd && !staticDescriptor.hasEnd)
  );
}
