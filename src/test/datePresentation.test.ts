import * as assert from "assert";
import { formatShortDate } from "../common/datePresentation";

suite("datePresentation", () => {
  test("formats the UTC calendar date in the requested locale", () => {
    const date = new Date("2026-01-02T00:30:00.000Z");
    const expected = new Intl.DateTimeFormat("de", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(date);

    assert.strictEqual(formatShortDate(date, "de"), expected);
  });

  test("falls back to the runtime locale for a RangeError from Intl", () => {
    const date = new Date("2026-01-02T00:30:00.000Z");
    const originalDateTimeFormat = Intl.DateTimeFormat;
    const expected = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(date);

    function DateTimeFormatStub(
      this: unknown,
      locale?: string | string[],
    ): Intl.DateTimeFormat {
      if (locale === "bad_locale") {
        throw new RangeError("Invalid language tag");
      }
      return new originalDateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
      });
    }

    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      writable: true,
      value: DateTimeFormatStub as typeof Intl.DateTimeFormat,
    });

    try {
      assert.strictEqual(formatShortDate(date, "bad_locale"), expected);
    } finally {
      Object.defineProperty(Intl, "DateTimeFormat", {
        configurable: true,
        writable: true,
        value: originalDateTimeFormat,
      });
    }
  });

  test("rethrows non-RangeError formatter failures", () => {
    const date = new Date("2026-01-02T00:30:00.000Z");
    const originalDateTimeFormat = Intl.DateTimeFormat;

    function DateTimeFormatFailureStub(
      this: unknown,
      locale?: string | string[],
    ): Intl.DateTimeFormat {
      if (locale === "boom") {
        throw new TypeError("Unexpected formatter failure");
      }
      return new originalDateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
      });
    }

    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      writable: true,
      value: DateTimeFormatFailureStub as typeof Intl.DateTimeFormat,
    });

    try {
      assert.throws(() => formatShortDate(date, "boom"), TypeError);
    } finally {
      Object.defineProperty(Intl, "DateTimeFormat", {
        configurable: true,
        writable: true,
        value: originalDateTimeFormat,
      });
    }
  });
});
