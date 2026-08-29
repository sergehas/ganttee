import * as assert from "assert";
import { GanttDocument } from "../common/models";
import {
  buildChartRows,
  chartDateRange,
  chartTooltipFormatter,
  countChartRows,
  dependencyLinkEndpoints,
  entityFromChartEvent,
  escapeChartHtml,
  schedulableById,
  toChartMs,
} from "../webview/utils/chartUtils";

suite("chartUtils", () => {
  test("builds rows and indexes tasks before milestones", () => {
    const document = createDocument();

    assert.strictEqual(countChartRows(document), 3);
    const result = buildChartRows(document);

    assert.deepStrictEqual(result.rows, [
      { id: "t1", label: "Task One", kind: "task" },
      { id: "t2", label: "Task Two", kind: "task" },
      { id: "m1", label: "Milestone One", kind: "milestone" },
    ]);
    assert.strictEqual(result.indexById.get("t1"), 0);
    assert.strictEqual(result.indexById.get("m1"), 2);
  });

  test("computes a padded range from effective task and milestone dates", () => {
    const range = chartDateRange(createDocument());
    const firstDate = toChartMs("2026-01-01");
    const lastDate = toChartMs("2026-01-06");
    const day = 24 * 60 * 60 * 1000;

    assert.deepStrictEqual(range, {
      min: firstDate - day * 2,
      max: lastDate + day * 2,
    });
  });

  test("uses a fallback range when no entities have dates", () => {
    const before = Date.now();
    const range = chartDateRange({
      version: 2,
      tasks: [],
      milestones: [{ id: "m1", name: "Undated", date: undefined }],
      groups: [],
      dependencies: [],
    });
    const after = Date.now();
    const day = 24 * 60 * 60 * 1000;

    assert.ok(range.min >= before - day * 3);
    assert.ok(range.min <= after - day * 3);
    assert.ok(range.max >= before + day * 14);
    assert.ok(range.max <= after + day * 14);
  });

  test("maps dependency types to their chart endpoints", () => {
    const source = { id: "source", start: "2026-01-03", end: "2026-01-05" };
    const target = { id: "target", start: "2026-01-07", end: "2026-01-09" };

    assert.deepStrictEqual(
      dependencyLinkEndpoints("startAfter", source, target),
      [toChartMs("2026-01-09"), toChartMs("2026-01-03")],
    );
    assert.deepStrictEqual(
      dependencyLinkEndpoints("startWith", source, target),
      [toChartMs("2026-01-07"), toChartMs("2026-01-03")],
    );
    assert.deepStrictEqual(dependencyLinkEndpoints("endWith", source, target), [
      toChartMs("2026-01-09"),
      toChartMs("2026-01-05"),
    ]);
    assert.strictEqual(
      dependencyLinkEndpoints("startAfter", source, {
        id: "target",
        start: undefined,
        end: undefined,
      }),
      undefined,
    );
  });

  test("resolves task and milestone scheduling references", () => {
    const document = createDocument();

    assert.deepStrictEqual(schedulableById(document, "t1"), {
      id: "t1",
      start: "2026-01-01",
      end: "2026-01-03",
    });
    assert.deepStrictEqual(schedulableById(document, "m1"), {
      id: "m1",
      start: "2026-01-06",
      end: "2026-01-06",
    });
    assert.strictEqual(schedulableById(document, "missing"), undefined);
  });

  test("maps chart events and escapes tooltip content", () => {
    assert.deepStrictEqual(
      entityFromChartEvent({
        seriesName: "tasks",
        data: { task: { id: "t1", name: "Task" } },
      }),
      { kind: "task", id: "t1" },
    );
    assert.deepStrictEqual(
      entityFromChartEvent({
        seriesName: "milestones",
        data: {
          milestone: { id: "m1", name: "Milestone", date: "2026-01-06" },
        },
      }),
      { kind: "milestone", id: "m1" },
    );
    assert.strictEqual(
      entityFromChartEvent({ seriesName: "dependencies" }),
      undefined,
    );
    assert.strictEqual(
      escapeChartHtml("<Task & more>"),
      "&lt;Task &amp; more&gt;",
    );
    assert.strictEqual(
      chartTooltipFormatter({
        data: {
          task: {
            id: "t1",
            name: "<Task>",
            start: "2026-01-01",
            end: "2026-01-03",
          },
        },
      }),
      "<strong>&lt;Task&gt;</strong><br/>2026-01-01 → 2026-01-03",
    );
    assert.strictEqual(
      chartTooltipFormatter({
        data: { task: { id: "t2", name: "Undated" } },
      }),
      "<strong>Undated</strong><br/>— → —",
    );
    assert.strictEqual(
      chartTooltipFormatter({
        data: { milestone: { name: "Milestone", date: "2026-01-06" } },
      }),
      "<strong>Milestone</strong><br/>2026-01-06",
    );
    assert.strictEqual(
      chartTooltipFormatter({
        data: { milestone: { id: "m2", name: "Undated" } },
      }),
      "<strong>Undated</strong><br/>—",
    );
    assert.strictEqual(chartTooltipFormatter({}), "");
  });

  test("omits an undated milestone from rows and range", () => {
    const document = createDocument();
    document.milestones.push({ id: "m-undated", name: "Undated" });

    const rows = buildChartRows(document);
    const range = chartDateRange(document);

    assert.ok(rows.rows.some((row) => row.id === "m-undated"));
    assert.ok(range.min < range.max);
  });

  test("resolves an undated milestone without dates", () => {
    const document = createDocument();
    document.milestones.push({ id: "m-undated", name: "Undated" });

    assert.deepStrictEqual(schedulableById(document, "m-undated"), {
      id: "m-undated",
      start: undefined,
      end: undefined,
    });
  });
});

function createDocument(): GanttDocument {
  return {
    version: 2,
    tasks: [
      { id: "t1", name: "Task One", start: "2026-01-01", end: "2026-01-03" },
      { id: "t2", name: "Task Two", start: "2026-01-04", end: "2026-01-05" },
    ],
    milestones: [{ id: "m1", name: "Milestone One", date: "2026-01-06" }],
    groups: [],
    dependencies: [],
  };
}
