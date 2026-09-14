import { MS_PER_DAY } from "../../dates";
import { ProjectItem } from "./projectItem";

/** Lifecycle state of a task. */
export const TASK_STATUSES = ["todo", "inProgress", "done"] as const;

/** Lifecycle state of a task. */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** A persisted schedulable unit of work. */
export interface Task extends ProjectItem {
  /** Inclusive start date, ISO-8601 date string. */
  start?: string;
  /** Inclusive end date, ISO-8601 date string. */
  end?: string;
  /** Duration in decimal working days. */
  duration?: number;
  /** Completion ratio in the range 0..1. */
  progress?: number;
  /** Lifecycle status. */
  status?: TaskStatus;
}

/** Returns the effective start date of a task from authored values. */
export function effectiveStart(task: Task): string | undefined {
  return task.start;
}

/** Returns the effective end date of a task from authored values. */
export function effectiveEnd(task: Task): string | undefined {
  return task.end;
}

/** Returns the effective duration of a task from authored values. */
export function effectiveDuration(task: Task): number | undefined {
  if (task.duration !== undefined) {
    return task.duration;
  }
  if (task.start !== undefined && task.end !== undefined) {
    return (Date.parse(task.end) - Date.parse(task.start)) / MS_PER_DAY;
  }
  return undefined;
}
