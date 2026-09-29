import {
  CHART_BAR_RATIO,
  CHART_ITEM_MAX_HEIGHT,
  CHART_ITEM_MIN_HEIGHT,
} from "@webview/features/chart/chart.constants";
import {
  clipTimelineRectangle,
  isPointInTimeline,
  TimelineRectangle,
} from "@webview/features/chart/timelineGeometry";
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "echarts";

/** A chart point in pixels. */
export type ChartPoint = readonly [number, number];

/** Pixel placement of a task or group bar on its row, before clipping. */
export interface BarPlacement {
  /** Left edge at the start date. */
  readonly x: number;
  /** Horizontal extent, never below {@link MIN_BAR_WIDTH}. */
  readonly width: number;
  /** Vertical center of the row. */
  readonly centerY: number;
  /** Clamped item height. */
  readonly height: number;
}

/** Pixel placement of a milestone marker. */
export interface MilestonePlacement {
  /** Marker center. */
  readonly center: ChartPoint;
  /** Clamped item height. */
  readonly height: number;
}

/** Smallest rendered bar width so zero-length bars stay visible. */
const MIN_BAR_WIDTH = 2;

/**
 * Resolves the active Cartesian grid from custom-series render parameters.
 * @param params Custom-series render parameters.
 * @returns The coordinate system as a timeline rectangle.
 */
export function timelineGrid(params: CustomSeriesRenderItemParams): TimelineRectangle {
  return params.coordSys as unknown as TimelineRectangle;
}

/**
 * Returns the item height for the current row size, clamped to the chart limits.
 * @param api Custom-series render API.
 * @returns The item height in pixels.
 */
export function itemHeight(api: CustomSeriesRenderItemAPI): number {
  const rowHeight = (api.size?.([0, 1]) as number[])[1];
  return Math.min(
    Math.max(rowHeight * CHART_BAR_RATIO, CHART_ITEM_MIN_HEIGHT),
    CHART_ITEM_MAX_HEIGHT,
  );
}

/**
 * Returns the theme or status color assigned to the current data item.
 * @param api Custom-series render API.
 * @returns The item color.
 */
export function itemColor(api: CustomSeriesRenderItemAPI): string {
  return api.visual("color") as string;
}

/**
 * Converts `[row, start, end]` values into an unclipped bar placement.
 * @param api Custom-series render API.
 * @returns The bar placement.
 */
export function barPlacement(api: CustomSeriesRenderItemAPI): BarPlacement {
  const row = api.value(0) as number;
  const start = api.coord([api.value(1), row]);
  const end = api.coord([api.value(2), row]);
  return {
    x: start[0],
    width: Math.max(end[0] - start[0], MIN_BAR_WIDTH),
    centerY: start[1],
    height: itemHeight(api),
  };
}

/**
 * Clips a bar band to the timeline grid.
 * @param params Custom-series render parameters.
 * @param bar The bar placement.
 * @param thickness Band height centered on the row, defaults to the item height.
 * @param overhang Horizontal extension added on both ends.
 * @returns The clipped band, or `undefined` when it lies outside the grid.
 */
export function clipBar(
  params: CustomSeriesRenderItemParams,
  bar: BarPlacement,
  thickness = bar.height,
  overhang = 0,
): TimelineRectangle | undefined {
  return clipTimelineRectangle(
    {
      x: bar.x - overhang,
      y: bar.centerY - thickness / 2,
      width: bar.width + 2 * overhang,
      height: thickness,
    },
    timelineGrid(params),
  );
}

/** Creates an invisible rectangle that expands the clickable area without changing visuals. */
export function createTransparentHitTarget(shape: TimelineRectangle) {
  return {
    type: "rect" as const,
    shape,
    style: { fill: "rgba(0, 0, 0, 0)", stroke: "none", lineWidth: 0 },
    transition: ["shape" as const],
  };
}

/**
 * Converts `[row, date]` values into a milestone placement.
 * @param params Custom-series render parameters.
 * @param api Custom-series render API.
 * @returns The placement, or `undefined` when the marker center lies outside the grid.
 */
export function milestonePlacement(
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): MilestonePlacement | undefined {
  const point = api.coord([api.value(1), api.value(0)]);
  if (!isPointInTimeline([point[0], point[1]], timelineGrid(params))) {
    return undefined;
  }
  return { center: [point[0], point[1]], height: itemHeight(api) };
}

/**
 * Converts `[fromRow, fromTime, toRow, toTime]` values into link endpoints.
 * @param api Custom-series render API.
 * @returns The source and target points.
 */
export function dependencyEndpoints(api: CustomSeriesRenderItemAPI): {
  readonly from: ChartPoint;
  readonly to: ChartPoint;
} {
  const from = api.coord([api.value(1), api.value(0)]);
  const to = api.coord([api.value(3), api.value(2)]);
  return { from: [from[0], from[1]], to: [to[0], to[1]] };
}

/**
 * Builds a right-angle route that turns at the horizontal midpoint.
 * @param from Source point.
 * @param to Target point.
 * @returns The route points.
 */
export function orthogonalRoute(from: ChartPoint, to: ChartPoint): number[][] {
  const midX = (from[0] + to[0]) / 2;
  return [
    [from[0], from[1]],
    [midX, from[1]],
    [midX, to[1]],
    [to[0], to[1]],
  ];
}
