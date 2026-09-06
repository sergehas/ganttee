/** JSON-compatible schedule projections carried by a {@link GanttDocument}. */

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

/** Serialized effective values for a rolled-up group. */
export interface ScheduledGroup {
  /** Stable group identifier. */
  id: string;
  /** Effective UTC start as an ISO timestamp. */
  effectiveStart: string;
  /** Effective UTC end as an ISO timestamp. */
  effectiveEnd: string;
  /** Effective duration in working days. */
  effectiveDuration: number;
}

/** Complete serialized schedule projection for a Gantt document. */
export interface GanttScheduleDocument {
  /** Scheduled task projections. */
  tasks: ScheduledTask[];
  /** Scheduled milestone projections. */
  milestones: ScheduledMilestone[];
  /** Scheduled group projections. */
  groups: ScheduledGroup[];
}
