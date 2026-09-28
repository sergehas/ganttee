import type { ProjectStyle } from "@common/documents";
import type { CustomSeriesRenderItem } from "echarts";

/**
 * Rendering contract of one chart visual style. Each renderer receives the existing ECharts
 * custom-series coordinates and returns inspectable graphic data, or `undefined` when the item
 * lies outside the timeline grid.
 */
export interface VisualStyle {
  /** Persisted style identifier. */
  readonly id: ProjectStyle;
  /** Renders a task bar from `[row, start, end]` values. */
  readonly renderTask: CustomSeriesRenderItem;
  /** Renders a group bar from `[row, start, end]` values. */
  readonly renderGroup: CustomSeriesRenderItem;
  /** Renders a milestone marker from `[row, date]` values. */
  readonly renderMilestone: CustomSeriesRenderItem;
  /** Renders a dependency link from `[fromRow, fromTime, toRow, toTime]` values. */
  readonly renderDependency: CustomSeriesRenderItem;
}
