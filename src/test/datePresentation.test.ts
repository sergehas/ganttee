import * as assert from "assert";
import { formatShortDate } from "../common/datePresentation";

suite("datePresentation", () => {
  test("formats the UTC calendar date in the requested locale", () => {
    const date = new Date("2026-01-02T00:30:00.000Z");
    const expected = new Intl.DateTimeFormat("de", {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(date);

    assert.strictEqual(formatShortDate(date, "de"), expected);
  });

  test("falls back to the runtime locale for an invalid language tag", () => {
    const date = new Date("2026-01-02T00:30:00.000Z");
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(date);

    assert.strictEqual(formatShortDate(date, "not_a_locale"), expected);
  });
});
