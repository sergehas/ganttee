import {
  Dependency,
  Group,
  Milestone,
  ProjectContent,
  ProjectSettings,
  ProjectView,
  Task,
} from "@common/documents";

/** JSON-compatible effective schedule values for one presented item. */
export interface EffectiveSchedulePresentation {
  /** Computed effective start timestamp. */
  readonly effectiveStart?: string;
  /** Computed effective end timestamp. */
  readonly effectiveEnd?: string;
  /** Computed duration in working days. */
  readonly effectiveDuration?: number;
}

/** Authored task fields enriched with computed schedule values. */
export interface TaskPresentation extends Task, EffectiveSchedulePresentation {}

/** Authored milestone fields enriched with computed schedule values. */
export interface MilestonePresentation extends Milestone, EffectiveSchedulePresentation {}

/** Authored group fields enriched with computed rollup values. */
export interface GroupPresentation extends Group, EffectiveSchedulePresentation {}

/** Serializable critical-path identity projection. */
export interface CriticalPathPresentation {
  /** Ordered entity ids in the critical path. */
  readonly nodeIds: readonly string[];
  /** Ordered dependency ids connecting path entities. */
  readonly dependencyIds: readonly string[];
}

/** Versionless, UI-ready projection sent across the webview boundary. */
export interface ProjectPresentation extends ProjectContent {
  /** Presented tasks. */
  tasks: TaskPresentation[];
  /** Presented milestones. */
  milestones: MilestonePresentation[];
  /** Presented groups. */
  groups: GroupPresentation[];
  /** Authored dependencies. */
  dependencies: Dependency[];
  /** Resolved scheduling settings. */
  readonly settings: ProjectSettings;
  /** Persisted chart preferences. */
  readonly view: ProjectView;
  /** Host-computed critical path. */
  readonly criticalPath: CriticalPathPresentation;
}
