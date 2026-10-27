/** Supported timeline zoom levels ordered from finest to coarsest. */
export const ZOOM_LEVELS = ["day", "week", "month", "quarter", "year"] as const;

/** Supported timeline zoom levels. */
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/** Supported chart visual styles. */
export const PROJECT_STYLES = ["classic", "rounded", "metro"] as const;

/** Chart visual style identifier. */
export type ProjectStyle = (typeof PROJECT_STYLES)[number];

/** Chart color theme identifier; availability is resolved by the webview theme registry. */
export type ProjectTheme = string;

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
  /** Visual style used to render chart items. */
  style: ProjectStyle;
  /** Color theme applied to the chart. */
  theme: ProjectTheme;
  /** Whether entity labels are drawn next to chart items instead of on the Y axis. */
  showItemLabels: boolean;
}

/** Keys of `ProjectView` that hold a boolean preference. */
export type BooleanViewField = {
  [K in keyof ProjectView]: ProjectView[K] extends boolean ? K : never;
}[keyof ProjectView];

/** Default persisted-view values used when a view section is present partially. */
export const DEFAULT_PROJECT_VIEW: ProjectView = {
  zoomLevel: "week",
  showDependencies: true,
  showOffDays: false,
  showHolidays: false,
  showCriticalPath: false,
  style: "classic",
  theme: "blue",
  showItemLabels: false,
};

/** Resolves a partial view section without mutating its input. */
export function resolveProjectView(view: Partial<ProjectView> = {}): ProjectView {
  return { ...DEFAULT_PROJECT_VIEW, ...view };
}
