import { DEFAULT_PROJECT_VIEW, ProjectTheme } from "@common/documents";
import { THEME_ASSETS } from "@webview/features/chart/themes/themeAssets.generated";
import type { EChartsOption } from "echarts";
import type { registerTheme } from "echarts/core" with { "resolution-mode": "import" };

/** ECharts theme data with the fields consumed by chart visual styles typed explicitly. */
export type ChartThemeData = Parameters<typeof registerTheme>[1] & {
  /** Palette colors used by the chart theme. */
  readonly palette?: readonly string[];
  /** Chart canvas background color. */
  readonly backgroundColor?: string;
  /** Default text styling. */
  readonly textStyle?: EChartsOption["textStyle"];
};

/** A bundled JSON asset from `media/themes`. */
export interface ThemeAsset {
  /** Asset file name. */
  readonly fileName: string;
  /** Parsed ECharts theme definition. */
  readonly data: ChartThemeData;
}

/** A selectable chart color theme. */
export interface ChartTheme {
  /** Persisted theme identifier. */
  readonly id: ProjectTheme;
  /** Source display label, localized by the caller. */
  readonly label: string;
  /** ECharts theme definition. */
  readonly data: ChartThemeData;
}

/** Registered chart themes keyed by identifier, in asset order. */
export type ChartThemeRegistry = ReadonlyMap<ProjectTheme, ChartTheme>;

/** File names that register a theme; the capture is the theme identifier. */
const THEME_FILE_NAME = /^(.+)-theme\.json$/;

/**
 * Registers every `*-theme.json` asset and ignores the others.
 * @param assets Bundled theme assets.
 * @returns The theme registry.
 * @throws {Error} When two assets resolve to the same identifier, ignoring case.
 */
export function createThemeRegistry(assets: readonly ThemeAsset[]): ChartThemeRegistry {
  const registry = new Map<ProjectTheme, ChartTheme>();
  const normalizedIds = new Set<string>();
  for (const asset of assets) {
    const id = THEME_FILE_NAME.exec(asset.fileName)?.[1];
    if (id === undefined) {
      continue;
    }
    if (normalizedIds.has(id.toLowerCase())) {
      throw new Error(`Duplicate chart theme identifier "${id}".`);
    }
    normalizedIds.add(id.toLowerCase());
    registry.set(id, { id, label: themeLabel(id), data: asset.data });
  }
  return registry;
}

/**
 * Derives a display label from a theme identifier: hyphens and underscores become spaces and
 * each word is title cased.
 * @param id Theme identifier.
 * @returns The display label.
 */
export function themeLabel(id: ProjectTheme): string {
  return id
    .split(/[-_]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Resolves a persisted theme identifier, falling back to the default theme when it is not
 * registered.
 * @param registry Theme registry.
 * @param id Persisted theme identifier.
 * @param warn Receives the fallback warning.
 * @returns The effective theme.
 * @throws {Error} When the default theme is not registered either.
 */
export function resolveChartTheme(
  registry: ChartThemeRegistry,
  id: ProjectTheme,
  warn: (message: string) => void = console.warn,
): ChartTheme {
  const theme = registry.get(id);
  if (theme !== undefined) {
    return theme;
  }
  const fallback = registry.get(DEFAULT_PROJECT_VIEW.theme);
  if (fallback === undefined) {
    throw new Error(`Default chart theme "${DEFAULT_PROJECT_VIEW.theme}" is not registered.`);
  }
  warn(`Chart theme "${id}" is not registered; using "${fallback.id}".`);
  return fallback;
}

/** Themes bundled with the extension. */
export const CHART_THEMES: ChartThemeRegistry = createThemeRegistry(THEME_ASSETS);
