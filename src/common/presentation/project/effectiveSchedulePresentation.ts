/** JSON-compatible effective schedule values for one presented item. */
export interface EffectiveSchedulePresentation {
  /** Computed effective start timestamp. */
  readonly effectiveStart?: string;
  /** Computed effective end timestamp. */
  readonly effectiveEnd?: string;
  /** Computed duration in working days. */
  readonly effectiveDuration?: number;
}
