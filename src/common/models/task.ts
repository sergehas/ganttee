/**
 * Domain model types for Ganttee scheduling entities.
 *
 * These types are framework-agnostic and shared between the extension host and
 * the webview. They must not import from "vscode" or any browser/node globals.
 */

import { MS_PER_DAY } from "../dates";

/** Lifecycle state of a task. */
export const TASK_STATUSES = ["todo", "inProgress", "done"] as const;

/** Lifecycle state of a task. */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * The identity and labeling shape shared by every schedulable entity.
 *
 * Tasks, milestones, and groups all carry the same identity fields so the tree,
 * timeline, and edit form can read one uniform display name.
 */
export interface BaseTask {
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional free-form description; may contain multi-line text. */
  description?: string;
  /** Owning group id, if the entity belongs to a group. */
  groupId?: string;
}

/**
 * A schedulable unit of work defined by scheduling constraints.
 *
 * A task is constrained by exactly 2 of {@link Task.start}, {@link Task.duration},
 * and {@link Task.end}; the third value is derived. Fewer than 2 leaves the task
 * under-constrained and more than 2 makes it hyperstatic — both conditions are
 * classified by the constraint-descriptor helper in the services layer and their
 * validation is surfaced by the graph-validation feature. Persisted user input is
 * kept separate from computed values: the `effective*` accessors expose the
 * scheduled result, while these fields remain the source of truth.
 */
export interface Task extends BaseTask {
  /** Inclusive start date, ISO-8601 date string (YYYY-MM-DD). Optional user input. */
  start?: string;
  /** Inclusive end date, ISO-8601 date string (YYYY-MM-DD). Optional user input. */
  end?: string;
  /** Duration in decimal working days. Optional user input. */
  duration?: number;
  /** Completion ratio in the range 0..1. */
  progress?: number;
  status?: TaskStatus;
}

/**
 * A named collection of tasks used for visual grouping and rollups.
 *
 * A group carries no static schedule of its own; its dates are effective-only,
 * rolled up from its members by the scheduling engine.
 */
export interface Group extends BaseTask {
  collapsed?: boolean;
}

/**
 * A zero-duration marker at a specific point in time.
 *
 * A milestone always has a duration of {@link MILESTONE_DURATION}; its
 * {@link Milestone.date} is canonical and aliases both the effective start and
 * end (see {@link milestoneStart} and {@link milestoneEnd}).
 */
export interface Milestone extends BaseTask {
  /** ISO-8601 date string (YYYY-MM-DD). */
  date?: string;
}

/** The fixed duration, in working days, of every milestone. */
export const MILESTONE_DURATION = 0;

/** Returns the effective start date of a milestone (its canonical date). */
export function milestoneStart(milestone: Milestone): string | undefined {
  return milestone.date;
}

/** Returns the effective end date of a milestone (its canonical date). */
export function milestoneEnd(milestone: Milestone): string | undefined {
  return milestone.date;
}

/**
 * Returns the effective start date of a task, or `undefined` when it cannot be
 * determined from user input alone. Derived dates are populated by the
 * scheduling engine; this accessor surfaces the user-set value.
 */
export function effectiveStart(task: Task): string | undefined {
  return task.start;
}

/**
 * Returns the effective end date of a task, or `undefined` when it cannot be
 * determined from user input alone. Derived dates are populated by the
 * scheduling engine; this accessor surfaces the user-set value.
 */
export function effectiveEnd(task: Task): string | undefined {
  return task.end;
}

/**
 * Returns the effective duration of a task in decimal days, or `undefined` when
 * it cannot be derived. A user-set {@link Task.duration} takes precedence;
 * otherwise, when both {@link Task.start} and {@link Task.end} are set, the
 * duration is `end − start`.
 */
export function effectiveDuration(task: Task): number | undefined {
  if (task.duration !== undefined) {
    return task.duration;
  }
  if (task.start !== undefined && task.end !== undefined) {
    return (Date.parse(task.end) - Date.parse(task.start)) / MS_PER_DAY;
  }
  return undefined;
}
