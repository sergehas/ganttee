import { MS_PER_DAY } from "@common/dates";
import { DependencyType, ProjectView } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import { renderCalendarArea } from "@webview/features/chart/calendarRenderer";
import { CalendarAreaData, TimelineTickData } from "@webview/features/chart/chart.types";
import { legendSelection } from "@webview/features/chart/chartInteractions";
import {
  buildMetroGroupColorMap,
  resolveMetroItemColor,
} from "@webview/features/chart/chartItemColors";
import { withItemLabel } from "@webview/features/chart/chartItemLabels";
import { ChartRow, isEffectivelyScheduled } from "@webview/features/chart/chartRows";
import { toChartMs } from "@webview/features/chart/chartTime";
import { chartTooltipFormatter } from "@webview/features/chart/chartTooltip";
import { bindThemeToRenderer } from "@webview/features/chart/styles/visualStyle";
import { VISUAL_STYLES } from "@webview/features/chart/styles/visualStyles";
import { ChartTheme } from "@webview/features/chart/themes/chartThemes";
import {
  alignTimelineStart,
  buildTimelineTicks,
  createTimelineAxisModel,
} from "@webview/features/chart/timelineAxis";
import { createTimelineTickRenderer } from "@webview/features/chart/timelineHeaderRenderer";
import type { CustomSeriesRenderItem } from "echarts";
import type { EChartsCoreOption } from "echarts/core" with { "resolution-mode": "import" };

/** Inputs used to build the chart's ECharts option. */
export interface ChartOptionInput {
  /** Current authored and computed project presentation. */
  readonly project: ProjectPresentation;
  /** Persisted chart visibility, style, and zoom preferences. */
  readonly view: ProjectView;
  /** Visible scheduled rows in display order. */
  readonly rows: readonly ChartRow[];
  /** Active color theme data. */
  readonly themeData: ChartTheme["data"];
  /** Whether the session legend is visible. */
  readonly legendVisible: boolean;
  /** Whether the session colored-style mode is enabled. */
  readonly coloredStyleEnabled: boolean;
  /** Locale used by timeline axis builders and tooltip formatting. */
  readonly locale: string;
  /** Localized fallback text for unavailable tooltip values. */
  readonly unavailable: string;
  /** Localizes tooltip and legend text. */
  readonly translate: (text: string, ...args: readonly unknown[]) => string;
}

/** Builds the ECharts option from current project data and chart view state.
 * @param input Project, view, visible rows, theme, and localization inputs.
 * @returns The ECharts option for the current chart state.
 * @throws {RangeError} When a scheduled project date is not a valid ISO timestamp.
 */
export function buildChartOption(input: ChartOptionInput): EChartsCoreOption {
  const {
    project,
    view,
    rows,
    themeData,
    legendVisible,
    coloredStyleEnabled,
    locale,
    unavailable,
    translate,
  } = input;
  const scheduledTasks = project.tasks.filter(isEffectivelyScheduled);
  const scheduledMilestones = project.milestones.filter(isEffectivelyScheduled);
  const scheduledGroups = project.groups.filter(isEffectivelyScheduled);
  const criticalNodeIds = new Set(project.criticalPath.nodeIds);
  const criticalDependencyIds = new Set(project.criticalPath.dependencyIds);
  const criticalColor = themeData.color?.[7];
  const style = VISUAL_STYLES[view.style];
  const metroGroupPaletteColors = coloredStyleEnabled
    ? buildMetroGroupColorMap(project.groups, themeData.color)
    : new Map<string, string>();
  const metroGroupColors = new Map<string, string | undefined>();
  if (coloredStyleEnabled) {
    for (const group of project.groups) {
      metroGroupColors.set(
        group.id,
        resolveMetroItemColor(
          view.showCriticalPath && criticalNodeIds.has(group.id) ? criticalColor : undefined,
          metroGroupPaletteColors.get(group.id),
          resolveStatusColor(group, project.settings.statuses),
          themeData.color?.[0],
        ),
      );
    }
  }

  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  /** Checks whether a scheduled entity has a visible chart row. */
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
  const range = chartRange(timestamps);
  const taskColors = new Map<string, string | undefined>();
  const taskData = tasks.map((task) => {
    const statusColor = resolveStatusColor(task, project.settings.statuses);
    const critical = view.showCriticalPath && criticalNodeIds.has(task.id);
    const color = coloredStyleEnabled
      ? resolveMetroItemColor(
          critical ? criticalColor : undefined,
          task.groupId === undefined ? undefined : metroGroupColors.get(task.groupId),
          statusColor,
          themeData.color?.[1],
        )
      : undefined;
    if (coloredStyleEnabled) {
      taskColors.set(task.id, color);
    }
    return {
      value: [
        indexById.get(task.id)!,
        toChartMs(task.effectiveStart),
        toChartMs(task.effectiveEnd),
      ],
      task,
      effectiveStart: task.effectiveStart,
      effectiveEnd: task.effectiveEnd,
      itemStyle: itemStyle(critical ? criticalColor : undefined, color, statusColor),
      name: task.name,
    };
  });
  const milestoneData = milestones.map((milestone) => {
    const statusColor = resolveStatusColor(milestone, project.settings.statuses);
    const critical = view.showCriticalPath && criticalNodeIds.has(milestone.id);
    const color = coloredStyleEnabled
      ? resolveMetroItemColor(
          critical ? criticalColor : undefined,
          undefined,
          statusColor,
          themeData.color?.[2],
        )
      : undefined;
    if (coloredStyleEnabled) {
      taskColors.set(milestone.id, color);
    }
    return {
      value: [indexById.get(milestone.id)!, toChartMs(milestone.effectiveStart)],
      milestone,
      effectiveDate: milestone.effectiveStart,
      itemStyle: itemStyle(critical ? criticalColor : undefined, color, statusColor),
    };
  });
  const groupData = groups.map((group) => {
    const statusColor = resolveStatusColor(group, project.settings.statuses);
    const critical = coloredStyleEnabled && view.showCriticalPath && criticalNodeIds.has(group.id);
    const color = coloredStyleEnabled ? metroGroupColors.get(group.id) : undefined;
    return {
      value: [
        indexById.get(group.id)!,
        toChartMs(group.effectiveStart),
        toChartMs(group.effectiveEnd),
      ],
      group,
      itemStyle: itemStyle(critical ? criticalColor : undefined, color, statusColor),
    };
  });
  const scheduledById = new Map(
    [...tasks, ...milestones].map((entity) => [
      entity.id,
      { id: entity.id, start: entity.effectiveStart, end: entity.effectiveEnd },
    ]),
  );
  const linkData = project.dependencies.map((dependency) => {
    const source = scheduledById.get(dependency.sourceId);
    const target = scheduledById.get(dependency.targetId);
    if (!source || !target) {
      return undefined;
    }
    const endpoints = dependencyLinkEndpoints(dependency.type, source, target);
    return {
      id: dependency.id,
      value: [indexById.get(target.id)!, endpoints[0], indexById.get(source.id)!, endpoints[1]],
      itemStyle:
        view.showCriticalPath && criticalDependencyIds.has(dependency.id)
          ? itemStyle(criticalColor, taskColors.get(dependency.targetId), undefined)
          : coloredStyleEnabled && taskColors.get(dependency.targetId) !== undefined
            ? { color: taskColors.get(dependency.targetId) }
            : undefined,
    };
  });
  const offDaysAreas = buildOffDaysAreas(project, range);
  const holidayAreas = buildHolidayAreas(project, range);
  const timelineAxis = createTimelineAxisModel(view.zoomLevel, locale);
  const axisRange = { min: alignTimelineStart(view.zoomLevel, range.min), max: range.max };
  const timelineTicks = buildTimelineTicks(view.zoomLevel, locale, axisRange);
  /** Adds labels to a style renderer when item labels are enabled. */
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
      formatter: (name: string) => translate(name),
    },
    axisPointer: { show: true, snap: false, link: [{ xAxisIndex: "all" }] },
    grid: {
      left: view.showItemLabels ? 24 : 160,
      right: 24,
      top: timelineAxis.formatParent === undefined ? 44 : 68,
      bottom: 40,
    },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "weakFilter",
        start: 0,
        end: Math.min(
          100,
          (timelineAxis.visibleDuration / Math.max(axisRange.max - axisRange.min, 1)) * 100,
        ),
      },
    ],
    xAxis: createTimeAxis(axisRange),
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((row) => row.label),
      axisTick: { show: false },
      axisLabel: { show: !view.showItemLabels },
      splitLine: { show: false },
    },
    series: [
      {
        type: "custom",
        name: "groups",
        renderItem: labelled(bindThemeToRenderer(style.renderGroup, input.themeData), groups, 2),
        encode: { x: [1, 2], y: 0 },
        data: groupData,
        clip: true,
        zlevel: 3,
      },
      {
        type: "custom",
        name: "tasks",
        renderItem: labelled(bindThemeToRenderer(style.renderTask, input.themeData), tasks, 2),
        encode: { x: [1, 2], y: 0 },
        data: taskData,
        clip: true,
        zlevel: 3,
      },
      {
        type: "custom",
        name: "milestones",
        renderItem: labelled(
          bindThemeToRenderer(style.renderMilestone, input.themeData),
          milestones,
          1,
        ),
        encode: { x: 1, y: 0 },
        data: milestoneData,
        clip: true,
        zlevel: 3,
      },
      {
        type: "custom",
        name: "dependencies",
        renderItem: bindThemeToRenderer(style.renderDependency, input.themeData),
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
        data: timelineTicks.map((tick): TimelineTickData => ({ value: [tick.value, 0] })),
        clip: false,
        zlevel: 0,
        silent: true,
      },
      ...[
        { name: "off-days", data: offDaysAreas },
        { name: "holidays", data: holidayAreas },
      ].map(({ name, data }) => ({
        type: "custom" as const,
        name,
        renderItem: renderCalendarArea,
        encode: { x: [0, 1] },
        data,
        clip: true,
        zlevel: 0,
        silent: true,
      })),
    ],
  };
}

/** Chooses a critical-path, explicit, or inherited status color.
 * @param criticalColor Theme color for a critical-path item, when enabled.
 * @param color Resolved style or inherited color.
 * @param statusColor Color assigned to the item's status.
 * @returns The ECharts item style, or `undefined` to use the series palette.
 */
function itemStyle(
  criticalColor: string | undefined,
  color: string | undefined,
  statusColor: string | undefined,
) {
  if (criticalColor !== undefined) {
    return { color: criticalColor };
  }
  if (color !== undefined) {
    return { color };
  }
  return statusColor === undefined ? undefined : { color: statusColor };
}

/** Resolves an item's status color from the project catalog.
 * @param item Item carrying an optional status identifier.
 * @param statuses Available project statuses.
 * @returns The matched color, or `undefined` when no status matches.
 */
function resolveStatusColor(
  item: { readonly status?: string; readonly statusId?: string },
  statuses: readonly { readonly id: string; readonly color: string }[],
): string | undefined {
  const statusId = item.status ?? item.statusId;
  return statusId === undefined
    ? undefined
    : statuses.find((status) => status.id === statusId)?.color;
}

/** Returns a padded project range, or a default range when no items are scheduled.
 * @param timestamps Scheduled chart timestamps.
 * @returns The padded minimum and maximum timestamps.
 */
function chartRange(timestamps: readonly number[]): { min: number; max: number } {
  if (timestamps.length === 0) {
    const now = Date.now();
    return { min: now - 2 * MS_PER_DAY, max: now + 14 * MS_PER_DAY };
  }
  return {
    min: Math.min(...timestamps) - 2 * MS_PER_DAY,
    max: Math.max(...timestamps) + 2 * MS_PER_DAY,
  };
}

/** Builds off-day shading ranges for the visible chart interval.
 * @param project Project calendar settings.
 * @param range Visible chart interval.
 * @returns One shading area per visible day off.
 */
function buildOffDaysAreas(
  project: ProjectPresentation,
  range: { readonly min: number; readonly max: number },
): CalendarAreaData[] {
  const areas: CalendarAreaData[] = [];
  for (let start = startOfDay(range.min); start < range.max; start += MS_PER_DAY) {
    const weekday = new Date(start).getDay() || 7;
    if (project.settings.workingCalendar.daysOff.includes(weekday)) {
      areas.push({ value: [start, start + MS_PER_DAY] });
    }
  }
  return areas;
}

/** Builds holiday shading ranges that intersect the visible chart interval.
 * @param project Project holiday settings.
 * @param range Visible chart interval.
 * @returns Shading areas for intersecting holidays.
 */
function buildHolidayAreas(
  project: ProjectPresentation,
  range: { readonly min: number; readonly max: number },
): CalendarAreaData[] {
  const areas: CalendarAreaData[] = [];
  for (const holiday of project.settings.holidays) {
    const start = startOfDay(toChartMs(holiday.start));
    const end = startOfDay(toChartMs(holiday.end)) + MS_PER_DAY;
    if (end >= range.min && start <= range.max) {
      areas.push({ value: [start, end] });
    }
  }
  return areas;
}

/** Creates the hidden continuous scale used by custom calendar ticks.
 * @param range Axis bounds.
 * @returns The ECharts time-axis configuration.
 */
function createTimeAxis(range: {
  readonly min: number;
  readonly max: number;
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
    zlevel: 0,
  };
}

/** Returns local midnight for a chart timestamp.
 * @param timestamp Chart timestamp.
 * @returns The timestamp at local midnight on the same day.
 */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Resolves dependency endpoints in chart coordinates for one dependency type.
 * @param type Dependency relationship.
 * @param source Scheduled source item.
 * @param target Scheduled target item.
 * @returns The anchor and owner timestamps used to draw the dependency link.
 */
function dependencyLinkEndpoints(
  type: DependencyType,
  source: { readonly start: string; readonly end: string },
  target: { readonly start: string; readonly end: string },
): [number, number] {
  switch (type) {
    case "startAfter":
      return [toChartMs(target.end), toChartMs(source.start)];
    case "startWith":
      return [toChartMs(target.start), toChartMs(source.start)];
    case "endWith":
      return [toChartMs(target.end), toChartMs(source.end)];
  }
}
