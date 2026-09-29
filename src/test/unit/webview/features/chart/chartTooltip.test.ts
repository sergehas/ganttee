import { formatShortDate } from "@common/dates";
import { chartTooltipFormatter, escapeChartHtml } from "@webview/features/chart/chartTooltip";
import * as assert from "assert";

suite("chartTooltip", () => {
  const locale = "en-US";
  const unavailable = "—";
  const formatRange = (_source: string, ...values: readonly unknown[]) =>
    `${values[0]} → ${values[1]}`;

  test("formats task and milestone details and escapes labels", () => {
    assert.strictEqual(escapeChartHtml("<Task & more>"), "&lt;Task &amp; more&gt;");
    assert.strictEqual(
      chartTooltipFormatter(
        {
          data: {
            task: {
              id: "t1",
              name: "<Task>",
              start: "2026-01-01",
              end: "2026-01-03",
            },
          },
        },
        locale,
        unavailable,
        formatRange,
      ),
      `<strong>&lt;Task&gt;</strong><br/>${formatShortDate(new Date("2026-01-01"), locale)} → ${formatShortDate(new Date("2026-01-03"), locale)}`,
    );
    assert.strictEqual(
      chartTooltipFormatter(
        { data: { milestone: { name: "Milestone", date: "2026-01-06" } } },
        locale,
        unavailable,
        formatRange,
      ),
      `<strong>Milestone</strong><br/>${formatShortDate(new Date("2026-01-06"), locale)}`,
    );
  });

  test("uses fallback text for missing dates and ignores unrelated data", () => {
    assert.strictEqual(
      chartTooltipFormatter(
        { data: { task: { id: "t2", name: "Undated" } } },
        locale,
        unavailable,
        formatRange,
      ),
      "<strong>Undated</strong><br/>— → —",
    );
    assert.strictEqual(
      chartTooltipFormatter(
        { data: { milestone: { id: "m2", name: "Undated" } } },
        locale,
        unavailable,
        formatRange,
      ),
      "<strong>Undated</strong><br/>—",
    );
    assert.strictEqual(chartTooltipFormatter({}, locale, unavailable, formatRange), "");
  });

  test("formats effective schedule timestamps supplied by the chart", () => {
    const start = "2026-01-01T11:30:00.000Z";
    const end = "2026-01-02T14:15:00.000Z";

    assert.strictEqual(
      chartTooltipFormatter(
        { data: { task: { id: "t1", name: "Task" }, effectiveStart: start, effectiveEnd: end } },
        locale,
        unavailable,
        formatRange,
      ),
      `<strong>Task</strong><br/>${formatShortDate(new Date(start), locale)} → ${formatShortDate(new Date(end), locale)}`,
    );
  });
});
