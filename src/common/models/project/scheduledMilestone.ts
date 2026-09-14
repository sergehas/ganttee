import { MILESTONE_DURATION } from "../../documents/project/milestone";
import { Milestone } from "./milestone";

/** A milestone paired with its immutable computed date. */
export class ScheduledMilestone extends Milestone {
  /** Computed milestone date in UTC. */
  private readonly resolvedDate: Date;

  /**
   * @param milestone The authored milestone represented by this projection.
   * @param effectiveDate The computed UTC milestone date.
   */
  constructor(milestone: Milestone, effectiveDate: Date) {
    super(milestone);
    this.resolvedDate = new Date(effectiveDate.getTime());
  }

  /** Returns the computed effective start in UTC. */
  override effectiveStart(): Date {
    return new Date(this.resolvedDate.getTime());
  }

  /** Returns the computed effective end in UTC. */
  override effectiveEnd(): Date {
    return new Date(this.resolvedDate.getTime());
  }

  /** Returns the computed effective duration in working days. */
  override effectiveDuration(): number {
    return MILESTONE_DURATION;
  }
}
