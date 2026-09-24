import { ProjectView } from "@common/documents";
import { EffectiveSchedulePresentation, ProjectPresentation } from "@common/presentation/project";
import { EditableEntityRef } from "@common/protocol";
import { CHART_ROW_HEIGHT, CRITICAL_ITEM_STYLE } from "@webview/features/chart/chart.constants";
import { CalendarArea, TimelineTickData } from "@webview/features/chart/chart.types";
import { exportChartImage } from "@webview/features/chart/chartExport";
import type {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import { isDirectEditGesture } from "@webview/features/chart/chartInteractions";
import {
  renderCriticalLink,
  renderLink,
  renderMilestone,
  renderTaskBar,
} from "@webview/features/chart/chartRenderers";
import {
  chartTooltipFormatter,
  DAY,
  dependencyLinkEndpoints,
  entityFromChartEvent,
  toChartMs,
} from "@webview/features/chart/chartUtils";
import "@webview/features/chart/components/GanttChart.scss";
import {
  alignTimelineStart,
  buildTimelineTicks,
  createTimelineAxisModel,
} from "@webview/features/chart/timelineAxis";
import {
  AXIS_LABEL_COLOR,
  createTimelineTickRenderer,
} from "@webview/features/chart/timelineHeaderRenderer";
import { translate, useWebviewL10n } from "@webview/l10n";
import type {} from "echarts";
import { CustomChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

echarts.use([
  CustomChart,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
  SVGRenderer,
]);

interface GanttChartProps {
  /** Current authored and computed project presentation. */
  project: ProjectPresentation;
  /** Persisted chart view preferences. */
  view: ProjectView;
  /** Changes whenever the chart should fit its current entities. */
  fitVersion: number;
  /** Opens an entity in the edit form. */
  onEditEntity: (entity: EditableEntityRef) => void;
  /** Applies an optional direct date shift to an entity. */
  onNudgeEntityByDays?: (entity: EditableEntityRef, days: number) => void;
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
      const chart = echarts.init(containerRef.current, undefined, {
        renderer: "svg",
      });
      chartRef.current = chart;

      chart.on("click", (params) => {
        const entity = entityFromChartEvent(params);
        if (entity) {
          if (isDirectEditGesture(params)) {
            propsRef.current.onNudgeEntityByDays?.(entity, 1);
            return;
          }
          propsRef.current.onEditEntity(entity);
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
      chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
    }, [props.fitVersion]);

    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) {
        return;
      }
      chart.setOption(
        buildOption(props.project, props.view, l10n.locale, translate(l10n, "—"), (start, end) =>
          translate(l10n, "{0} → {1}", start, end),
        ),
        true,
      );
      if (containerRef.current) {
        const rows =
          props.project.tasks.length +
          props.project.milestones.length +
          props.project.groups.length;
        containerRef.current.style.height = `${Math.max(rows, 1) * CHART_ROW_HEIGHT + 80}px`;
        chart.resize();
      }
    }, [l10n, props.project, props.view]);

    return <div className="ganttee-gantt-chart" ref={containerRef} />;
  },
);

/**
 * Builds the ECharts option from the current project presentation and view state.
 * The returned option contains the timeline range, calendar shading, dependency layers,
 * critical-path emphasis, entity bars, milestones, and localized tooltip formatting.
 *
 * @param project Current authored and computed project presentation.
 * @param view Persisted chart visibility and zoom preferences.
 * @param locale Locale used by timeline axis builders and tooltip formatting.
 * @param unavailable Localized fallback text for unavailable tooltip values.
 * @param formatRange Formats a localized start/end range for tooltip content.
 * @returns An ECharts option describing the current chart rendering.
 * @throws Propagates errors raised while building timeline or chart presentation data.
 */
function buildOption(
  project: ProjectPresentation,
  view: ProjectView,
  locale: string,
  unavailable: string,
  formatRange: (start: string, end: string) => string,
): echarts.EChartsCoreOption {
  const tasks = project.tasks.filter(hasEffectiveSchedule);
  const milestones = project.milestones.filter(hasEffectiveSchedule);
  const groups = project.groups.filter(hasEffectiveSchedule);
  const criticalNodeIds = new Set(project.criticalPath.nodeIds);
  const criticalDependencyIds = new Set(project.criticalPath.dependencyIds);
  const indexableIds = new Set([
    ...tasks.map((task) => task.id),
    ...milestones.map((milestone) => milestone.id),
    ...groups.map((group) => group.id),
  ]);
  const rows = orderedRows(project).filter((row) => indexableIds.has(row.id));
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const timestamps = [
    ...tasks.flatMap((task) => [toChartMs(task.effectiveStart), toChartMs(task.effectiveEnd)]),
    ...milestones.map((milestone) => toChartMs(milestone.effectiveStart)),
    ...groups.flatMap((group) => [toChartMs(group.effectiveStart), toChartMs(group.effectiveEnd)]),
  ];
  const now = Date.now();
  const range =
    timestamps.length === 0
      ? { min: now - 2 * DAY, max: now + 14 * DAY }
      : {
          min: Math.min(...timestamps) - 2 * DAY,
          max: Math.max(...timestamps) + 2 * DAY,
        };

  const taskData = tasks
    .map((task) => {
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
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

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

  const linkData = project.dependencies
    .map((dep) => {
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
      };
    })
    .filter((item): item is { id: string; value: number[] } => item !== undefined);
  const calendarAreas = buildCalendarAreas(project, range, view);
  const timelineAxis = createTimelineAxisModel(view.zoomLevel, locale);
  const axisRange = {
    min: alignTimelineStart(view.zoomLevel, range.min),
    max: range.max,
  };
  const timelineTicks = buildTimelineTicks(view.zoomLevel, locale, axisRange);
  const hasParentAxis = timelineAxis.formatParent !== undefined;
  const fullDuration = Math.max(axisRange.max - axisRange.min, 1);
  const zoomEnd = Math.min(100, (timelineAxis.visibleDuration / fullDuration) * 100);

  return {
    animation: false,
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) =>
        chartTooltipFormatter(params, locale, unavailable, formatRange),
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
    grid: { left: 160, right: 24, top: hasParentAxis ? 68 : 44, bottom: 40 },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none",
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
      axisLabel: { color: AXIS_LABEL_COLOR },
    },
    series: [
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
        z: 8,
        silent: true,
      },
      {
        type: "custom",
        name: "dependencies",
        renderItem: renderLink,
        encode: { x: [1, 3], y: [0, 2] },
        data: view.showDependencies ? linkData : [],
        clip: true,
        z: 1,
        silent: true,
        markArea: {
          silent: true,
          data: calendarAreas,
        },
      },
      {
        type: "custom",
        name: "critical-dependencies",
        renderItem: renderCriticalLink,
        encode: { x: [1, 3], y: [0, 2] },
        data: view.showCriticalPath
          ? linkData.filter((link) => criticalDependencyIds.has(link.id))
          : [],
        clip: true,
        z: 4,
        silent: true,
      },
      {
        type: "custom",
        name: "groups",
        renderItem: renderTaskBar,
        encode: { x: [1, 2], y: 0 },
        data: groupData,
        clip: true,
        z: 3,
      },
      {
        type: "custom",
        name: "tasks",
        renderItem: renderTaskBar,
        encode: { x: [1, 2], y: 0 },
        data: taskData,
        clip: true,
        z: 3,
      },
      {
        type: "custom",
        name: "milestones",
        renderItem: renderMilestone,
        encode: { x: 1, y: 0 },
        data: milestoneData,
        clip: true,
        z: 5,
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

/** Builds off-day and holiday shading ranges for the visible chart interval. */
function buildCalendarAreas(
  project: ProjectPresentation,
  range: { min: number; max: number },
  view: ProjectView,
): CalendarArea[] {
  const areas: CalendarArea[] = [];
  if (view.showOffDays) {
    const daysOff = project.settings.workingCalendar.daysOff;
    for (let start = startOfDay(range.min); start < range.max; start += DAY) {
      const weekday = new Date(start).getDay() || 7;
      if (daysOff.includes(weekday)) {
        areas.push([
          {
            xAxis: start,
            itemStyle: { color: "rgba(127, 127, 127, 0.18)" },
          },
          { xAxis: start + DAY },
        ]);
      }
    }
  }
  if (view.showHolidays) {
    for (const holiday of project.settings.holidays) {
      const start = startOfDay(toChartMs(holiday.start));
      const end = startOfDay(toChartMs(holiday.end)) + DAY;
      if (end >= range.min && start <= range.max) {
        areas.push([
          {
            xAxis: start,
            itemStyle: { color: "rgba(240, 163, 10, 0.24)" },
          },
          { xAxis: end },
        ]);
      }
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

/** Flattens the project's authored sequence (root, then each group's own sequence) into row order. */
function orderedRows(project: ProjectPresentation): { id: string; label: string }[] {
  const byId = new Map<string, { id: string; label: string }>();
  for (const task of project.tasks) {
    byId.set(task.id, { id: task.id, label: task.name });
  }
  for (const milestone of project.milestones) {
    byId.set(milestone.id, { id: milestone.id, label: milestone.name });
  }
  for (const group of project.groups) {
    byId.set(group.id, { id: group.id, label: group.name });
  }
  const groupsById = new Map(project.groups.map((group) => [group.id, group]));

  const rows: { id: string; label: string }[] = [];
  const visit = (sequence: readonly string[]) => {
    for (const id of sequence) {
      const row = byId.get(id);
      if (row) {
        rows.push(row);
      }
      const group = groupsById.get(id);
      if (group) {
        visit(group.sequence ?? []);
      }
    }
  };
  visit(project.sequence ?? []);
  return rows;
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
  };
}

/** Returns local midnight for a chart timestamp. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
