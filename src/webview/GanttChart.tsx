import type {
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";
import { CustomChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { ProjectDocument, ProjectView } from "../common/documents";
import { ProjectSchedule } from "../common/models";
import { EditableEntityRef } from "../common/protocol";
import { CriticalPathProjection } from "../services/dependency-graph/criticalPathService";
import { translate, useWebviewL10n } from "./l10n";
import {
  alignTimelineStart,
  buildTimelineTicks,
  createTimelineAxisModel,
} from "./timelineAxis";
import {
  clipTimelineRectangle,
  isPointInTimeline,
  TimelineRectangle,
} from "./timelineGeometry";
import {
  AXIS_LABEL_COLOR,
  createTimelineTickRenderer,
} from "./timelineHeaderRenderer";
import {
  chartTooltipFormatter,
  DAY,
  dependencyLinkEndpoints,
  entityFromChartEvent,
  toChartMs,
} from "./utils/chartUtils";

echarts.use([
  CustomChart,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const ROW_HEIGHT = 28;
const BAR_RATIO = 0.6;
const criticalItemStyle = {
  color: "#d19a24",
  borderColor: "#f0c36a",
  borderWidth: 2,
};

interface CalendarAreaBoundary {
  /** Timeline coordinate for this area boundary. */
  readonly xAxis: number;
  /** Optional fill applied to the complete area. */
  readonly itemStyle?: { readonly color: string };
}

type CalendarArea = [CalendarAreaBoundary, CalendarAreaBoundary];

interface TimelineTickData {
  /** Timestamp and placeholder row coordinate used by the custom series. */
  readonly value: readonly [number, number];
}

interface GanttChartProps {
  /** Current authoring document. */
  document: ProjectDocument;
  /** Current host-computed schedule. */
  schedule: ProjectSchedule;
  /** Derived critical path for the current schedule. */
  criticalPath: CriticalPathProjection;
  /** Persisted chart view preferences. */
  view: ProjectView;
  /** Changes whenever the chart should fit its current entities. */
  fitVersion: number;
  /** Entity currently selected in the editor. */
  selectedEntity: EditableEntityRef | null;
  /** Handles selection of an entity from the chart. */
  onSelectEntity: (entity: EditableEntityRef) => void;
  /** Opens an entity in the edit form. */
  onEditEntity: (entity: EditableEntityRef) => void;
  /** Applies an optional direct date shift to an entity. */
  onNudgeEntityByDays?: (entity: EditableEntityRef, days: number) => void;
}

/** Renders the Gantt timeline with Apache ECharts using a custom series. */
export function GanttChart(props: GanttChartProps): React.JSX.Element {
  const l10n = useWebviewL10n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const chart = echarts.init(containerRef.current, undefined, {
      renderer: "canvas",
    });
    chartRef.current = chart;

    chart.on("click", (params) => {
      const entity = entityFromChartEvent(params);
      if (entity) {
        propsRef.current.onSelectEntity(entity);
      }
    });
    chart.on("dblclick", (params) => {
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
      buildOption(
        props.document,
        props.schedule,
        props.criticalPath,
        props.view,
        props.selectedEntity,
        l10n.locale,
        translate(l10n, "—"),
        (start, end) => translate(l10n, "{0} → {1}", start, end),
      ),
      true,
    );
    if (containerRef.current) {
      const rows =
        props.schedule.tasks.length +
        props.schedule.milestones.length +
        props.schedule.groups.length;
      containerRef.current.style.height = `${Math.max(rows, 1) * ROW_HEIGHT + 80}px`;
      chart.resize();
    }
  }, [
    l10n,
    props.document,
    props.schedule,
    props.criticalPath,
    props.view,
    props.selectedEntity,
  ]);

  return <div className="ganttee-chart" ref={containerRef} />;
}

/** Builds the ECharts option from the current document and selection. */
function buildOption(
  document: ProjectDocument,
  scheduledModel: ProjectSchedule,
  criticalPath: CriticalPathProjection,
  view: ProjectView,
  selectedEntity: EditableEntityRef | null,
  locale: string,
  unavailable: string,
  formatRange: (start: string, end: string) => string,
): echarts.EChartsCoreOption {
  const { tasks, milestones, groups } = scheduledModel;
  const criticalNodeIds = new Set(criticalPath.nodeIds);
  const criticalDependencyIds = new Set(criticalPath.dependencyIds);
  const rows = [
    ...tasks.map((task) => ({ id: task.id, label: task.name })),
    ...milestones.map((milestone) => ({
      id: milestone.id,
      label: milestone.name,
    })),
    ...groups.map((group) => ({ id: group.id, label: group.name })),
  ];
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const timestamps = [
    ...tasks.flatMap((task) => [
      task.effectiveStart().getTime(),
      task.effectiveEnd().getTime(),
    ]),
    ...milestones.map((milestone) => milestone.effectiveStart().getTime()),
    ...groups.flatMap((group) => [
      group.effectiveStart.getTime(),
      group.effectiveEnd.getTime(),
    ]),
  ];
  const range = {
    min: Math.min(...timestamps) - 2 * 24 * 60 * 60 * 1000,
    max: Math.max(...timestamps) + 2 * 24 * 60 * 60 * 1000,
  };

  const taskData = tasks
    .map((task) => {
      const authoringTask = document.tasks.find(
        (candidate) => candidate.id === task.id,
      )!;
      return {
        value: [
          indexById.get(task.id) ?? 0,
          task.effectiveStart().getTime(),
          task.effectiveEnd().getTime(),
        ],
        task: authoringTask,
        effectiveStart: task.effectiveStart().toISOString(),
        effectiveEnd: task.effectiveEnd().toISOString(),
        selected:
          selectedEntity?.kind === "task" && selectedEntity.id === task.id,
        itemStyle:
          view.showCriticalPath && criticalNodeIds.has(task.id)
            ? criticalItemStyle
            : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const milestoneData = milestones.map((milestone) => ({
    value: [
      indexById.get(milestone.id) ?? 0,
      milestone.effectiveStart().getTime(),
    ],
    milestone: document.milestones.find(
      (candidate) => candidate.id === milestone.id,
    )!,
    effectiveDate: milestone.effectiveStart().toISOString(),
    selected:
      selectedEntity?.kind === "milestone" &&
      selectedEntity.id === milestone.id,
    itemStyle:
      view.showCriticalPath && criticalNodeIds.has(milestone.id)
        ? criticalItemStyle
        : undefined,
  }));

  const groupData = groups.map((group) => ({
    value: [
      indexById.get(group.id) ?? 0,
      group.effectiveStart.getTime(),
      group.effectiveEnd.getTime(),
    ],
    group: document.groups.find((candidate) => candidate.id === group.id)!,
  }));

  const scheduledById = new Map(
    [...tasks, ...milestones].map((entity) => [
      entity.id,
      {
        id: entity.id,
        start: entity.effectiveStart().toISOString(),
        end: entity.effectiveEnd().toISOString(),
      },
    ]),
  );

  const linkData = document.dependencies
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
    .filter(
      (item): item is { id: string; value: number[] } => item !== undefined,
    );
  const calendarAreas = buildCalendarAreas(document, range, view);
  const timelineAxis = createTimelineAxisModel(view.zoomLevel, locale);
  const axisRange = {
    min: alignTimelineStart(view.zoomLevel, range.min),
    max: range.max,
  };
  const timelineTicks = buildTimelineTicks(view.zoomLevel, locale, axisRange);
  const hasParentAxis = timelineAxis.formatParent !== undefined;
  const fullDuration = Math.max(axisRange.max - axisRange.min, 1);
  const zoomEnd = Math.min(
    100,
    (timelineAxis.visibleDuration / fullDuration) * 100,
  );

  return {
    animation: false,
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) =>
        chartTooltipFormatter(params, locale, unavailable, formatRange),
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

/** Builds off-day and holiday shading ranges for the visible chart interval. */
function buildCalendarAreas(
  document: ProjectDocument,
  range: { min: number; max: number },
  view: ProjectView,
): CalendarArea[] {
  const areas: CalendarArea[] = [];
  if (view.showOffDays) {
    const daysOff = document.settings.workingCalendar.daysOff;
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
    for (const holiday of document.settings.holidays) {
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

/** Creates the hidden continuous scale used by custom calendar ticks. */
function createTimeAxis(range: {
  min: number;
  max: number;
}): Record<string, unknown> {
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

/** Renders a task as a horizontal timeline bar. */
const renderTaskBar: CustomSeriesRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const start = api.coord([api.value(1), rowIndex]);
  const end = api.coord([api.value(2), rowIndex]);
  const height = (api.size?.([0, 1]) as number[])[1] * BAR_RATIO;
  const width = Math.max(end[0] - start[0], 2);
  const shape = clipTimelineRectangle(
    {
      x: start[0],
      y: start[1] - height / 2,
      width,
      height,
    },
    timelineGrid(params),
  );
  if (shape === undefined) {
    return undefined;
  }

  return {
    type: "rect",
    shape: {
      ...shape,
      r: 3,
    },
    style: api.style(),
  };
};

/** Renders a milestone as a diamond marker. */
const renderMilestone: CustomSeriesRenderItem = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const point = api.coord([api.value(1), rowIndex]);
  const size = ((api.size?.([0, 1]) as number[])[1] * BAR_RATIO) / 2;
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
    style: api.style({
      stroke: "var(--vscode-editor-foreground)",
      lineWidth: 1,
    }),
  };
};

/** Resolves the active Cartesian grid from custom-series render parameters. */
function timelineGrid(params: CustomSeriesRenderItemParams): TimelineRectangle {
  return params.coordSys as unknown as TimelineRectangle;
}

/** Renders a dependency as an orthogonal link between entities. */
const renderLink: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
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
    style: {
      stroke: "var(--vscode-descriptionForeground)",
      lineWidth: 1,
      fill: "none",
    },
  };
};

/** Renders a critical dependency above ordinary dependency lines and bars. */
const renderCriticalLink: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
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
    style: {
      stroke: "#d19a24",
      lineWidth: 3,
      fill: "none",
    },
  };
};

/**
 * Returns whether a chart event should be treated as a direct-edit gesture.
 *
 * Ctrl/Cmd + double-click nudges the selected item forward by one day as an
 * initial direct-edit pathway while preserving default double-click editing.
 */
function isDirectEditGesture(params: unknown): boolean {
  const event = params as {
    event?: {
      event?: {
        ctrlKey?: boolean;
        metaKey?: boolean;
      };
    };
  };
  return Boolean(event.event?.event?.ctrlKey || event.event?.event?.metaKey);
}
