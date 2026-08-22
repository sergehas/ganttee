import {
  DependencyType,
  effectiveEnd,
  effectiveStart,
  GanttDocument,
  Milestone,
  Task,
} from "../../common/models";
import { EditableEntityRef } from "../../common/protocol";

/** A task or milestone row displayed on the chart axis. */
export interface ChartRow {
  /** Entity identifier represented by the row. */
  id: string;
  /** Label displayed on the chart axis. */
  label: string;
  /** Entity kind represented by the row. */
  kind: "task" | "milestone";
}

/** A schedulable entity reduced to the dates needed by dependency links. */
export interface SchedulableRef {
  /** Entity identifier used by a dependency endpoint. */
  id: string;
  /** Effective start date, when available. */
  start: string | undefined;
  /** Effective end date, when available. */
  end: string | undefined;
}

/** Milliseconds in one calendar day. */
export const DAY = 24 * 60 * 60 * 1000;

/** Counts task and milestone rows needed by the chart. */
export function countChartRows(document: GanttDocument): number {
  return document.tasks.length + document.milestones.length;
}

/** Builds chart rows and their entity-to-row index lookup. */
export function buildChartRows(document: GanttDocument): {
  rows: ChartRow[];
  indexById: Map<string, number>;
} {
  const rows: ChartRow[] = [
    ...document.tasks.map(
      (task): ChartRow => ({ id: task.id, label: task.name, kind: "task" }),
    ),
    ...document.milestones.map(
      (milestone): ChartRow => ({
        id: milestone.id,
        label: milestone.name,
        kind: "milestone",
      }),
    ),
  ];
  const indexById = new Map<string, number>();
  rows.forEach((row, index) => indexById.set(row.id, index));
  return { rows, indexById };
}

/** Computes the visible time range around all scheduled entities. */
export function chartDateRange(document: GanttDocument): {
  min: number;
  max: number;
} {
  const values: number[] = [];
  for (const task of document.tasks) {
    const start = effectiveStart(task);
    const end = effectiveEnd(task);
    if (start !== undefined) {
      values.push(toChartMs(start));
    }
    if (end !== undefined) {
      values.push(toChartMs(end));
    }
  }
  for (const milestone of document.milestones) {
    if (milestone.date === undefined) {
      continue;
    }
    values.push(toChartMs(milestone.date));
  }
  if (values.length === 0) {
    const now = Date.now();
    return { min: now - DAY * 3, max: now + DAY * 14 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min: min - DAY * 2, max: max + DAY * 2 };
}

/** Resolves link endpoints as anchor-to-owner coordinates for the given type. */
export function dependencyLinkEndpoints(
  type: DependencyType,
  source: SchedulableRef,
  target: SchedulableRef,
): [number, number] | undefined {
  switch (type) {
    case "startAfter":
      return endpointsOf(target.end, source.start);
    case "startWith":
      return endpointsOf(target.start, source.start);
    case "endWith":
      return endpointsOf(target.end, source.end);
  }
}

/** Resolves a task or milestone into dependency scheduling coordinates. */
export function schedulableById(
  document: GanttDocument,
  id: string,
): SchedulableRef | undefined {
  const task = document.tasks.find((current) => current.id === id);
  if (task) {
    return {
      id: task.id,
      start: effectiveStart(task),
      end: effectiveEnd(task),
    };
  }
  const milestone = document.milestones.find((current) => current.id === id);
  if (!milestone) {
    return undefined;
  }
  return { id: milestone.id, start: milestone.date, end: milestone.date };
}

/** Extracts an editable entity reference from a chart event payload. */
export function entityFromChartEvent(
  params: unknown,
): EditableEntityRef | undefined {
  const event = params as {
    seriesName?: string;
    data?: { task?: Task; milestone?: Milestone };
  };
  if (event.seriesName === "tasks" && event.data?.task) {
    return { kind: "task", id: event.data.task.id };
  }
  if (event.seriesName === "milestones" && event.data?.milestone) {
    return { kind: "milestone", id: event.data.milestone.id };
  }
  return undefined;
}

/** Formats task and milestone data for the chart tooltip. */
export function chartTooltipFormatter(params: unknown): string {
  const data = (
    params as {
      data?: { task?: Task; milestone?: { name: string; date: string } };
    }
  ).data;
  if (data?.task) {
    const start = effectiveStart(data.task) ?? "—";
    const end = effectiveEnd(data.task) ?? "—";
    return `<strong>${escapeChartHtml(data.task.name)}</strong><br/>${start} → ${end}`;
  }
  if (data?.milestone) {
    return `<strong>${escapeChartHtml(data.milestone.name)}</strong><br/>${data.milestone.date}`;
  }
  return "";
}

/**
 * Converts an ISO calendar date to a local midnight timestamp.
 *
 * Local (not UTC) midnight is deliberate: the ECharts axis is a `time` axis
 * without `useUTC`, so it labels ticks in local time. Do not use this for date
 * arithmetic — use {@link diffIsoDates} instead.
 */
export function toChartMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

/** Escapes entity text before it is inserted into tooltip HTML. */
export function escapeChartHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Converts a pair of optional ISO dates into millisecond endpoints. */
function endpointsOf(
  anchor: string | undefined,
  owner: string | undefined,
): [number, number] | undefined {
  if (anchor === undefined || owner === undefined) {
    return undefined;
  }
  return [toChartMs(anchor), toChartMs(owner)];
}
