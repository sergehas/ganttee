import { timelineGrid } from "@webview/features/chart/styles/styleGeometry";
import { clipTimelineRectangle } from "@webview/features/chart/timelineGeometry";
import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";

/** Renders a clipped calendar shading band spanning the full timeline height.
 * @param params ECharts custom-series render parameters.
 * @param api ECharts API for coordinates and visual styles.
 * @returns The clipped shading rectangle, or `undefined` when outside the grid.
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
