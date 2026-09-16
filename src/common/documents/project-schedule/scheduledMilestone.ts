/** Serialized effective values for a scheduled milestone. */
export interface ScheduledMilestone {
  /** Stable milestone identifier. */
  id: string;
  /** Effective UTC start as an ISO timestamp. */
  effectiveStart: string;
  /** Effective UTC end as an ISO timestamp. */
  effectiveEnd: string;
  /** Effective duration in working days. */
  effectiveDuration: number;
}
