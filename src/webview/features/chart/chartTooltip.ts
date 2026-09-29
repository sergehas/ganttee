import { formatShortDate, parseIsoTimestamp } from "@common/dates";
import { effectiveEnd, effectiveStart, Milestone, Task } from "@common/documents";

/** Formats task and milestone data for the chart tooltip.
 * @param params ECharts tooltip event payload.
 * @param locale Locale used for date formatting.
 * @param unavailable Fallback text for missing dates.
 * @param translate Localizes the task date range.
 * @returns Tooltip HTML, or an empty string for unsupported data.
 */
export function chartTooltipFormatter(
  params: unknown,
  locale: string,
  unavailable: string,
  translate: (source: string, ...values: readonly unknown[]) => string,
): string {
  const data = (
    params as {
      data?: {
        task?: Task;
        milestone?: Milestone;
        effectiveStart?: string;
        effectiveEnd?: string;
        effectiveDate?: string;
      };
    }
  ).data;
  if (data?.task) {
    const start = displayTooltipDate(
      data.effectiveStart ?? effectiveStart(data.task),
      locale,
      unavailable,
    );
    const end = displayTooltipDate(
      data.effectiveEnd ?? effectiveEnd(data.task),
      locale,
      unavailable,
    );
    return `<strong>${escapeChartHtml(data.task.name)}</strong><br/>${translate("{0} → {1}", start, end)}`;
  }
  if (data?.milestone) {
    const date = displayTooltipDate(data.effectiveDate ?? data.milestone.date, locale, unavailable);
    return `<strong>${escapeChartHtml(data.milestone.name)}</strong><br/>${date}`;
  }
  return "";
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
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
