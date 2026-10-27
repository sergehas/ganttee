import {
  addWorkingDays,
  diffInWorkingDays,
  diffIsoDates,
  formatIsoTimestamp,
  formatShortDate,
  isoWeekNumber,
  isoWeekday,
  normalizeHolidayRanges,
  normalizeToWorkingTime,
  parseIsoTimestamp,
  quarter,
  subtractWorkingDays,
} from "@common/dates";
import * as assert from "assert";

/** ISO dates spanning a daylight-saving transition in either hemisphere. */
const DST_SPANS: readonly { start: string; end: string; label: string }[] = [
  { start: "2026-03-07", end: "2026-03-09", label: "US spring forward" },
  { start: "2026-11-01", end: "2026-11-02", label: "US fall back" },
  { start: "2026-03-28", end: "2026-03-30", label: "EU spring forward" },
  { start: "2026-10-24", end: "2026-10-26", label: "EU fall back" },
  { start: "2026-10-03", end: "2026-10-05", label: "AU spring forward" },
  { start: "2026-04-04", end: "2026-04-06", label: "AU fall back" },
];

const WORKING_DAY_SETTINGS = Object.freeze({
  daysOff: new Set([6, 7]),
  workingDayHours: 8,
  workingDayStart: 9,
  holidays: [],
});

suite("dates", () => {
  test("counts whole days across daylight-saving transitions", () => {
    for (const span of DST_SPANS) {
      const days = diffIsoDates(span.start, span.end);
      assert.strictEqual(
        days,
        Math.round(days),
        `${span.label}: expected a whole number of days, got ${days}`,
      );
    }
  });

  test("returns the calendar day count between two dates", () => {
    assert.strictEqual(diffIsoDates("2026-01-01", "2026-01-06"), 5);
    assert.strictEqual(diffIsoDates("2026-01-01", "2026-01-01"), 0);
    assert.strictEqual(diffIsoDates("2026-01-06", "2026-01-01"), -5);
  });

  test("validates and formats ISO timestamps", () => {
    const iso = "2026-01-05T12:34:56.789Z";
    const date = parseIsoTimestamp(iso);

    assert.strictEqual(date.toISOString(), iso);
    assert.strictEqual(formatIsoTimestamp(date), iso);
    assert.throws(() => parseIsoTimestamp("nope"), RangeError);
  });

  test("falls back to the default locale for an invalid locale", () => {
    const formatted = formatShortDate(new Date("2026-01-05T12:34:56.789Z"), "-");

    assert.match(formatted, /2026/);
  });

  test("returns ISO weekdays and week numbers", () => {
    const sunday = Date.UTC(2027, 0, 3);
    const monday = Date.UTC(2027, 0, 4);

    assert.strictEqual(isoWeekday(sunday), 7);
    assert.strictEqual(isoWeekday(monday), 1);
    assert.strictEqual(isoWeekNumber(Date.UTC(2025, 11, 29)), 1);
    assert.strictEqual(isoWeekNumber(Date.UTC(2026, 0, 4)), 1);
    assert.strictEqual(isoWeekNumber(Date.UTC(2026, 0, 5)), 2);
  });

  test("returns calendar quarters", () => {
    assert.strictEqual(quarter(Date.UTC(2026, 0, 1)), 1);
    assert.strictEqual(quarter(Date.UTC(2026, 3, 1)), 2);
    assert.strictEqual(quarter(Date.UTC(2026, 6, 1)), 3);
    assert.strictEqual(quarter(Date.UTC(2026, 9, 1)), 4);
  });

  test("normalizes timestamps to active working intervals", () => {
    const beforeStart = normalizeToWorkingTime(
      new Date("2026-01-05T08:59:00.000Z"),
      WORKING_DAY_SETTINGS,
    );
    assert.strictEqual(beforeStart.toISOString(), "2026-01-05T09:00:00.000Z");

    const insideInterval = normalizeToWorkingTime(
      new Date("2026-01-05T10:00:00.000Z"),
      WORKING_DAY_SETTINGS,
    );
    assert.strictEqual(insideInterval.toISOString(), "2026-01-05T10:00:00.000Z");

    const dayOff = normalizeToWorkingTime(
      new Date("2026-01-03T12:00:00.000Z"),
      WORKING_DAY_SETTINGS,
    );
    assert.strictEqual(dayOff.toISOString(), "2026-01-05T09:00:00.000Z");
  });

  test("merges overlapping and adjacent holiday ranges", () => {
    assert.deepStrictEqual(
      normalizeHolidayRanges([
        { start: "2026-01-05", end: "2026-01-07" },
        { start: "2026-01-01", end: "2026-01-02" },
        { start: "2026-01-03", end: "2026-01-04" },
        { start: "2026-01-06", end: "2026-01-10" },
      ]),
      [{ start: "2026-01-01", end: "2026-01-10" }],
    );
  });

  test("applies holidays to forward, reverse, and fractional traversal", () => {
    const settings = {
      ...WORKING_DAY_SETTINGS,
      holidays: [{ start: "2026-01-06", end: "2026-01-07" }],
    };
    assert.strictEqual(
      addWorkingDays(new Date("2026-01-05T14:00:00.000Z"), 1, settings).toISOString(),
      "2026-01-08T14:00:00.000Z",
    );
    assert.strictEqual(
      subtractWorkingDays(new Date("2026-01-08T14:00:00.000Z"), 1, settings).toISOString(),
      "2026-01-05T14:00:00.000Z",
    );
    assert.strictEqual(
      diffInWorkingDays(
        new Date("2026-01-05T14:00:00.000Z"),
        new Date("2026-01-08T14:00:00.000Z"),
        settings,
      ),
      1,
    );
  });

  test("owns overnight intervals by their start date", () => {
    const settings = {
      daysOff: new Set<number>(),
      workingDayHours: 8,
      workingDayStart: 20,
      holidays: [{ start: "2026-01-06", end: "2026-01-06" }],
    };
    assert.strictEqual(
      normalizeToWorkingTime(new Date("2026-01-06T02:00:00.000Z"), settings).toISOString(),
      "2026-01-06T02:00:00.000Z",
    );
    assert.strictEqual(
      normalizeToWorkingTime(new Date("2026-01-06T20:00:00.000Z"), settings).toISOString(),
      "2026-01-07T20:00:00.000Z",
    );
  });

  test("uses half-open interval boundaries", () => {
    const settings = {
      daysOff: new Set<number>(),
      workingDayHours: 8,
      workingDayStart: 20,
      holidays: [],
    };
    assert.strictEqual(
      normalizeToWorkingTime(new Date("2026-01-05T19:59:59.999Z"), settings).toISOString(),
      "2026-01-05T20:00:00.000Z",
    );
    assert.strictEqual(
      normalizeToWorkingTime(new Date("2026-01-06T04:00:00.000Z"), settings).toISOString(),
      "2026-01-06T20:00:00.000Z",
    );
  });

  test("adds and subtracts working days across intervals", () => {
    const start = new Date("2026-01-05T09:00:00.000Z");
    assert.strictEqual(
      addWorkingDays(start, 1, WORKING_DAY_SETTINGS).toISOString(),
      "2026-01-05T17:00:00.000Z",
    );
    assert.strictEqual(
      addWorkingDays(start, 2, WORKING_DAY_SETTINGS).toISOString(),
      "2026-01-06T17:00:00.000Z",
    );

    const end = new Date("2026-01-09T17:00:00.000Z");
    assert.strictEqual(
      subtractWorkingDays(end, 1, WORKING_DAY_SETTINGS).toISOString(),
      "2026-01-09T09:00:00.000Z",
    );
  });

  test("measures elapsed working time across partial intervals", () => {
    const elapsed = diffInWorkingDays(
      new Date("2026-01-05T09:00:00.000Z"),
      new Date("2026-01-06T12:00:00.000Z"),
      WORKING_DAY_SETTINGS,
    );

    assert.strictEqual(elapsed, 1.375);
  });
});
