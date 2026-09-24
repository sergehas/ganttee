/** Supported image formats produced by ECharts. */
export type ChartExportFormat = "svg" | "png";

/** Destinations supported by the webview export menu. */
export type ChartExportDestination = "download" | "clipboard";

/** Localized names used when a chart image is downloaded. */
export interface ChartExportFilenames {
  /** Suggested filename for an SVG export. */
  readonly svg: string;
  /** Suggested filename for a PNG export. */
  readonly png: string;
}
