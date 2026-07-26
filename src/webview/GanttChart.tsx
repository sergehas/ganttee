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
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import {
  DependencyType,
  effectiveEnd,
  effectiveStart,
  GanttDocument,
  Task,
} from "../common/models";

echarts.use([
  CustomChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const ROW_HEIGHT = 28;
const BAR_RATIO = 0.6;

interface Row {
  id: string;
  label: string;
  kind: "task" | "milestone";
}

interface GanttChartProps {
  document: GanttDocument;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
}

/** Renders the Gantt timeline with Apache ECharts using a custom series. */
export function GanttChart(props: GanttChartProps): JSX.Element {
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
      const taskId = taskIdFromEvent(params);
      if (taskId) {
        propsRef.current.onSelectTask(taskId);
      }
    });
    chart.on("dblclick", (params) => {
      const taskId = taskIdFromEvent(params);
      if (taskId) {
        propsRef.current.onEditTask(taskId);
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
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.setOption(buildOption(props.document, props.selectedTaskId), true);
    if (containerRef.current) {
      const rows = countRows(props.document);
      containerRef.current.style.height = `${Math.max(rows, 1) * ROW_HEIGHT + 80}px`;
      chart.resize();
    }
  }, [props.document, props.selectedTaskId]);

  return <div className="ganttee-chart" ref={containerRef} />;
}

function countRows(document: GanttDocument): number {
  return document.tasks.length + document.milestones.length;
}

function buildRows(document: GanttDocument): {
  rows: Row[];
  indexById: Map<string, number>;
} {
  const rows: Row[] = [
    ...document.tasks.map(
      (task): Row => ({ id: task.id, label: task.title, kind: "task" }),
    ),
    ...document.milestones.map(
      (milestone): Row => ({
        id: milestone.id,
        label: milestone.title,
        kind: "milestone",
      }),
    ),
  ];
  const indexById = new Map<string, number>();
  rows.forEach((row, index) => indexById.set(row.id, index));
  return { rows, indexById };
}

function buildOption(
  document: GanttDocument,
  selectedTaskId: string | null,
): echarts.EChartsCoreOption {
  const { rows, indexById } = buildRows(document);
  const range = dateRange(document);

  const taskData = document.tasks
    .map((task) => {
      const start = effectiveStart(task);
      const end = effectiveEnd(task);
      if (start === undefined || end === undefined) {
        return undefined;
      }
      return {
        value: [indexById.get(task.id) ?? 0, toMs(start), toMs(end)],
        task,
        selected: task.id === selectedTaskId,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const milestoneData = document.milestones.map((milestone) => ({
    value: [indexById.get(milestone.id) ?? 0, toMs(milestone.date)],
    milestone,
  }));

  const linkData = document.dependencies
    .map((dep) => {
      const source = document.tasks.find((task) => task.id === dep.sourceId);
      const target = document.tasks.find((task) => task.id === dep.targetId);
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
      return { value: [targetRow, fromMs, sourceRow, toMsValue] };
    })
    .filter((item): item is { value: number[] } => item !== undefined);

  return {
    animation: false,
    tooltip: {
      trigger: "item",
      formatter: tooltipFormatter,
    },
    grid: { left: 160, right: 24, top: 40, bottom: 40 },
    xAxis: {
      type: "time",
      min: range.min,
      max: range.max,
      position: "top",
      splitLine: { show: true },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((row) => row.label),
      axisTick: { show: false },
    },
    series: [
      {
        type: "custom",
        name: "dependencies",
        renderItem: renderLink,
        encode: { x: [1, 3], y: [0, 2] },
        data: linkData,
        z: 1,
        silent: true,
      },
      {
        type: "custom",
        name: "tasks",
        renderItem: renderTaskBar,
        encode: { x: [1, 2], y: 0 },
        data: taskData,
        z: 2,
      },
      {
        type: "custom",
        name: "milestones",
        renderItem: renderMilestone,
        encode: { x: 1, y: 0 },
        data: milestoneData,
        z: 3,
      },
    ],
  };
}

const renderTaskBar: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const start = api.coord([api.value(1), rowIndex]);
  const end = api.coord([api.value(2), rowIndex]);
  const height = (api.size?.([0, 1]) as number[])[1] * BAR_RATIO;
  const width = Math.max(end[0] - start[0], 2);

  return {
    type: "rect",
    shape: {
      x: start[0],
      y: start[1] - height / 2,
      width,
      height,
      r: 3,
    },
    style: api.style(),
  };
};

const renderMilestone: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn => {
  const rowIndex = api.value(0) as number;
  const point = api.coord([api.value(1), rowIndex]);
  const size = ((api.size?.([0, 1]) as number[])[1] * BAR_RATIO) / 2;

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
    style: api.style(),
  };
};

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

function tooltipFormatter(params: unknown): string {
  const data = (params as { data?: { task?: Task; milestone?: { title: string; date: string } } })
    .data;
  if (data?.task) {
    const start = effectiveStart(data.task) ?? "—";
    const end = effectiveEnd(data.task) ?? "—";
    return `<strong>${escapeHtml(data.task.title)}</strong><br/>${start} → ${end}`;
  }
  if (data?.milestone) {
    return `<strong>${escapeHtml(data.milestone.title)}</strong><br/>${data.milestone.date}`;
  }
  return "";
}

function taskIdFromEvent(params: unknown): string | undefined {
  const event = params as { seriesName?: string; data?: { task?: Task } };
  if (event.seriesName === "tasks" && event.data?.task) {
    return event.data.task.id;
  }
  return undefined;
}

function dateRange(document: GanttDocument): { min: number; max: number } {
  const values: number[] = [];
  for (const task of document.tasks) {
    const start = effectiveStart(task);
    const end = effectiveEnd(task);
    if (start !== undefined) {
      values.push(toMs(start));
    }
    if (end !== undefined) {
      values.push(toMs(end));
    }
  }
  for (const milestone of document.milestones) {
    values.push(toMs(milestone.date));
  }
  if (values.length === 0) {
    const now = Date.now();
    return { min: now - DAY * 3, max: now + DAY * 14 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min: min - DAY * 2, max: max + DAY * 2 };
}

/**
 * Resolves link endpoints as anchor-to-owner coordinates for the given type.
 */
function dependencyLinkEndpoints(
  type: DependencyType,
  source: Task,
  target: Task,
): [number, number] | undefined {
  const sourceStart = effectiveStart(source);
  const sourceEnd = effectiveEnd(source);
  const targetStart = effectiveStart(target);
  const targetEnd = effectiveEnd(target);
  switch (type) {
    case "startAfter":
      return endpointsOf(targetEnd, sourceStart);
    case "startWith":
      return endpointsOf(targetStart, sourceStart);
    case "endWith":
      return endpointsOf(targetEnd, sourceEnd);
    case "endBefore":
      return endpointsOf(targetStart, sourceEnd);
  }
}

/**
 * Converts a pair of optional ISO dates into millisecond endpoints, or
 * `undefined` when either date is missing.
 */
function endpointsOf(
  anchor: string | undefined,
  owner: string | undefined,
): [number, number] | undefined {
  if (anchor === undefined || owner === undefined) {
    return undefined;
  }
  return [toMs(anchor), toMs(owner)];
}

const DAY = 24 * 60 * 60 * 1000;

function toMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
