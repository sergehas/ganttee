import { MS_PER_DAY } from "@common/dates";
import { DependencyType, ProjectView } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import { renderCalendarArea } from "@webview/features/chart/calendarRenderer";
import { CHART_ITEM_MAX_OVERHANG } from "@webview/features/chart/chart.constants";
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
import type { TimelineAxisModel, TimelineTick } from "@webview/features/chart/timelineAxis";
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
  /** Width of the chart in pixels, used to keep rendered items inside the plot. */
  readonly chartWidth: number;
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

/** Builds options that can remain constant between data and control updates.
 * @param input Project and localization inputs for the tooltip.
 * @returns Animation, tooltip, and axis-pointer options.
 */
export function buildChartStaticOption(input: ChartOptionInput): EChartsCoreOption {
  const { project, locale, unavailable, translate } = input;
  return {
    animation: true,
    animationDurationUpdate: 180,
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) =>
        chartTooltipFormatter(params, locale, unavailable, translate, project.settings.statuses),
    },
    axisPointer: { show: true, snap: false, link: [{ xAxisIndex: "all" }] },
  };
}

/** Builds the legend presentation from the current chart controls.
 * @param input Current view, legend visibility, and translation.
 * @returns The legend option only.
 */
export function buildChartControlOption(input: ChartOptionInput): EChartsCoreOption {
  const { view, legendVisible, translate } = input;
  return {
    legend: {
      id: "chart-legend",
      show: legendVisible,
      bottom: 0,
      selected: legendSelection(view),
      formatter: (name: string) => translate(name),
    },
  };
}

/** Builds the complete initial option by composing its independent sections.
 * @param input Project, view, visible rows, theme, and localization inputs.
 * @returns The composed ECharts option.
 */
export function buildChartOption(input: ChartOptionInput): EChartsCoreOption {
  return {
    ...buildChartStaticOption(input),
    ...buildChartControlOption(input),
    ...buildChartDataOption(input),
    ...buildChartViewportOption(input),
  };
}

/** Builds data and layout options, excluding static and control state.
 * @param input Project, view, visible rows, theme, and localization inputs.
 * @returns Grid, axes, and chart-series options.
 * @throws {RangeError} When a scheduled project date is not a valid ISO timestamp.
 */
export function buildChartDataOption(input: ChartOptionInput): EChartsCoreOption {
  const { project, view, rows, themeData, coloredStyleEnabled, locale } = input;
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
  const range = chartRange(scheduledChartTimestamps(project));
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
      id: task.id,
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
      id: milestone.id,
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
      id: group.id,
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
  const gridLeft = view.showItemLabels ? 24 : 160;
  const gridRight = 24;
  const axisRange = chartAxisRange(input, range);
  const timelineTicks = buildTimelineTicks(view.zoomLevel, locale, axisRange);
  /** Adds labels to a style renderer when item labels are enabled. */
  const labelled = (
    render: CustomSeriesRenderItem,
    items: readonly { readonly name: string }[],
    endDimension: number,
  ) =>
    withItemLabel(
      render,
      items.map((item) => item.name),
      endDimension,
      input.themeData.categoryAxis?.axisLabel,
      view.showItemLabels,
    );

  return {
    grid: {
      left: gridLeft,
      right: gridRight,
      top: timelineAxis.formatParent === undefined ? 44 : 68,
      bottom: 40,
    },
    xAxis: { id: "timeline-x-axis", ...createTimeAxis(axisRange) },
    yAxis: {
      id: "chart-y-axis",
      type: "category",
      inverse: true,
      data: rows.map((row) => row.label),
      axisTick: { show: false },
      axisLabel: { show: !view.showItemLabels },
      axisPointer: { show: !view.showItemLabels },
      splitLine: { show: false },
    },
    series: [
      {
        id: "groups",
        type: "custom",
        name: "groups",
        renderItem: labelled(bindThemeToRenderer(style.renderGroup, input.themeData), groups, 2),
        encode: { x: [1, 2], y: 0 },
        data: groupData,
        clip: true,
        zlevel: 3,
      },
      {
        id: "tasks",
        type: "custom",
        name: "tasks",
        renderItem: labelled(bindThemeToRenderer(style.renderTask, input.themeData), tasks, 2),
        encode: { x: [1, 2], y: 0 },
        data: taskData,
        clip: true,
        zlevel: 3,
      },
      {
        id: "milestones",
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
        id: "dependencies",
        type: "custom",
        name: "dependencies",
        renderItem: bindThemeToRenderer(style.renderDependency, input.themeData),
        encode: { x: [1, 3], y: [0, 2] },
        data: linkData,
        clip: true,
        zlevel: 1,
        silent: true,
      },
      createTimelineHeaderSeries(timelineAxis, timelineTicks),
      ...[
        { id: "off-days", name: "off-days", data: offDaysAreas },
        { id: "holidays", name: "holidays", data: holidayAreas },
      ].map(({ id, name, data }) => ({
        id,
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

/** Builds data-zoom state for the selected zoom level.
 * @param input Current project, view, chart width, and timeline inputs.
 * @returns The data-zoom option only.
 */
export function buildChartViewportOption(input: ChartOptionInput): EChartsCoreOption {
  const range = chartRange(scheduledChartTimestamps(input.project));
  const axisRange = chartAxisRange(input, range);
  const timelineAxis = createTimelineAxisModel(input.view.zoomLevel, input.locale);
  return {
    dataZoom: [
      {
        id: "chart-viewport",
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
  };
}

/** Builds timeline-only options for zoom changes without rebuilding entity series.
 * @param input Current project, zoom level, and chart dimensions.
 * @returns Timeline grid, axis, and header-series options.
 */
export function buildChartTimelineOption(input: ChartOptionInput): EChartsCoreOption {
  const range = chartRange(scheduledChartTimestamps(input.project));
  const axisRange = chartAxisRange(input, range);
  const timelineAxis = createTimelineAxisModel(input.view.zoomLevel, input.locale);
  return {
    grid: { top: timelineAxis.formatParent === undefined ? 44 : 68 },
    xAxis: { id: "timeline-x-axis", ...createTimeAxis(axisRange) },
    series: [
      createTimelineHeaderSeries(
        timelineAxis,
        buildTimelineTicks(input.view.zoomLevel, input.locale, axisRange),
      ),
    ],
  };
}

/** Builds only the axis bounds affected by chart resizing.
 * @param input Current project, view, and chart width.
 * @returns The X-axis range option only.
 */
export function buildChartAxisOption(input: ChartOptionInput): EChartsCoreOption {
  const range = chartRange(scheduledChartTimestamps(input.project));
  return {
    xAxis: { id: "timeline-x-axis", ...createTimeAxis(chartAxisRange(input, range)) },
  };
}

/** Creates stable timeline-header series data for initial and zoom-only updates. */
function createTimelineHeaderSeries(
  timelineAxis: TimelineAxisModel,
  ticks: readonly TimelineTick[],
) {
  return {
    id: "timeline-header",
    type: "custom" as const,
    name: "timeline-header",
    renderItem: createTimelineTickRenderer(timelineAxis.formatSelected, timelineAxis.formatParent),
    encode: { x: 0 },
    data: ticks.map((tick): TimelineTickData => ({
      id: String(tick.value),
      value: [tick.value, 0],
    })),
    clip: false,
    zlevel: 0,
    silent: true,
  };
}

/** Computes axis bounds with enough pixel-scaled room for chart-item overhang.
 * @param input Current view and chart width.
 * @param range Padded project range.
 * @returns The X-axis minimum and maximum.
 */
function chartAxisRange(
  input: ChartOptionInput,
  range: { readonly min: number; readonly max: number },
): { min: number; max: number } {
  const gridLeft = input.view.showItemLabels ? 24 : 160;
  const gridRight = 24;
  const min = alignTimelineStart(input.view.zoomLevel, range.min);
  const span = range.max - min;
  const plotWidth = Math.max(input.chartWidth - gridLeft - gridRight, 1);
  const margin = (span * CHART_ITEM_MAX_OVERHANG) / plotWidth;
  return { min: min - margin, max: range.max + margin };
}

/** Returns scheduled endpoints for constructing the shared chart range.
 * @param project Current project presentation.
 * @returns Timestamps for scheduled task, milestone, and group endpoints.
 */
function scheduledChartTimestamps(project: ProjectPresentation): number[] {
  return [
    ...project.tasks
      .filter(isEffectivelyScheduled)
      .flatMap((task) => [toChartMs(task.effectiveStart), toChartMs(task.effectiveEnd)]),
    ...project.milestones
      .filter(isEffectivelyScheduled)
      .map((milestone) => toChartMs(milestone.effectiveStart)),
    ...project.groups
      .filter(isEffectivelyScheduled)
      .flatMap((group) => [toChartMs(group.effectiveStart), toChartMs(group.effectiveEnd)]),
  ];
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
