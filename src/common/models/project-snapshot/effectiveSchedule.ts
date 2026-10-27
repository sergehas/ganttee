/** Effective schedule values attached to one project item. */
export interface EffectiveSchedule {
  /** Computed effective start. */
  readonly start: Date;
  /** Computed effective end. */
  readonly end: Date;
  /** Computed duration in working days. */
  readonly duration: number;
}
