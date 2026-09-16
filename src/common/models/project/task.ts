import { addDays, diffInDays } from "@common/dates";
import { ProjectItem as ProjectItemDocument } from "@common/documents/project/projectItem";
import { TaskStatus } from "@common/documents/project/task";
import { ProjectItem, UnresolvableScheduleError } from "@common/models/project/projectItem";

/** Construction fields for an in-memory task. */
export interface TaskProps extends ProjectItemDocument {
  /** User-set start date, if provided. */
  start?: Date;
  /** User-set end date, if provided. */
  end?: Date;
  /** User-set duration in decimal days, if provided. */
  duration?: number;
  /** Completion ratio in the range 0..1. */
  progress?: number;
  /** Lifecycle status. */
  status?: TaskStatus;
}

/** A hydrated schedulable unit of work. */
export class Task extends ProjectItem {
  /** User-set start date, if provided. */
  readonly start?: Date;
  /** User-set end date, if provided. */
  readonly end?: Date;
  /** User-set duration in decimal days, if provided. */
  readonly duration?: number;
  /** Completion ratio in the range 0..1. */
  readonly progress?: number;
  /** Lifecycle status. */
  readonly status?: TaskStatus;

  /**
   * @param props The task fields, with dates already parsed to `Date`.
   */
  constructor(props: TaskProps) {
    super(props);
    this.start = props.start;
    this.end = props.end;
    this.duration = props.duration;
    this.progress = props.progress;
    this.status = props.status;
  }

  /** Returns the resolved start date. */
  effectiveStart(): Date {
    if (this.start !== undefined) {
      return this.start;
    }
    if (this.end !== undefined && this.duration !== undefined) {
      return addDays(this.end, -this.duration);
    }
    throw new UnresolvableScheduleError(
      `Task "${this.id}" is under-constrained: cannot derive a start date.`,
    );
  }

  /** Returns the resolved end date. */
  effectiveEnd(): Date {
    if (this.end !== undefined) {
      return this.end;
    }
    if (this.start !== undefined && this.duration !== undefined) {
      return addDays(this.start, this.duration);
    }
    throw new UnresolvableScheduleError(
      `Task "${this.id}" is under-constrained: cannot derive an end date.`,
    );
  }

  /** Returns the resolved duration in decimal days. */
  effectiveDuration(): number {
    if (this.duration !== undefined) {
      return this.duration;
    }
    return diffInDays(this.effectiveStart(), this.effectiveEnd());
  }
}
