import { timelineGrid } from "@webview/features/chart/styles/styleGeometry";
import { clipTimelineRectangle } from "@webview/features/chart/timelineGeometry";
import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";

/**
 * Renders a calendar shading band spanning the full timeline height.
 *
 * @param params Custom-series render parameters containing the chart grid.
 * @param api Custom-series render API used to read the band bounds and its fill.
 * @returns A clipped rectangle covering the band, or `undefined` when it lies
 *          outside the timeline grid.
 */
export const renderCalendarArea: CustomSeriesRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const grid = timelineGrid(params);
  const start = api.coord([api.value(0), 0])[0];
  const end = api.coord([api.value(1), 0])[0];
  const shape = clipTimelineRectangle(
    { x: start, y: grid.y, width: Math.max(end - start, 1), height: grid.height },
    grid,
  );
  if (shape === undefined) {
    return undefined;
  }
  return {
    type: "rect",
    shape,
    style: { fill: api.visual("color") as string },
  };
};
