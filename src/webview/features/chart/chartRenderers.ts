import { CHART_BAR_RATIO, CRITICAL_ITEM_STYLE } from "@webview/features/chart/chart.constants";
import {
  clipTimelineRectangle,
  isPointInTimeline,
  TimelineRectangle,
} from "@webview/features/chart/timelineGeometry";
import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";

/**
 * Renders a task as a horizontal timeline bar.
 *
 * @param params Custom-series render parameters containing the chart grid.
 * @param api Custom-series render API used to read task data and coordinates.
 * @returns A clipped rounded rectangle for the task, or `undefined` when it
 *          lies outside the timeline grid.
 */
export const renderTask: CustomSeriesRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const start = api.coord([api.value(1), rowIndex]);
  const end = api.coord([api.value(2), rowIndex]);
  const height = (api.size?.([0, 1]) as number[])[1] * CHART_BAR_RATIO;
  const width = Math.max(end[0] - start[0], 2);
  const shape = clipTimelineRectangle(
    { x: start[0], y: start[1] - height / 2, width, height },
    timelineGrid(params),
  );
  if (shape === undefined) {
    return undefined;
  }
  const fill = api.visual("color") as string;

  return {
    type: "rect",
    shape: { ...shape, r: 3 },
    style: { fill },
  };
};

/**
 * Renders a group as a horizontal timeline bar.
 *
 * @param params Custom-series render parameters containing the chart grid.
 * @param api Custom-series render API used to read group data and coordinates.
 * @returns A clipped rounded rectangle for the group, or `undefined` when it
 *          lies outside the timeline grid.
 */
export const renderGroup: CustomSeriesRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const start = api.coord([api.value(1), rowIndex]);
  const end = api.coord([api.value(2), rowIndex]);
  const height = (api.size?.([0, 1]) as number[])[1] * CHART_BAR_RATIO;
  const width = Math.max(end[0] - start[0], 2);
  const shape = clipTimelineRectangle(
    { x: start[0], y: start[1] - height / 2, width, height },
    timelineGrid(params),
  );
  if (shape === undefined) {
    return undefined;
  }
  const quarter = shape.height / 4;
  const r = 3;
  const fill = api.visual("color") as string;
  return {
    type: "compoundPath",
    shape: {
      paths: [
        {
          type: "rect",
          shape: {
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: quarter,
            r: r,
          },
        },
        {
          type: "rect",
          shape: {
            x: shape.x,
            y: shape.y,
            width: quarter,
            height: shape.height,
            r: r,
          },
        },
        {
          type: "rect",
          shape: {
            x: shape.x + shape.width - quarter,
            y: shape.y,
            width: quarter,
            height: shape.height,
            r: r,
          },
        },
      ],
    },
    style: { fill },
  };
};

/**
 * Renders a milestone as a diamond marker.
 *
 * @param params Custom-series render parameters containing the chart grid.
 * @param api Custom-series render API used to read milestone data and coordinates.
 * @returns A diamond polygon for the milestone, or `undefined` when it lies
 *          outside the timeline grid.
 */
export const renderMilestone: CustomSeriesRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const point = api.coord([api.value(1), rowIndex]);
  const size = ((api.size?.([0, 1]) as number[])[1] * CHART_BAR_RATIO) / 2;
  if (!isPointInTimeline([point[0], point[1]], timelineGrid(params))) {
    return undefined;
  }
  return {
    type: "polygon",
    shape: {
      points: [
        [point[0], point[1] - size],
        [point[0] + size, point[1]],
        [point[0], point[1] + size],
        [point[0] - size, point[1]],
      ],
    },
    style: {
      fill: api.visual("color") as string,
    },
  };
};

/**
 * Renders an ordinary dependency as an orthogonal link.
 *
 * @param _params Custom-series render parameters, unused by this renderer.
 * @param api Custom-series render API used to read dependency endpoints.
 * @returns An orthogonal polyline connecting the dependency endpoints.
 */
export const renderLink: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => renderDependencyLink(api, "#555555", 2);

/**
 * Renders a critical dependency above ordinary dependency lines and bars.
 *
 * @param _params Custom-series render parameters, unused by this renderer.
 * @param api Custom-series render API used to read dependency endpoints.
 * @returns A prominently styled orthogonal polyline connecting the dependency
 *          endpoints.
 */
export const renderCriticalLink: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => renderDependencyLink(api, CRITICAL_ITEM_STYLE.borderColor, 3);

/**
 * Builds a dependency link with the requested stroke treatment.
 *
 * @param api Custom-series render API used to convert dependency values to
 *            chart coordinates.
 * @param stroke CSS-compatible stroke color for the link.
 * @param lineWidth Width of the link stroke in pixels.
 * @returns An orthogonal polyline connecting the source and target points.
 */
function renderDependencyLink(
  api: CustomSeriesRenderItemAPI,
  stroke: string,
  lineWidth: number,
): CustomSeriesRenderItemReturn {
  const from = api.coord([api.value(1), api.value(0)]);
  const to = api.coord([api.value(3), api.value(2)]);
  const midX = (from[0] + to[0]) / 2;
  return {
    type: "polyline",
    shape: {
      points: [
        [from[0], from[1]],
        [midX, from[1]],
        [midX, to[1]],
        [to[0], to[1]],
      ],
    },
    style: { stroke, lineWidth, fill: "none" },
  };
}

/**
 * Resolves the active Cartesian grid from custom-series render parameters.
 *
 * @param params Custom-series render parameters containing the coordinate
 *               system for the active series.
 * @returns The coordinate system represented as a timeline rectangle.
 */
function timelineGrid(params: CustomSeriesRenderItemParams): TimelineRectangle {
  return params.coordSys as unknown as TimelineRectangle;
}
