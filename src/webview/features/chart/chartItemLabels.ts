import { AXIS_LABEL_COLOR } from "@webview/features/chart/chart.constants";
import { itemHeight, timelineGrid } from "@webview/features/chart/styles/styleGeometry";
import type { ChartThemeData } from "@webview/features/chart/themes/chartThemes";
import type { CustomSeriesRenderItem } from "echarts";

/** Gap between an item's visual end and its label. */
const LABEL_GAP = 4;

/**
 * Wraps an item renderer so the item's row label is drawn on its right, truncated at the
 * timeline grid's right edge.
 * @param render Item renderer from the active visual style.
 * @param labels Row labels indexed like the series data.
 * @param endDimension Data dimension holding the item's end time.
 * @param axisLabelStyle Theme styling for category-axis labels.
 * @param showLabels Whether the text child should be visible.
 * @returns A renderer returning the item and its label.
 */
export function withItemLabel(
  render: CustomSeriesRenderItem,
  labels: readonly string[],
  endDimension: number,
  axisLabelStyle?: NonNullable<ChartThemeData["categoryAxis"]>["axisLabel"],
  showLabels = true,
): CustomSeriesRenderItem {
  return (params, api) => {
    const item = render(params, api);
    const text = labels[params.dataIndex];
    if (!item || !text) {
      return item;
    }
    const grid = timelineGrid(params);
    const [endX, centerY] = api.coord([api.value(endDimension), api.value(0)]);
    const x = Math.max(endX, grid.x) + itemHeight(api) / 2 + LABEL_GAP;
    const width = grid.x + grid.width - x;
    return {
      type: "group",
      children: [
        item,
        {
          type: "text",
          x,
          y: centerY,
          ignore: !showLabels || width <= 0,
          style: {
            text,
            width: Math.max(width, 0),
            overflow: "truncate",
            verticalAlign: "middle",
            fill: axisLabelStyle?.color ?? AXIS_LABEL_COLOR,
            stroke: axisLabelStyle?.textBorderColor,
            lineWidth: axisLabelStyle?.textBorderWidth,
            strokeFirst: true,
          },
        },
      ],
    };
  };
}
