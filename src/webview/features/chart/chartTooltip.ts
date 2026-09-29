import { formatShortDate, parseIsoTimestamp } from "@common/dates";
import type { ProjectStatus } from "@common/documents";
import type {
  GroupPresentation,
  MilestonePresentation,
  TaskPresentation,
} from "@common/presentation/project/projectItemPresentation";

/** Shared fields used to append status and state details to a tooltip. */
type TooltipEntity = Pick<TaskPresentation, "name" | "state" | "status">;

/** Formats group, task, and milestone data for the chart tooltip.
 * @param params ECharts tooltip event payload.
 * @param locale Locale used for date formatting.
 * @param unavailable Fallback text for missing dates.
 * @param translate Localizes tooltip labels and values.
 * @param statuses Project status catalog used to resolve names and colors.
 * @returns Tooltip HTML, or an empty string for unsupported data.
 */
export function chartTooltipFormatter(
  params: unknown,
  locale: string,
  unavailable: string,
  translate: (source: string, ...values: readonly unknown[]) => string,
  statuses: readonly ProjectStatus[] = [],
): string {
  const data = (
    params as {
      data?: {
        task?: TaskPresentation;
        group?: GroupPresentation;
        milestone?: MilestonePresentation;
        effectiveStart?: string;
        effectiveEnd?: string;
        effectiveDate?: string;
        effectiveDuration?: number;
      };
    }
  ).data;
  if (data?.task) {
    return formatScheduledItemTooltip(
      data.task,
      data.effectiveStart ?? data.task.effectiveStart,
      data.effectiveEnd ?? data.task.effectiveEnd,
      data.effectiveDuration ?? data.task.effectiveDuration,
      locale,
      unavailable,
      translate,
      statuses,
    );
  }
  if (data?.group) {
    return formatScheduledItemTooltip(
      data.group,
      data.effectiveStart ?? data.group.effectiveStart,
      data.effectiveEnd ?? data.group.effectiveEnd,
      data.effectiveDuration ?? data.group.effectiveDuration,
      locale,
      unavailable,
      translate,
      statuses,
    );
  }
  if (data?.milestone) {
    const date = displayTooltipDate(
      data.effectiveDate ?? data.milestone.effectiveStart ?? data.milestone.date,
      locale,
      unavailable,
    );
    return [
      `<strong>${escapeChartHtml(data.milestone.name)}</strong>`,
      date,
      formatItemMetadata(data.milestone, undefined, locale, unavailable, translate, statuses),
    ].join("<br/>");
  }
  return "";
}

/** Formats one task or group with its schedule and shared metadata. */
function formatScheduledItemTooltip(
  item: TaskPresentation | GroupPresentation,
  startIso: string | undefined,
  endIso: string | undefined,
  duration: number | undefined,
  locale: string,
  unavailable: string,
  translate: (source: string, ...args: readonly unknown[]) => string,
  statuses: readonly ProjectStatus[],
): string {
  const start = displayTooltipDate(startIso, locale, unavailable);
  const end = displayTooltipDate(endIso, locale, unavailable);
  return [
    `<strong>${escapeChartHtml(item.name)}</strong>`,
    translate("{0} → {1}", start, end),
    formatItemMetadata(item, duration, locale, unavailable, translate, statuses),
  ].join("<br/>");
}

/** Formats duration, status, and lifecycle state for a tooltip entity. */
function formatItemMetadata(
  item: TooltipEntity,
  duration: number | undefined,
  locale: string,
  unavailable: string,
  translate: (source: string, ...args: readonly unknown[]) => string,
  statuses: readonly ProjectStatus[],
): string {
  const formattedDuration =
    duration === undefined
      ? unavailable
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(duration);
  const status = statuses.find((candidate) => candidate.id === item.status);
  const swatch = statusColorSwatch(status?.color);
  const statusName = escapeChartHtml(status?.name ?? translate("(none)"));
  const statusContent = swatch === "" ? statusName : `${swatch} ${statusName}`;
  const state = item.state === "closed" ? "Closed" : "Open";

  return [
    translate("Duration: {0} working days", formattedDuration),
    `${translate("Status")}: ${statusContent}`,
    `${translate("State")}: ${translate(state)}`,
  ].join("<br/>");
}

/** Creates a status color square only for supported hex colors. */
function statusColorSwatch(color: string | undefined): string {
  if (color === undefined || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color)) {
    return "";
  }
  return `<span aria-hidden="true" style="display:inline-block;width:1em;height:1em;border-radius:25%;margin-right:0.1em;vertical-align:middle;background-color:${color};"></span>`;
}

/** Formats an optional ISO timestamp for a chart tooltip.
 * @param iso Optional ISO timestamp.
 * @param locale Locale used for date formatting.
 * @param unavailable Fallback text when the timestamp is missing.
 * @returns A localized date or the unavailable fallback.
 */
function displayTooltipDate(iso: string | undefined, locale: string, unavailable: string): string {
  return iso === undefined ? unavailable : formatShortDate(parseIsoTimestamp(iso), locale);
}

/** Escapes entity text before it is inserted into tooltip HTML.
 * @param value Untrusted entity label.
 * @returns The label with HTML-sensitive characters escaped.
 */
export function escapeChartHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
