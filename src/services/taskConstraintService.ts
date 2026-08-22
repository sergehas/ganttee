import {
    Dependency,
    DependencyGraph,
    GanttModel,
    Milestone,
    Task,
} from "../common/models";

/** Endpoint-level validation result shared by host and webview consumers. */
export interface ConstraintValidation {
  /** Number of independent static or dependency-defined constraints. */
  count: number;
  /** Whether the static start is also constrained by an outgoing dependency. */
  duplicateStart: boolean;
  /** Whether the static end is also constrained by an outgoing dependency. */
  duplicateEnd: boolean;
  /** Whether the item has fewer than two independent constraints. */
  underConstrained: boolean;
  /** Whether the item has more than two constraints or a duplicate endpoint. */
  overConstrained: boolean;
  /** Whether the item has a blocking constraint error for persistence. */
  blocking: boolean;
}

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

  return Number(staticDescriptor.hasStart || hasDependencyStart) +
    Number(staticDescriptor.hasDuration) +
    Number(staticDescriptor.hasEnd || hasDependencyEnd);
}

/**
 * Describes task endpoint conflicts and independent constraint determinacy.
 */
export function describeTaskConstraintValidation(
  task:
    | Task
    | { id: string; start?: unknown; duration?: number; end?: unknown },
  dependencies: readonly Dependency[],
): ConstraintValidation {
  const descriptor = describeTaskConstraints(task);
  const hasDependencyStart = hasOutgoingStartDependency(task.id, dependencies);
  const hasDependencyEnd = hasOutgoingEndDependency(task.id, dependencies);
  const count =
    Number(descriptor.hasStart || hasDependencyStart) +
    Number(descriptor.hasDuration) +
    Number(descriptor.hasEnd || hasDependencyEnd);
  const duplicateStart = descriptor.hasStart && hasDependencyStart;
  const duplicateEnd = descriptor.hasEnd && hasDependencyEnd;
  const duplicateEndpoint = duplicateStart || duplicateEnd;
  const underConstrained = count < 2 && !duplicateEndpoint;
  const ordinaryOverConstrained = count > 2;
  return {
    count,
    duplicateStart,
    duplicateEnd,
    underConstrained,
    overConstrained: ordinaryOverConstrained || duplicateEndpoint,
    blocking: underConstrained || ordinaryOverConstrained,
  };
}

/**
 * Describes milestone date conflicts and determinacy.
 */
export function describeMilestoneConstraintValidation(
  milestone: Milestone,
  dependencies: readonly Dependency[],
): ConstraintValidation {
  const hasDependencyStart = hasOutgoingStartDependency(
    milestone.id,
    dependencies,
  );
  const hasDependencyEnd = hasOutgoingEndDependency(
    milestone.id,
    dependencies,
  );
  const hasDate = milestone.date !== undefined && milestone.date.length > 0;
  const hasEffectiveDate = hasDate || hasDependencyStart || hasDependencyEnd;
  const duplicateDate = hasDate && (hasDependencyStart || hasDependencyEnd);
  const underConstrained = !hasEffectiveDate && !duplicateDate;
  return {
    count: hasEffectiveDate ? 2 : 0,
    duplicateStart: duplicateDate,
    duplicateEnd: duplicateDate,
    underConstrained,
    overConstrained: duplicateDate,
    blocking: underConstrained,
  };
}

/** Returns whether a source has an outgoing dependency that constrains start. */
function hasOutgoingStartDependency(
  entityId: string,
  dependencies: readonly Dependency[],
): boolean {
  return dependencies.some(
    (dependency) =>
      dependency.sourceId === entityId &&
      (dependency.type === "startAfter" || dependency.type === "startWith"),
  );
}

/** Returns whether a source has an outgoing dependency that constrains end. */
function hasOutgoingEndDependency(
  entityId: string,
  dependencies: readonly Dependency[],
): boolean {
  return dependencies.some(
    (dependency) =>
      dependency.sourceId === entityId && dependency.type === "endWith",
  );
}
