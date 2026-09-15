/** Timeline coordinate for one calendar-area boundary. */
export interface CalendarAreaBoundary {
  /** Timeline coordinate for this boundary. */
  readonly xAxis: number;
  /** Optional fill applied to the complete area. */
  readonly itemStyle?: { readonly color: string };
}

/** Calendar area represented as inclusive start and end boundaries. */
export type CalendarArea = [CalendarAreaBoundary, CalendarAreaBoundary];

/** Timestamp and placeholder row coordinate used by the custom series. */
export interface TimelineTickData {
  /** Timestamp and placeholder row coordinate. */
  readonly value: readonly [number, number];
}
