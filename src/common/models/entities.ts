/**
 * Object-oriented, `Date`-typed in-memory domain model.
 *
 * These entities are the host-side computed view of a parsed `.ganttee`
 * document. Unlike the plain, ISO-string {@link BaseTask} records that are
 * persisted and sent over the host↔webview protocol, entities carry `Date`
 * values and behavior, so they must never cross the webview boundary (a
 * `postMessage`/JSON round-trip strips both `Date` objects and methods).
 *
 * The layer is framework-agnostic: it must not import from "vscode" or any
 * browser/node globals. Entities are immutable — every field is set through the
 * constructor. Safe, dependency-aware mutation is deferred to the scheduling
 * engine, which will expose dedicated methods.
 */

import { addDays, diffInDays } from "../dates";
import { Dependency } from "./dependency";
import { DependencyGraph } from "./dependencyGraph";
import { ProjectSettings } from "./document";
import { BaseTask, MILESTONE_DURATION, TaskStatus } from "./task";

/**
 * A schedulable entity that can resolve its own effective time span.
 *
 * `effectiveStart`/`effectiveEnd` always return a `Date`; `effectiveDuration`
 * returns the span in decimal days.
 */
export interface Schedulable {
  /** The resolved start date. */
  effectiveStart(): Date;
  /** The resolved end date. */
  effectiveEnd(): Date;
  /** The resolved duration in decimal days. */
  effectiveDuration(): number;
}

/**
 * Raised when a task entity is under-constrained and an effective endpoint
 * cannot be derived. Well-formed documents never trigger this — under-constrained
 * documents are rejected by graph validation before hydration.
 */
export class UnresolvableScheduleError extends Error {}

/**
 * Shared identity base for every entity, implementing {@link BaseTask} and
 * declaring the {@link Schedulable} contract its subclasses must satisfy.
 */
export abstract class BaseTaskEntity implements BaseTask, Schedulable {
  /** Stable unique identifier. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Optional free-form description. */
  readonly description?: string;
  /** Owning group id, if any. */
  readonly groupId?: string;

  /**
   * @param base The shared identity fields to copy onto the entity.
   */
  constructor(base: BaseTask) {
    this.id = base.id;
    this.name = base.name;
    this.description = base.description;
    this.groupId = base.groupId;
  }

  /** @inheritdoc */
  abstract effectiveStart(): Date;
  /** @inheritdoc */
  abstract effectiveEnd(): Date;
  /** @inheritdoc */
  abstract effectiveDuration(): number;
}

/** Construction fields for a {@link TaskEntity}. */
export interface TaskEntityProps extends BaseTask {
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

/**
 * A schedulable unit of work constrained by exactly two of
 * {@link TaskEntity.start}, {@link TaskEntity.duration}, and
 * {@link TaskEntity.end}; the third endpoint is derived with calendar-day
 * arithmetic in this phase.
 */
export class TaskEntity extends BaseTaskEntity {
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
  constructor(props: TaskEntityProps) {
    super(props);
    this.start = props.start;
    this.end = props.end;
    this.duration = props.duration;
    this.progress = props.progress;
    this.status = props.status;
  }

  /**
   * Returns the start date, deriving it as `end − duration` when `start` is
   * unset.
   *
   * @throws {UnresolvableScheduleError} When the task is under-constrained.
   */
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

  /**
   * Returns the end date, deriving it as `start + duration` when `end` is unset.
   *
   * @throws {UnresolvableScheduleError} When the task is under-constrained.
   */
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

  /**
   * Returns the duration in decimal days: the user-set value when present,
   * otherwise `effectiveEnd − effectiveStart`.
   */
  effectiveDuration(): number {
    if (this.duration !== undefined) {
      return this.duration;
    }
    return diffInDays(this.effectiveStart(), this.effectiveEnd());
  }
}

/** Construction fields for a {@link MilestoneEntity}. */
export interface MilestoneEntityProps extends BaseTask {
  /** The milestone's canonical date. */
  date?: Date;
}

/**
 * A zero-duration marker whose start and end both alias its canonical date.
 */
export class MilestoneEntity extends BaseTaskEntity {
  /** The milestone's canonical date. */
  readonly date?: Date;

  /**
   * @param props The milestone fields, with the date already parsed to `Date`.
   */
  constructor(props: MilestoneEntityProps) {
    super(props);
    this.date = props.date;
  }

  /** @inheritdoc */
  effectiveStart(): Date {
    if (this.date === undefined) {
      throw new UnresolvableScheduleError(
        `Milestone "${this.id}" is under-constrained: cannot derive a date.`,
      );
    }
    return this.date;
  }

  /** @inheritdoc */
  effectiveEnd(): Date {
    if (this.date === undefined) {
      throw new UnresolvableScheduleError(
        `Milestone "${this.id}" is under-constrained: cannot derive a date.`,
      );
    }
    return this.date;
  }

  /** @inheritdoc */
  effectiveDuration(): number {
    return MILESTONE_DURATION;
  }
}

/** Construction fields for a {@link GroupEntity}. */
export interface GroupEntityProps extends BaseTask {
  /** Whether the group is collapsed in the UI. */
  collapsed?: boolean;
}

/**
 * A named collection of entities. Groups carry no static schedule; their
 * effective span is a placeholder in this phase — a deterministic Unix-epoch
 * sentinel with zero duration — pending rollup from members by the scheduling
 * engine.
 */
export class GroupEntity extends BaseTaskEntity {
  /** Whether the group is collapsed in the UI. */
  readonly collapsed?: boolean;

  /**
   * @param props The group fields.
   */
  constructor(props: GroupEntityProps) {
    super(props);
    this.collapsed = props.collapsed;
  }

  /**
   * Placeholder start — the Unix epoch — until the scheduling engine rolls up
   * member dates.
   */
  effectiveStart(): Date {
    return new Date(0);
  }

  /**
   * Placeholder end — the Unix epoch — until the scheduling engine rolls up
   * member dates.
   */
  effectiveEnd(): Date {
    return new Date(0);
  }

  /** Placeholder duration (0) until rollup is implemented. */
  effectiveDuration(): number {
    return 0;
  }
}

/**
 * In-memory container for a hydrated document: the OO entity collections plus
 * the plain dependencies and reserved scheduling configuration.
 */
export class GanttModel {
  /**
   * @param tasks The hydrated task entities.
   * @param milestones The hydrated milestone entities.
   * @param groups The hydrated group entities.
   * @param dependencies The plain dependency records (unchanged by hydration).
   * @param version The document schema version.
   * @param graph The structural DAG over all entity ids and dependencies.
   * @param settings Reserved project-level settings (calendar and hours).
   */
  constructor(
    readonly tasks: readonly TaskEntity[],
    readonly milestones: readonly MilestoneEntity[],
    readonly groups: readonly GroupEntity[],
    readonly dependencies: readonly Dependency[],
    readonly version: number,
    readonly graph: DependencyGraph,
    readonly settings?: ProjectSettings,
  ) {}
}
