import { Task } from "./task";

/** A task paired with immutable effective scheduling values. */
export class ScheduledTask extends Task {
  /** Computed effective start in UTC. */
  private readonly resolvedStart: Date;
  /** Computed effective end in UTC. */
  private readonly resolvedEnd: Date;
  /** Computed duration in working days. */
  private readonly resolvedDuration: number;

  /**
   * @param task The authored task represented by this scheduled projection.
   * @param effectiveStart The computed UTC start.
   * @param effectiveEnd The computed UTC end.
   * @param effectiveDuration The computed duration in working days.
   */
  constructor(task: Task, effectiveStart: Date, effectiveEnd: Date, effectiveDuration: number) {
    super(task);
    this.resolvedStart = new Date(effectiveStart.getTime());
    this.resolvedEnd = new Date(effectiveEnd.getTime());
    this.resolvedDuration = effectiveDuration;
  }

  /** Returns the computed effective start in UTC. */
  override effectiveStart(): Date {
    return new Date(this.resolvedStart.getTime());
  }

  /** Returns the computed effective end in UTC. */
  override effectiveEnd(): Date {
    return new Date(this.resolvedEnd.getTime());
  }

  /** Returns the computed effective duration in working days. */
  override effectiveDuration(): number {
    return this.resolvedDuration;
  }
}
