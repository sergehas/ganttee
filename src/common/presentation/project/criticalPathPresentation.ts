/** Serializable critical-path identity projection. */
export interface CriticalPathPresentation {
  /** Ordered entity ids in the critical path. */
  readonly nodeIds: readonly string[];
  /** Ordered dependency ids connecting path entities. */
  readonly dependencyIds: readonly string[];
}
