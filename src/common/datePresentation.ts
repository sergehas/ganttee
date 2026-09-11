/**
 * Formats a UTC calendar date using the supplied display language.
 *
 * @param date The date to display.
 * @param locale The requested display language.
 * @returns A locale-aware, short UTC date.
 */
export function formatShortDate(date: Date, locale: string): string {
  try {
    return createDateFormatter(locale).format(date);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    return createDateFormatter().format(date);
  }
}

/** Creates the standard UTC date formatter for a requested display language. */
function createDateFormatter(locale?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeZone: "UTC",
  });
}
