import { formatShortDate } from "@common/dates";
import { chartTooltipFormatter, escapeChartHtml } from "@webview/features/chart/chartTooltip";
import * as assert from "assert";

suite("chartTooltip", () => {
  const locale = "en-US";
  const unavailable = "—";
  const translate = (source: string, ...values: readonly unknown[]) =>
    values.reduce<string>(
      (result, value, index) => result.replace(`{${index}}`, String(value)),
      source,
    );
  const statuses = [{ id: "ready", name: "Ready", color: "#00aa00" }];

  test("formats task details, duration, status swatch, and state", () => {
    assert.strictEqual(escapeChartHtml("<Task & more>"), "&lt;Task &amp; more&gt;");
    assert.strictEqual(
      chartTooltipFormatter(
        {
          data: {
            task: {
              id: "t1",
              name: "<Task>",
              status: "ready",
              state: "closed",
              start: "2026-01-01",
              end: "2026-01-03",
              effectiveStart: "2026-01-01T00:00:00.000Z",
              effectiveEnd: "2026-01-03T00:00:00.000Z",
              effectiveDuration: 2.5,
            },
          },
        },
        locale,
        unavailable,
        translate,
        statuses,
      ),
      [
        "<strong>&lt;Task&gt;</strong>",
        `${formatShortDate(new Date("2026-01-01T00:00:00.000Z"), locale)} → ${formatShortDate(new Date("2026-01-03T00:00:00.000Z"), locale)}`,
        "Duration: 2.5 working days",
        'Status: <span aria-hidden="true" style="display:inline-block;width:1em;height:1em;border-radius:25%;margin-right:0.1em;vertical-align:middle;background-color:#00aa00;"></span> Ready',
        "State: Closed",
      ].join("<br/>"),
    );
  });

  test("formats groups like tasks and milestones with status and state", () => {
    assert.strictEqual(
      chartTooltipFormatter(
        {
          data: {
            group: {
              id: "g1",
              name: "Group",
              sequence: [],
              status: "ready",
              state: "open",
              effectiveStart: "2026-01-01T00:00:00.000Z",
              effectiveEnd: "2026-01-05T00:00:00.000Z",
              effectiveDuration: 4,
            },
          },
        },
        locale,
        unavailable,
        translate,
        statuses,
      ),
      [
        "<strong>Group</strong>",
        `${formatShortDate(new Date("2026-01-01T00:00:00.000Z"), locale)} → ${formatShortDate(new Date("2026-01-05T00:00:00.000Z"), locale)}`,
        "Duration: 4 working days",
        'Status: <span aria-hidden="true" style="display:inline-block;width:1em;height:1em;border-radius:25%;margin-right:0.1em;vertical-align:middle;background-color:#00aa00;"></span> Ready',
        "State: Open",
      ].join("<br/>"),
    );
    assert.strictEqual(
      chartTooltipFormatter(
        { data: { milestone: { name: "Milestone", date: "2026-01-06", state: "closed" } } },
        locale,
        unavailable,
        translate,
        statuses,
      ),
      [
        "<strong>Milestone</strong>",
        formatShortDate(new Date("2026-01-06"), locale),
        "Duration: — working days",
        "Status: (none)",
        "State: Closed",
      ].join("<br/>"),
    );
  });

  test("uses fallback text for missing dates and ignores unrelated data", () => {
    assert.strictEqual(
      chartTooltipFormatter(
        { data: { task: { id: "t2", name: "Undated" } } },
        locale,
        unavailable,
        translate,
      ),
      "<strong>Undated</strong><br/>— → —<br/>Duration: — working days<br/>Status: (none)<br/>State: Open",
    );
    assert.strictEqual(
      chartTooltipFormatter(
        { data: { milestone: { id: "m2", name: "Undated" } } },
        locale,
        unavailable,
        translate,
      ),
      "<strong>Undated</strong><br/>—<br/>Duration: — working days<br/>Status: (none)<br/>State: Open",
    );
    assert.strictEqual(chartTooltipFormatter({}, locale, unavailable, translate), "");
  });

  test("formats effective schedule timestamps supplied by the chart", () => {
    const start = "2026-01-01T11:30:00.000Z";
    const end = "2026-01-02T14:15:00.000Z";

    assert.strictEqual(
      chartTooltipFormatter(
        { data: { task: { id: "t1", name: "Task" }, effectiveStart: start, effectiveEnd: end } },
        locale,
        unavailable,
        translate,
      ),
      `<strong>Task</strong><br/>${formatShortDate(new Date(start), locale)} → ${formatShortDate(new Date(end), locale)}<br/>Duration: — working days<br/>Status: (none)<br/>State: Open`,
    );
  });

  test("omits the swatch for an invalid status color", () => {
    const tooltip = chartTooltipFormatter(
      { data: { task: { id: "t1", name: "Task", status: "unsafe" } } },
      locale,
      unavailable,
      translate,
      [{ id: "unsafe", name: "Unsafe", color: "red;position:fixed" }],
    );

    assert.ok(tooltip.includes("Status: Unsafe"));
    assert.ok(!tooltip.includes("background-color:"));
  });
});
