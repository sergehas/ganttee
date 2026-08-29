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
  effectiveEnd,
  effectiveStart,
  GanttDocument,
  Milestone,
} from "../common/models";
import { EditableEntityRef } from "../common/protocol";
import {
  buildChartRows,
  chartDateRange,
  chartTooltipFormatter,
  countChartRows,
  dependencyLinkEndpoints,
  entityFromChartEvent,
  schedulableById,
  toChartMs,
} from "./utils/chartUtils";

echarts.use([
  CustomChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const ROW_HEIGHT = 28;
const BAR_RATIO = 0.6;

interface GanttChartProps {
  /** Current parsed Gantt document. */
  document: GanttDocument;
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
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.setOption(buildOption(props.document, props.selectedEntity), true);
    if (containerRef.current) {
      const rows = countChartRows(props.document);
      containerRef.current.style.height = `${Math.max(rows, 1) * ROW_HEIGHT + 80}px`;
      chart.resize();
    }
  }, [props.document, props.selectedEntity]);

  return <div className="ganttee-chart" ref={containerRef} />;
}

/** Builds the ECharts option from the current document and selection. */
function buildOption(
  document: GanttDocument,
  selectedEntity: EditableEntityRef | null,
): echarts.EChartsCoreOption {
  const { rows, indexById } = buildChartRows(document);
  const range = chartDateRange(document);

  const taskData = document.tasks
    .map((task) => {
      const start = effectiveStart(task);
      const end = effectiveEnd(task);
      if (start === undefined || end === undefined) {
        return undefined;
      }
      return {
        value: [indexById.get(task.id) ?? 0, toChartMs(start), toChartMs(end)],
        task,
        selected:
          selectedEntity?.kind === "task" && selectedEntity.id === task.id,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const milestoneData = document.milestones
    .filter(
      (milestone): milestone is Milestone & { date: string } =>
        milestone.date !== undefined,
    )
    .map((milestone) => ({
      value: [indexById.get(milestone.id) ?? 0, toChartMs(milestone.date)],
      milestone,
      selected:
        selectedEntity?.kind === "milestone" &&
        selectedEntity.id === milestone.id,
    }));

  const linkData = document.dependencies
    .map((dep) => {
      const source = schedulableById(document, dep.sourceId);
      const target = schedulableById(document, dep.targetId);
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
      formatter: chartTooltipFormatter,
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

/** Renders a task as a horizontal timeline bar. */
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

/** Renders a milestone as a diamond marker. */
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
    style: api.style({
      stroke: "var(--vscode-editor-foreground)",
      lineWidth: 1,
    }),
  };
};

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
