import type { ProjectStyle } from "@common/documents";
import type { ChartThemeData } from "@webview/features/chart/themes/chartThemes";
import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";

/** A visual-style renderer receives the selected ECharts theme as its third argument. */
export type ThemeAwareRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
  theme: ChartThemeData,
) => CustomSeriesRenderItemReturn;

/**
 * Rendering contract of one chart visual style. Each renderer receives the existing ECharts
 * custom-series coordinates and returns inspectable graphic data, or `undefined` when the item
 * lies outside the timeline grid.
 */
export interface VisualStyle {
  /** Persisted style identifier. */
  readonly id: ProjectStyle;
  /** Renders a task bar from `[row, start, end]` values. */
  readonly renderTask: ThemeAwareRenderItem;
  /** Renders a group bar from `[row, start, end]` values. */
  readonly renderGroup: ThemeAwareRenderItem;
  /** Renders a milestone marker from `[row, date]` values. */
  readonly renderMilestone: ThemeAwareRenderItem;
  /** Renders a dependency link from `[fromRow, fromTime, toRow, toTime]` values. */
  readonly renderDependency: ThemeAwareRenderItem;
}

/**
 * Binds theme data to a visual-style renderer while preserving the ECharts callback signature.
 * @param renderItem Theme-aware visual-style renderer.
 * @param theme Selected ECharts theme data.
 * @returns Renderer ready to pass to ECharts.
 */
export function bindThemeToRenderer(
  renderItem: ThemeAwareRenderItem,
  theme: ChartThemeData,
): CustomSeriesRenderItem {
  return (params, api) => renderItem(params, api, theme);
}
