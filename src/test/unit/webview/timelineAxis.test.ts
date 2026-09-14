import { MS_PER_DAY } from "@common/dates";
import {
  alignTimelineStart,
  buildTimelineTicks,
  createTimelineAxisModel,
} from "@webview/timelineAxis";
import * as assert from "assert";

suite("timelineAxis", () => {
  test("formats week zoom with ISO weeks below a month parent row", () => {
    const model = createTimelineAxisModel("week", "en-US");
    const date = Date.UTC(2026, 0, 5);

    assert.strictEqual(model.formatSelected(date), "W02");
    assert.strictEqual(model.formatParent?.(date), "Jan 2026");
    assert.strictEqual(model.selectedInterval, 7 * MS_PER_DAY);
    assert.strictEqual(model.parentInterval, 7 * MS_PER_DAY);
    assert.strictEqual(model.formatParent?.(Date.UTC(2026, 0, 12)), "");
  });

  test("formats day-of-month values and labels weeks only on Mondays", () => {
    const day = createTimelineAxisModel("day", "en-US");
    const sunday = Date.UTC(2027, 0, 3);
    const monday = Date.UTC(2027, 0, 4);

    assert.strictEqual(day.formatSelected(sunday), "3");
    assert.strictEqual(day.formatParent?.(sunday), "");
    assert.strictEqual(day.formatParent?.(monday), "W01");
  });

  test("creates month and quarter parent labels", () => {
    const month = createTimelineAxisModel("month", "en-US");
    const quarter = createTimelineAxisModel("quarter", "en-US");
    const september = Date.UTC(2026, 8, 1);
    const july = Date.UTC(2026, 6, 1);
    const january = Date.UTC(2026, 0, 1);

    assert.strictEqual(month.formatSelected(september), "Sep 2026");
    assert.strictEqual(month.formatParent?.(july), "Q3 2026");
    assert.strictEqual(month.formatParent?.(september), "");
    assert.strictEqual(quarter.formatSelected(september), "Q3 2026");
    assert.strictEqual(quarter.formatParent?.(january), "2026");
    assert.strictEqual(quarter.formatParent?.(september), "");
  });

  test("uses one header row for year zoom", () => {
    const model = createTimelineAxisModel("year", "en-US");

    assert.strictEqual(model.formatSelected(Date.UTC(2026, 0, 1)), "2026");
    assert.strictEqual(model.parentInterval, undefined);
    assert.strictEqual(model.formatParent, undefined);
  });

  test("assigns progressively wider visible durations", () => {
    const durations = ["day", "week", "month", "quarter", "year"].map(
      (level) =>
        createTimelineAxisModel(
          level as "day" | "week" | "month" | "quarter" | "year",
          "en-US",
        ).visibleDuration,
    );

    assert.deepStrictEqual(
      durations,
      [...durations].sort((a, b) => a - b),
    );
  });

  test("aligns week and larger zooms to calendar boundaries", () => {
    const value = Date.UTC(2026, 8, 16, 14);

    assert.strictEqual(alignTimelineStart("day", value), Date.UTC(2026, 8, 14));
    assert.strictEqual(
      alignTimelineStart("week", value),
      Date.UTC(2026, 8, 14),
    );
    assert.strictEqual(
      alignTimelineStart("month", value),
      Date.UTC(2026, 8, 1),
    );
    assert.strictEqual(
      alignTimelineStart("quarter", value),
      Date.UTC(2026, 6, 1),
    );
    assert.strictEqual(alignTimelineStart("year", value), Date.UTC(2026, 0, 1));
  });

  test("builds every daily tick with one week label per Monday", () => {
    const ticks = buildTimelineTicks("day", "en-US", {
      min: Date.UTC(2026, 0, 5),
      max: Date.UTC(2026, 0, 18),
    });

    assert.deepStrictEqual(
      ticks.map((tick) => [tick.label, tick.parentLabel]),
      [
        ["5", "W02"],
        ["6", undefined],
        ["7", undefined],
        ["8", undefined],
        ["9", undefined],
        ["10", undefined],
        ["11", undefined],
        ["12", "W03"],
        ["13", undefined],
        ["14", undefined],
        ["15", undefined],
        ["16", undefined],
        ["17", undefined],
        ["18", undefined],
      ],
    );
  });

  test("builds one distinct ISO-week tick and grid line per Monday", () => {
    const ticks = buildTimelineTicks("week", "en-US", {
      min: Date.UTC(2025, 11, 29),
      max: Date.UTC(2026, 1, 2),
    });

    assert.deepStrictEqual(
      ticks.map((tick) => tick.label),
      ["W01", "W02", "W03", "W04", "W05", "W06"],
    );
    assert.strictEqual(new Set(ticks.map((tick) => tick.value)).size, 6);
  });

  test("builds a year parent label only for the first quarter", () => {
    const ticks = buildTimelineTicks("quarter", "en-US", {
      min: Date.UTC(2026, 0, 1),
      max: Date.UTC(2026, 9, 1),
    });

    assert.deepStrictEqual(
      ticks.map((tick) => [tick.label, tick.parentLabel]),
      [
        ["Q1 2026", "2026"],
        ["Q2 2026", undefined],
        ["Q3 2026", undefined],
        ["Q4 2026", undefined],
      ],
    );
  });
});
