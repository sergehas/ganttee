/** Serialized effective values for a scheduled task. */
export interface ScheduledTask {
  /** Stable task identifier. */
  id: string;
  /** Effective UTC start as an ISO timestamp. */
  effectiveStart: string;
  /** Effective UTC end as an ISO timestamp. */
  effectiveEnd: string;
  /** Effective duration in working days. */
  effectiveDuration: number;
}
