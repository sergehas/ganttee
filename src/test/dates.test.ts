import * as assert from "assert";
import { diffIsoDates } from "../common/dates";

/** ISO dates spanning a daylight-saving transition in either hemisphere. */
const DST_SPANS: readonly { start: string; end: string; label: string }[] = [
  { start: "2026-03-07", end: "2026-03-09", label: "US spring forward" },
  { start: "2026-11-01", end: "2026-11-02", label: "US fall back" },
  { start: "2026-03-28", end: "2026-03-30", label: "EU spring forward" },
  { start: "2026-10-24", end: "2026-10-26", label: "EU fall back" },
  { start: "2026-10-03", end: "2026-10-05", label: "AU spring forward" },
  { start: "2026-04-04", end: "2026-04-06", label: "AU fall back" },
];

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
});
