import { formatIsoDate, MS_PER_DAY } from "@common/dates";
import { ProjectItem } from "@common/documents/project/projectItem";
import { generateId } from "@common/idFactory";

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
}

/** Creates a new task template with a localized default name. */
export function createDefaultTask(name: string): Task {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 3);

  return {
    id: generateId(),
    name,
    start: formatIsoDate(today),
    end: formatIsoDate(end),
    progress: 0,
    state: "open",
  };
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
