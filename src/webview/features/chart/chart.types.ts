/** Timeline span and fill for one calendar shading band. */
export interface CalendarAreaData {
  /** Start and end timeline coordinates of the band. */
  readonly value: readonly [number, number];
  /** Fill applied to the band. */
  readonly itemStyle?: { readonly color: string };
}

/** Timestamp and placeholder row coordinate used by the custom series. */
export interface TimelineTickData {
  /** Timestamp and placeholder row coordinate. */
  readonly value: readonly [number, number];
}
