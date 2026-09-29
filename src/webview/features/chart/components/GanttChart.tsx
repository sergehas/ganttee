import { ProjectView } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import { EditableEntityRef } from "@common/protocol";
import { CHART_ROW_HEIGHT } from "@webview/features/chart/chart.constants";
import { exportChartImage } from "@webview/features/chart/chartExport";
import type {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import { applyLegendSelection, resolveChartClick } from "@webview/features/chart/chartInteractions";
import { buildChartOption } from "@webview/features/chart/chartOptionBuilder";
import { buildVisibleChartRows, toggleCollapsedGroup } from "@webview/features/chart/chartRows";
import "@webview/features/chart/components/GanttChart.scss";
import { CHART_THEMES, ChartTheme } from "@webview/features/chart/themes/chartThemes";
import { translate, useWebviewL10n } from "@webview/l10n";
import { CustomChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

echarts.use([
  CustomChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
  SVGRenderer,
  LegendComponent,
]);

for (const theme of CHART_THEMES.values()) {
  echarts.registerTheme(theme.id, theme.data);
}

interface GanttChartProps {
  /** Current authored and computed project presentation. */
  project: ProjectPresentation;
  /** Persisted chart view preferences. */
  view: ProjectView;
  /** Effective color theme. */
  theme: ChartTheme;
  /** Whether the session legend is visible. */
  legendVisible: boolean;
  /** Whether the session colored-style mode is enabled. */
  coloredStyleEnabled: boolean;
  /** Changes whenever the chart should fit its current entities. */
  fitVersion: number;
  /** Opens an entity in the edit form. */
  onEditEntity: (entity: EditableEntityRef) => void;
  /** Emits a complete proposed persisted view. */
  onViewChange: (view: ProjectView) => void;
}

/** Imperative commands exposed by the rendered chart. */
export interface GanttChartHandle {
  /**
   * Exports the current chart using the requested format and destination.
   * @param format Requested SVG or PNG format.
   * @param destination Download or clipboard destination.
   * @returns A promise that settles after export completion.
   * @throws When chart conversion or browser delivery fails.
   */
  exportImage: (format: ChartExportFormat, destination: ChartExportDestination) => Promise<void>;
}

/** Renders the Gantt timeline with Apache ECharts using a custom series. */
export const GanttChart = forwardRef<GanttChartHandle, GanttChartProps>(
  function GanttChart(props, ref): React.JSX.Element {
    const l10n = useWebviewL10n();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<ReadonlySet<string>>(
      () => new Set(),
    );
    const rows = useMemo(
      () => buildVisibleChartRows(props.project, collapsedGroupIds),
      [props.project, collapsedGroupIds],
    );

    useImperativeHandle(
      ref,
      () => ({
        exportImage: async (format, destination) => {
          const chart = chartRef.current;
          if (!chart) {
            return;
          }
          await exportChartImage(chart, format, destination, {
            svg: translate(l10n, "Gantt chart.svg"),
            png: translate(l10n, "Gantt chart.png"),
          });
        },
      }),
      [l10n],
    );

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }
      const chart = echarts.init(containerRef.current, propsRef.current.theme.id, {
        renderer: "svg",
      });
      chartRef.current = chart;

      chart.on("click", (event) => {
        const action = resolveChartClick(event);
        switch (action.kind) {
          case "toggleGroup":
            setCollapsedGroupIds((current) => toggleCollapsedGroup(current, action.groupId));
            break;
          case "edit":
            propsRef.current.onEditEntity(action.entity);
            break;
        }
      });
      chart.on("legendselectchanged", (event) => {
        const next = applyLegendSelection(
          propsRef.current.view,
          event as { name: string; selected: Record<string, boolean> },
        );
        if (next) {
          propsRef.current.onViewChange(next);
        }
      });

      const resize = () => chart.resize();
      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        chart.dispose();
        chartRef.current = null;
      };
    }, []);

    useEffect(() => {
      chartRef.current?.setTheme(props.theme.id);
    }, [props.theme.id]);

    useEffect(() => {
      chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
    }, [props.fitVersion]);

    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) {
        return;
      }
      chart.setOption(
        buildChartOption({
          project: props.project,
          view: props.view,
          rows,
          themeData: props.theme.data,
          legendVisible: props.legendVisible,
          coloredStyleEnabled: props.coloredStyleEnabled,
          locale: l10n.locale,
          unavailable: translate(l10n, "—"),
          translate: (source: string, ...values: readonly unknown[]) =>
            translate(l10n, source, ...values),
        }),
        true,
      );
      if (containerRef.current) {
        containerRef.current.style.height = `${Math.max(rows.length, 1) * CHART_ROW_HEIGHT + 80}px`;
        chart.resize();
      }
    }, [
      l10n,
      props.project,
      props.view,
      props.legendVisible,
      props.coloredStyleEnabled,
      props.theme,
      rows,
    ]);

    return <div className="ganttee-gantt-chart" ref={containerRef} />;
  },
);
