import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";
import { CHART_BAR_RATIO } from "./chart.constants";
import { clipTimelineRectangle, isPointInTimeline, TimelineRectangle } from "./timelineGeometry";

/** Renders a task or group as a horizontal timeline bar. */
export const renderTaskBar: CustomSeriesRenderItem = (
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
  return {
    type: "rect",
    shape: { ...shape, r: 3 },
    style: { fill: api.visual("color") as string },
  };
};

/** Renders a milestone as a diamond marker. */
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
      stroke: "var(--vscode-editor-foreground)",
      lineWidth: 1,
    },
  };
};

/** Renders an ordinary dependency as an orthogonal link. */
export const renderLink: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn =>
  renderDependencyLink(api, "var(--vscode-descriptionForeground)", 1);

/** Renders a critical dependency above ordinary dependency lines and bars. */
export const renderCriticalLink: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => renderDependencyLink(api, "#d19a24", 3);

/** Builds a dependency link with the requested stroke treatment. */
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

/** Resolves the active Cartesian grid from custom-series render parameters. */
function timelineGrid(params: CustomSeriesRenderItemParams): TimelineRectangle {
  return params.coordSys as unknown as TimelineRectangle;
}
