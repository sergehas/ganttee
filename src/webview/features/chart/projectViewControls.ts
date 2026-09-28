import { BooleanViewField, ProjectView, ZOOM_LEVELS, ZoomLevel } from "@common/documents";

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

/** Replaces one persisted view preference without changing the others. */
export function withViewField<K extends keyof ProjectView>(
  view: ProjectView,
  field: K,
  value: ProjectView[K],
): ProjectView {
  return { ...view, [field]: value };
}

/** Toggles one persisted boolean view preference without changing the others. */
export function toggleViewFlag(view: ProjectView, field: BooleanViewField): ProjectView {
  return withViewField(view, field, !view[field]);
}
