import type { GroupPresentation } from "@common/presentation/project/projectItemPresentation";

/** Zero-based palette index of the first color reserved for metro groups. */
const FIRST_GROUP_COLOR_INDEX = 7;

/**
 * Assigns available metro palette colors to groups in project order, cycling as needed.
 * @param groups Groups in project order.
 * @param palette ECharts theme palette.
 * @returns Group IDs mapped to their assigned metro colors.
 */
export function buildMetroGroupColorMap(
  groups: readonly GroupPresentation[],
  palette: readonly string[] | undefined,
): ReadonlyMap<string, string> {
  const groupPalette = palette?.slice(FIRST_GROUP_COLOR_INDEX) ?? [];
  if (groupPalette.length === 0) {
    return new Map();
  }
  return new Map(
    groups.map((group, index) => [group.id, groupPalette[index % groupPalette.length]]),
  );
}

/**
 * Resolves a metro entity color in critical-path, group, status, then palette order.
 * @param criticalPathColor Critical-path color, when enabled for the entity.
 * @param groupColor Color inherited from the owning group.
 * @param statusColor Color assigned by the entity's status.
 * @param fallbackColor ECharts series palette fallback.
 * @returns The highest-priority available color.
 */
export function resolveMetroItemColor(
  criticalPathColor: string | undefined,
  groupColor: string | undefined,
  statusColor: string | undefined,
  fallbackColor: string | undefined,
): string | undefined {
  return criticalPathColor ?? groupColor ?? statusColor ?? fallbackColor;
}
