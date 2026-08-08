import { Task } from "../common/models";

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
 */
export function describeTaskConstraints(task: Task): TaskConstraintDescriptor {
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
