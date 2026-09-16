/** Rectangle coordinates used by ECharts custom-series renderers. */
export interface TimelineRectangle {
  /** Horizontal origin. */
  readonly x: number;
  /** Vertical origin. */
  readonly y: number;
  /** Horizontal extent. */
  readonly width: number;
  /** Vertical extent. */
  readonly height: number;
}

/** Clips a project-item rectangle to the timeline grid. */
export function clipTimelineRectangle(
  rectangle: TimelineRectangle,
  grid: TimelineRectangle,
): TimelineRectangle | undefined {
  const left = Math.max(rectangle.x, grid.x);
  const right = Math.min(rectangle.x + rectangle.width, grid.x + grid.width);
  const top = Math.max(rectangle.y, grid.y);
  const bottom = Math.min(rectangle.y + rectangle.height, grid.y + grid.height);
  if (right <= left || bottom <= top) {
    return undefined;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Returns whether a point lies inside the timeline grid. */
export function isPointInTimeline(
  point: readonly [number, number],
  grid: TimelineRectangle,
): boolean {
  return (
    point[0] >= grid.x &&
    point[0] <= grid.x + grid.width &&
    point[1] >= grid.y &&
    point[1] <= grid.y + grid.height
  );
}
