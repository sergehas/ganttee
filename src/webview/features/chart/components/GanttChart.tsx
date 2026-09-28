import { ProjectView } from "@common/documents";
import { EffectiveSchedulePresentation, ProjectPresentation } from "@common/presentation/project";
import { EditableEntityRef } from "@common/protocol";
import { CHART_ROW_HEIGHT, CRITICAL_ITEM_STYLE } from "@webview/features/chart/chart.constants";
import { CalendarAreaData, TimelineTickData } from "@webview/features/chart/chart.types";
import { exportChartImage } from "@webview/features/chart/chartExport";
import type {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import {
  applyLegendSelection,
  legendSelection,
  resolveChartClick,
} from "@webview/features/chart/chartInteractions";
import { withItemLabel } from "@webview/features/chart/chartItemLabels";
import { renderCalendarArea } from "@webview/features/chart/chartRenderers";
import { buildChartRows, ChartRow, toggleCollapsedGroup } from "@webview/features/chart/chartRows";
import {
  chartTooltipFormatter,
  DAY,
  dependencyLinkEndpoints,
  toChartMs,
} from "@webview/features/chart/chartUtils";
import "@webview/features/chart/components/GanttChart.scss";
import { VISUAL_STYLES } from "@webview/features/chart/styles/visualStyles";
import { CHART_THEMES, ChartTheme } from "@webview/features/chart/themes/chartThemes";
import {
  alignTimelineStart,
  buildTimelineTicks,
  createTimelineAxisModel,
} from "@webview/features/chart/timelineAxis";
import { createTimelineTickRenderer } from "@webview/features/chart/timelineHeaderRenderer";
import { translate, useWebviewL10n } from "@webview/l10n";
import type { CustomSeriesRenderItem } from "echarts";
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
   * @param format Requested image format.
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
      () => visibleRows(props.project, collapsedGroupIds),
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
        buildOption(
          props.project,
          props.view,
          rows,
          props.legendVisible,
          l10n.locale,
          translate(l10n, "—"),
          (source: string, ...values: readonly unknown[]) => translate(l10n, source, ...values),
        ),
        true,
      );
      if (containerRef.current) {
        containerRef.current.style.height = `${Math.max(rows.length, 1) * CHART_ROW_HEIGHT + 80}px`;
        chart.resize();
      }
    }, [l10n, props.project, props.view, props.legendVisible, props.theme.id, rows]);

    return <div className="ganttee-gantt-chart" ref={containerRef} />;
  },
);

/**
 * Builds the ECharts option from the current project presentation and view state.
 * The returned option contains the timeline range, calendar shading, dependency layers,
 * critical-path emphasis, entity bars, milestones, and localized tooltip formatting.
 *
 * @param project Current authored and computed project presentation.
 * @param view Persisted chart visibility, style, and zoom preferences.
 * @param rows Visible scheduled rows in display order.
 * @param legendVisible Whether the session legend is visible.
 * @param locale Locale used by timeline axis builders and tooltip formatting.
 * @param unavailable Localized fallback text for unavailable tooltip values.
 * @param formatRange Formats a localized start/end range for tooltip content.
 * @returns An ECharts option describing the current chart rendering.
 * @throws Propagates errors raised while building timeline or chart presentation data.
 */
function buildOption(
  project: ProjectPresentation,
  view: ProjectView,
  rows: readonly ChartRow[],
  legendVisible: boolean,
  locale: string,
  unavailable: string,
  translate: (text: string, ...args: readonly unknown[]) => string,
): echarts.EChartsCoreOption {
  const scheduledTasks = project.tasks.filter(hasEffectiveSchedule);
  const scheduledMilestones = project.milestones.filter(hasEffectiveSchedule);
  const scheduledGroups = project.groups.filter(hasEffectiveSchedule);
  const criticalNodeIds = new Set(project.criticalPath.nodeIds);
  const criticalDependencyIds = new Set(project.criticalPath.dependencyIds);
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const isVisible = (entity: { readonly id: string }) => indexById.has(entity.id);
  const tasks = scheduledTasks.filter(isVisible);
  const milestones = scheduledMilestones.filter(isVisible);
  const groups = scheduledGroups.filter(isVisible);
  const timestamps = [
    ...scheduledTasks.flatMap((task) => [
      toChartMs(task.effectiveStart),
      toChartMs(task.effectiveEnd),
    ]),
    ...scheduledMilestones.map((milestone) => toChartMs(milestone.effectiveStart)),
    ...scheduledGroups.flatMap((group) => [
      toChartMs(group.effectiveStart),
      toChartMs(group.effectiveEnd),
    ]),
  ];
  const now = Date.now();
  const range =
    timestamps.length === 0
      ? { min: now - 2 * DAY, max: now + 14 * DAY }
      : {
          min: Math.min(...timestamps) - 2 * DAY,
          max: Math.max(...timestamps) + 2 * DAY,
        };

  const taskData = tasks.map((task) => {
    const statusColor = resolveStatusColor(task, project.settings.statuses);
    return {
      value: [
        indexById.get(task.id) ?? 0,
        toChartMs(task.effectiveStart),
        toChartMs(task.effectiveEnd),
      ],
      task,
      effectiveStart: task.effectiveStart,
      effectiveEnd: task.effectiveEnd,
      itemStyle:
        view.showCriticalPath && criticalNodeIds.has(task.id)
          ? CRITICAL_ITEM_STYLE
          : statusColor !== undefined
            ? { color: statusColor }
            : undefined,
      name: task.name,
    };
  });

  const milestoneData = milestones.map((milestone) => {
    const statusColor = resolveStatusColor(milestone, project.settings.statuses);
    return {
      value: [indexById.get(milestone.id) ?? 0, toChartMs(milestone.effectiveStart)],
      milestone,
      effectiveDate: milestone.effectiveStart,
      itemStyle:
        view.showCriticalPath && criticalNodeIds.has(milestone.id)
          ? CRITICAL_ITEM_STYLE
          : statusColor !== undefined
            ? { color: statusColor }
            : undefined,
    };
  });

  const groupData = groups.map((group) => {
    const statusColor = resolveStatusColor(group, project.settings.statuses);
    return {
      value: [
        indexById.get(group.id) ?? 0,
        toChartMs(group.effectiveStart),
        toChartMs(group.effectiveEnd),
      ],
      group,
      itemStyle: statusColor !== undefined ? { color: statusColor } : undefined,
    };
  });

  const scheduledById = new Map(
    [...tasks, ...milestones].map((entity) => [
      entity.id,
      {
        id: entity.id,
        start: entity.effectiveStart,
        end: entity.effectiveEnd,
      },
    ]),
  );

  const linkData = project.dependencies.map((dep) => {
    const source = scheduledById.get(dep.sourceId);
    const target = scheduledById.get(dep.targetId);
    if (!source || !target) {
      return undefined;
    }
    const sourceRow = indexById.get(source.id) ?? 0;
    const targetRow = indexById.get(target.id) ?? 0;
    const endpoints = dependencyLinkEndpoints(dep.type, source, target);
    if (!endpoints) {
      return undefined;
    }
    const [fromMs, toMsValue] = endpoints;
    return {
      id: dep.id,
      value: [targetRow, fromMs, sourceRow, toMsValue],
      itemStyle:
        view.showCriticalPath && criticalDependencyIds.has(dep.id)
          ? CRITICAL_ITEM_STYLE
          : undefined,
    };
  });
  const offDaysAreas = buildOffDaysAreas(project, range);
  const holidayAreas = buildHolidayAreas(project, range);
  const timelineAxis = createTimelineAxisModel(view.zoomLevel, locale);
  const axisRange = {
    min: alignTimelineStart(view.zoomLevel, range.min),
    max: range.max,
  };
  const timelineTicks = buildTimelineTicks(view.zoomLevel, locale, axisRange);
  const hasParentAxis = timelineAxis.formatParent !== undefined;
  const fullDuration = Math.max(axisRange.max - axisRange.min, 1);
  const zoomEnd = Math.min(100, (timelineAxis.visibleDuration / fullDuration) * 100);
  const style = VISUAL_STYLES[view.style];
  const labelled = (
    render: CustomSeriesRenderItem,
    items: readonly { readonly name: string }[],
    endDimension: number,
  ) =>
    view.showItemLabels
      ? withItemLabel(
          render,
          items.map((item) => item.name),
          endDimension,
        )
      : render;

  return {
    animation: false,
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => chartTooltipFormatter(params, locale, unavailable, translate),
    },
    legend: {
      show: legendVisible,
      bottom: 0,
      selected: legendSelection(view),
      formatter: (name: string) => {
        return translate(name);
      },
    },
    axisPointer: {
      show: true,
      snap: false,
      link: [
        {
          xAxisIndex: "all",
        },
      ],
    },
    grid: {
      left: view.showItemLabels ? 24 : 160,
      right: 24,
      top: hasParentAxis ? 68 : 44,
      bottom: 40,
    },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "weakFilter",
        start: 0,
        end: zoomEnd,
      },
    ],

    xAxis: createTimeAxis(axisRange),
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((row) => row.label),
      axisTick: { show: false },
      axisLabel: { show: !view.showItemLabels },
      splitLine: {
        show: false,
      },
    },
    series: [
      //warning: order of series lead color selection from the theme
      {
        type: "custom",
        name: "groups",
        renderItem: labelled(style.renderGroup, groups, 2),
        encode: { x: [1, 2], y: 0 },
        data: groupData,
        clip: true,
        zlevel: 3,
      },
      {
        type: "custom",
        name: "tasks",
        renderItem: labelled(style.renderTask, tasks, 2),
        encode: { x: [1, 2], y: 0 },
        data: taskData,
        clip: true,
        zlevel: 3,
      },
      {
        type: "custom",
        name: "milestones",
        renderItem: labelled(style.renderMilestone, milestones, 1),
        encode: { x: 1, y: 0 },
        data: milestoneData,
        clip: true,
        zlevel: 3,
      },
      {
        type: "custom",
        name: "dependencies",
        renderItem: style.renderDependency,
        encode: { x: [1, 3], y: [0, 2] },
        data: linkData,
        clip: true,
        zlevel: 1,
        silent: true,
      },

      {
        type: "custom",
        name: "timeline-header",
        renderItem: createTimelineTickRenderer(
          timelineAxis.formatSelected,
          timelineAxis.formatParent,
        ),
        encode: { x: 0 },
        data: timelineTicks.map((tick): TimelineTickData => ({
          value: [tick.value, 0],
        })),
        clip: false,
        zlevel: 0,
        silent: true,
      },
      {
        type: "custom",
        name: "off-days",
        renderItem: renderCalendarArea,
        encode: { x: [0, 1] },
        data: offDaysAreas,
        clip: true,
        zlevel: 0,
        silent: true,
      },
      {
        type: "custom",
        name: "holidays",
        renderItem: renderCalendarArea,
        encode: { x: [0, 1] },
        data: holidayAreas,
        clip: true,
        zlevel: 0,
        silent: true,
      },
    ],
  };
}

/** Resolves an item color from the project-level status catalog when present. */
function resolveStatusColor(
  item: { readonly status?: string; readonly statusId?: string },
  statuses: readonly { readonly id: string; readonly color: string }[],
): string | undefined {
  const statusId = item.status ?? item.statusId;
  if (statusId === undefined) {
    return undefined;
  }
  const status = statuses.find((candidate) => candidate.id === statusId);
  return status?.color;
}

/** Builds off-day shading ranges for the visible chart interval. */
function buildOffDaysAreas(
  project: ProjectPresentation,
  range: { min: number; max: number },
): CalendarAreaData[] {
  const areas: CalendarAreaData[] = [];
  const daysOff = project.settings.workingCalendar.daysOff;
  for (let start = startOfDay(range.min); start < range.max; start += DAY) {
    const weekday = new Date(start).getDay() || 7;
    if (daysOff.includes(weekday)) {
      areas.push({ value: [start, start + DAY] });
    }
  }
  return areas;
}

/** Builds holiday shading ranges for the visible chart interval. */
function buildHolidayAreas(
  project: ProjectPresentation,
  range: { min: number; max: number },
): CalendarAreaData[] {
  const areas: CalendarAreaData[] = [];
  for (const holiday of project.settings.holidays) {
    const start = startOfDay(toChartMs(holiday.start));
    const end = startOfDay(toChartMs(holiday.end)) + DAY;
    if (end >= range.min && start <= range.max) {
      areas.push({ value: [start, end] });
    }
  }
  return areas;
}

/** Narrows a presented item to one carrying a complete effective schedule. */
function hasEffectiveSchedule<T extends EffectiveSchedulePresentation>(
  item: T,
): item is T & Required<EffectiveSchedulePresentation> {
  return (
    item.effectiveStart !== undefined &&
    item.effectiveEnd !== undefined &&
    item.effectiveDuration !== undefined
  );
}

/**
 * Returns the rows of scheduled entities that are not hidden by a collapsed group.
 * @param project Current project presentation.
 * @param collapsedGroupIds Groups whose descendants are hidden.
 * @returns Visible scheduled rows in display order.
 */
function visibleRows(
  project: ProjectPresentation,
  collapsedGroupIds: ReadonlySet<string>,
): ChartRow[] {
  const scheduledIds = new Set(
    [...project.tasks, ...project.milestones, ...project.groups]
      .filter(hasEffectiveSchedule)
      .map((entity) => entity.id),
  );
  return buildChartRows(project, collapsedGroupIds).filter((row) => scheduledIds.has(row.id));
}

/** Creates the hidden continuous scale used by custom calendar ticks. */
function createTimeAxis(range: { min: number; max: number }): Record<string, unknown> {
  return {
    type: "time",
    min: range.min,
    max: range.max,
    position: "top",
    axisLabel: { show: false },
    axisTick: { show: false },
    axisLine: { show: true },
    splitLine: { show: false },
    zlevel: 0,
  };
}

/** Returns local midnight for a chart timestamp. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
