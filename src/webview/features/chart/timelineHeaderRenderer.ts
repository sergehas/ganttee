import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";
import { TimelineRectangle } from "./timelineGeometry";

/** Shared color for native Y-axis and custom timeline header labels. */
export const AXIS_LABEL_COLOR = "#6e7079";

/** Creates a renderer for exact calendar grid lines and header labels. */
export function createTimelineTickRenderer(
  formatSelected: (value: number) => string,
  formatParent?: (value: number) => string,
): CustomSeriesRenderItem {
  return (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI,
  ): CustomSeriesRenderItemReturn => {
    const value = Number(api.value(0));
    const grid = params.coordSys as unknown as TimelineRectangle;
    const x = api.coord([value, 0])[0];
    const parentLabel = formatParent?.(value) ?? "";
    if (x < grid.x || x > grid.x + grid.width) {
      return undefined;
    }
    const children: NonNullable<CustomSeriesRenderItemReturn>[] = [
      {
        type: "line",
        shape: { x1: x, y1: grid.y, x2: x, y2: grid.y + grid.height },
        style: {
          stroke: parentLabel ? "rgba(127, 127, 127, 0.48)" : "rgba(127, 127, 127, 0.24)",
          lineWidth: 1,
        },
      },
      {
        type: "text",
        x,
        y: grid.y - 12,
        style: {
          text: formatSelected(value),
          fill: AXIS_LABEL_COLOR,
          align: "center",
          verticalAlign: "bottom",
        },
      },
    ];
    if (parentLabel.length > 0) {
      children.push({
        type: "text",
        x,
        y: grid.y - 40,
        style: {
          text: parentLabel,
          fill: AXIS_LABEL_COLOR,
          align: "center",
          verticalAlign: "bottom",
        },
      });
    }
    return { type: "group", children };
  };
}
