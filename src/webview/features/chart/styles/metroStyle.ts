import {
  barPlacement,
  ChartPoint,
  clipBar,
  dependencyEndpoints,
  itemColor,
  milestonePlacement,
  orthogonalRoute,
} from "@webview/features/chart/styles/styleGeometry";
import type { VisualStyle } from "@webview/features/chart/styles/visualStyle";

/** Fill of metro station markers. */
const STATION_FILL = "#ffffff";

/** Horizontal gaps below this many pixels are treated as a vertical link. */
const VERTICAL_TOLERANCE = 0.5;

/**
 * Metro-map style: thin route tasks with stations on both ends, station milestones,
 * interchange groups, and 45° route links.
 */
export const metroStyle: VisualStyle = {
  id: "metro",

  renderTask: (params, api, theme) => {
    const bar = barPlacement(api);
    const overhang = bar.height / 2;
    if (clipBar(params, bar, bar.height, overhang) === undefined) {
      return undefined;
    }
    const color = itemColor(api);
    const fill = theme.backgroundColor ?? STATION_FILL;
    const track = clipBar(params, bar, bar.height / 3);
    return {
      type: "group",
      children: [
        ...(track === undefined
          ? []
          : [{ type: "rect" as const, shape: track, style: { fill: color } }]),
        station([bar.x, bar.centerY], bar.height, color, fill),
        station([bar.x + bar.width, bar.centerY], bar.height, color, fill),
      ],
    };
  },

  renderGroup: (params, api, theme) => {
    const bar = barPlacement(api);
    const shape = clipBar(params, bar, bar.height, bar.height / 2);
    if (shape === undefined) {
      return undefined;
    }
    const lineWidth = stationLineWidth(bar.height);
    return {
      type: "rect",
      shape: {
        x: shape.x + lineWidth / 2,
        y: shape.y + lineWidth / 2,
        width: Math.max(shape.width - lineWidth, 0),
        height: shape.height - lineWidth,
        r: (shape.height - lineWidth) / 2,
      },
      style: {
        fill: theme.backgroundColor ?? STATION_FILL,
        stroke: itemColor(api),
        lineWidth,
      },
    };
  },

  renderMilestone: (params, api, theme) => {
    const placement = milestonePlacement(params, api);
    if (placement === undefined) {
      return undefined;
    }
    return station(
      placement.center,
      placement.height,
      itemColor(api),
      theme.backgroundColor ?? STATION_FILL,
    );
  },

  renderDependency: (_params, api) => {
    const { from, to } = dependencyEndpoints(api);
    return {
      type: "polyline",
      shape: { points: metroRoute(from, to) },
      style: {
        stroke: itemColor(api),
        lineWidth: 3,
        lineJoin: "round",
        lineCap: "round",
        fill: "none",
      },
    };
  },
};

/**
 * Builds a station marker whose outer edge spans the item height.
 * @param center Station center.
 * @param height Item height.
 * @param color Ring color.
 * @returns A ringed circle element.
 */
function station(center: ChartPoint, height: number, color: string, fill: string) {
  const lineWidth = stationLineWidth(height);
  return {
    type: "circle" as const,
    shape: { cx: center[0], cy: center[1], r: (height - lineWidth) / 2 },
    style: { fill, stroke: color, lineWidth },
  };
}

/**
 * Returns the ring width used by stations and interchanges.
 * @param height Item height.
 * @returns The stroke width in pixels.
 */
function stationLineWidth(height: number): number {
  return Math.max(height / 6, 1.5);
}

/**
 * Builds a metro route made of horizontal, vertical, and 45° segments.
 * Backward links fall back to a right-angle route.
 * @param from Source point.
 * @param to Target point.
 * @returns The route points.
 */
export function metroRoute(from: ChartPoint, to: ChartPoint): number[][] {
  const dx = to[0] - from[0];
  const dy = Math.abs(to[1] - from[1]);
  const direction = Math.sign(to[1] - from[1]);
  if (Math.abs(dx) < VERTICAL_TOLERANCE) {
    return [
      [from[0], from[1]],
      [from[0], to[1]],
    ];
  }
  if (dx < 0) {
    return orthogonalRoute(from, to);
  }
  if (dx < dy) {
    return [
      [from[0], from[1]],
      [to[0], from[1] + direction * dx],
      [to[0], to[1]],
    ];
  }
  const run = (dx - dy) / 2;
  return [
    [from[0], from[1]],
    [from[0] + run, from[1]],
    [to[0] - run, to[1]],
    [to[0], to[1]],
  ];
}
