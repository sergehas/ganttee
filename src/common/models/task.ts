/**
 * Domain model types for Ganttee scheduling entities.
 *
 * These types are framework-agnostic and shared between the extension host and
 * the webview. They must not import from "vscode" or any browser/node globals.
 */

/** Lifecycle state of a task. */
export type TaskStatus = "todo" | "inProgress" | "done";

/** A schedulable unit of work with a start/end date. */
export interface Task {
  id: string;
  title: string;
  description?: string;
  /** Inclusive start date, ISO-8601 date string (YYYY-MM-DD). */
  start: string;
  /** Inclusive end date, ISO-8601 date string (YYYY-MM-DD). */
  end: string;
  /** Completion ratio in the range 0..1. */
  progress?: number;
  status?: TaskStatus;
  /** Owning group id, if the task belongs to a group. */
  groupId?: string;
}

/** A named collection of tasks used for visual grouping and rollups. */
export interface Group {
  id: string;
  name: string;
  /** Optional parent group id for nested groups. */
  parentId?: string;
  collapsed?: boolean;
}

/** A zero-duration marker at a specific point in time. */
export interface Milestone {
  id: string;
  title: string;
  /** ISO-8601 date string (YYYY-MM-DD). */
  date: string;
  groupId?: string;
}
