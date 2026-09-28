import { AXIS_LABEL_COLOR } from "@webview/features/chart/chart.constants";
import { itemHeight, timelineGrid } from "@webview/features/chart/styles/styleGeometry";
import type { CustomSeriesRenderItem } from "echarts";

/** Gap between an item's visual end and its label. */
const LABEL_GAP = 4;

/**
 * Wraps an item renderer so the item's row label is drawn on its right, truncated at the
 * timeline grid's right edge.
 * @param render Item renderer from the active visual style.
 * @param labels Row labels indexed like the series data.
 * @param endDimension Data dimension holding the item's end time.
 * @returns A renderer returning the item and its label.
 */
export function withItemLabel(
  render: CustomSeriesRenderItem,
  labels: readonly string[],
  endDimension: number,
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
    if (width <= 0) {
      return item;
    }
    return {
      type: "group",
      children: [
        item,
        {
          type: "text",
          x,
          y: centerY,
          style: {
            text,
            width,
            overflow: "truncate",
            verticalAlign: "middle",
            fill: AXIS_LABEL_COLOR,
          },
        },
      ],
    };
  };
}
