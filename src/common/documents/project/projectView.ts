/** Supported timeline zoom levels. */
export type ZoomLevel = "day" | "week" | "month" | "quarter" | "year";

/** Persisted chart view preferences. */
export interface ProjectView {
  /** Timeline scale used by the chart. */
  zoomLevel: ZoomLevel;
  /** Whether dependency edges are visible. */
  showDependencies: boolean;
  /** Whether non-working days are shaded. */
  showOffDays: boolean;
  /** Whether configured holidays are shaded. */
  showHolidays: boolean;
  /** Whether the derived critical path is emphasized. */
  showCriticalPath: boolean;
}

/** Default persisted-view values used when a view section is present partially. */
export const DEFAULT_PROJECT_VIEW: ProjectView = {
  zoomLevel: "week",
  showDependencies: true,
  showOffDays: false,
  showHolidays: false,
  showCriticalPath: false,
};

/** Resolves a partial view section without mutating its input. */
export function resolveProjectView(view: Partial<ProjectView> = {}): ProjectView {
  return { ...DEFAULT_PROJECT_VIEW, ...view };
}
