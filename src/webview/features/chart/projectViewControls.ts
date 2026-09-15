import { ProjectView, ZoomLevel } from "@common/documents";

/** Supported chart zoom levels ordered from finest to coarsest. */
export const ZOOM_LEVELS: readonly ZoomLevel[] = ["day", "week", "month", "quarter", "year"];

/** Returns the next finer zoom level, or the current level at the boundary. */
export function zoomIn(level: ZoomLevel): ZoomLevel {
  const index = ZOOM_LEVELS.indexOf(level);
  return ZOOM_LEVELS[Math.max(index - 1, 0)];
}

/** Returns the next coarser zoom level, or the current level at the boundary. */
export function zoomOut(level: ZoomLevel): ZoomLevel {
  const index = ZOOM_LEVELS.indexOf(level);
  return ZOOM_LEVELS[Math.min(index + 1, ZOOM_LEVELS.length - 1)];
}

/** Replaces the persisted zoom level without changing layer preferences. */
export function withZoomLevel(view: ProjectView, zoomLevel: ZoomLevel): ProjectView {
  return { ...view, zoomLevel };
}

/** Toggles one persisted chart layer without changing other preferences. */
export function toggleProjectViewLayer(
  view: ProjectView,
  layer: "showDependencies" | "showOffDays" | "showHolidays" | "showCriticalPath",
): ProjectView {
  return { ...view, [layer]: !view[layer] };
}
