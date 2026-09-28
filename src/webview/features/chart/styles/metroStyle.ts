import {
  barPlacement,
  ChartPoint,
  clipBar,
  dependencyEndpoints,
  itemColor,
  itemHeight,
  milestonePlacement,
  orthogonalRoute,
} from "@webview/features/chart/styles/styleGeometry";
import type { VisualStyle } from "@webview/features/chart/styles/visualStyle";
import type { CustomSeriesRenderItemReturn } from "echarts";

/** Fill of metro station markers. */
const STATION_FILL = "#ffffff";

/** Horizontal gaps below this many pixels are treated as a vertical link. */
const VERTICAL_TOLERANCE = 0.5;

/** Cubic Bézier handle length as a fraction of the corner cutback. */
const BEND_HANDLE_RATIO = 0.55228475;

/**
 * Metro-map style: thin route tasks with stations on both ends, station milestones,
 * interchange groups, and links with horizontal end segments.
 */
export const metroStyle: VisualStyle = {
  id: "metro",

  renderTask: (params, api) => {
    const bar = barPlacement(api);
    const overhang = bar.height / 2;
    if (clipBar(params, bar, bar.height, overhang) === undefined) {
      return undefined;
    }
    const color = itemColor(api);
    // const fill = theme.backgroundColor ?? STATION_FILL;
    const track = clipBar(params, bar, bar.height / 3);
    return {
      type: "group",
      children: [
        ...(track === undefined
          ? []
          : [{ type: "rect" as const, shape: track, style: { fill: color } }]),
        station([bar.x, bar.centerY], bar.height, color, color),
        station([bar.x + bar.width, bar.centerY], bar.height, color, color),
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
    const bendSize = itemHeight(api) / 2;
    const lineWidth = itemHeight(api) / 3;
    return renderRoundedRoute(metroRoute(from, to, bendSize), itemColor(api), lineWidth, bendSize);
  },
};

/**
 * Renders straight route portions joined by cubic Bézier bends.
 * @param points Route vertices.
 * @param color Route stroke color.
 * @param lineWidth Route stroke width.
 * @param bendSize Maximum distance cut back at a corner.
 * @returns A group of line and Bézier elements.
 */
function renderRoundedRoute(
  points: readonly ChartPoint[],
  color: string,
  lineWidth: number,
  bendSize: number,
): CustomSeriesRenderItemReturn {
  const style = {
    stroke: color,
    lineWidth,
    lineJoin: "round" as const,
    lineCap: "round" as const,
    fill: "none" as const,
  };
  const children = [];
  let cursor = points[0];

  for (let index = 1; index < points.length - 1; index++) {
    const bend = roundedCorner(points[index - 1], points[index], points[index + 1], bendSize);
    if (bend === undefined) {
      continue;
    }
    if (distance(cursor, bend.start) > VERTICAL_TOLERANCE) {
      children.push(lineElement(cursor, bend.start, style));
    }
    children.push({
      type: "bezierCurve" as const,
      shape: {
        x1: bend.start[0],
        y1: bend.start[1],
        cpx1: bend.controlStart[0],
        cpy1: bend.controlStart[1],
        cpx2: bend.controlEnd[0],
        cpy2: bend.controlEnd[1],
        x2: bend.end[0],
        y2: bend.end[1],
      },
      style,
    });
    cursor = bend.end;
  }

  const end = points[points.length - 1];
  if (distance(cursor, end) > VERTICAL_TOLERANCE) {
    children.push(lineElement(cursor, end, style));
  }
  return { type: "group", children };
}

/**
 * Calculates the tangent points and control points for one rounded route corner.
 * @param previous Vertex before the corner.
 * @param corner Route corner.
 * @param next Vertex after the corner.
 * @param maximumCutback Maximum distance to trim either adjoining segment.
 * @returns Cubic bend geometry, or `undefined` for a straight or degenerate join.
 */
function roundedCorner(
  previous: ChartPoint,
  corner: ChartPoint,
  next: ChartPoint,
  maximumCutback: number,
): RouteBend | undefined {
  const incomingLength = distance(previous, corner);
  const outgoingLength = distance(corner, next);
  if (incomingLength === 0 || outgoingLength === 0) {
    return undefined;
  }

  const incoming: ChartPoint = [
    (corner[0] - previous[0]) / incomingLength,
    (corner[1] - previous[1]) / incomingLength,
  ];
  const outgoing: ChartPoint = [
    (next[0] - corner[0]) / outgoingLength,
    (next[1] - corner[1]) / outgoingLength,
  ];
  if (Math.abs(incoming[0] * outgoing[1] - incoming[1] * outgoing[0]) < 1e-9) {
    return undefined;
  }

  const cutback = Math.min(maximumCutback, incomingLength * 0.45, outgoingLength * 0.45);
  const handle = cutback * BEND_HANDLE_RATIO;
  const start: ChartPoint = [corner[0] - incoming[0] * cutback, corner[1] - incoming[1] * cutback];
  const end: ChartPoint = [corner[0] + outgoing[0] * cutback, corner[1] + outgoing[1] * cutback];
  return {
    start,
    controlStart: [start[0] + incoming[0] * handle, start[1] + incoming[1] * handle],
    controlEnd: [end[0] - outgoing[0] * handle, end[1] - outgoing[1] * handle],
    end,
  };
}

/** Builds one straight route element. */
function lineElement(from: ChartPoint, to: ChartPoint, style: Record<string, string | number>) {
  return {
    type: "line" as const,
    shape: { x1: from[0], y1: from[1], x2: to[0], y2: to[1] },
    style,
  };
}

/** Returns the Euclidean distance between two chart points. */
function distance(from: ChartPoint, to: ChartPoint): number {
  return Math.hypot(to[0] - from[0], to[1] - from[1]);
}

/** Geometry of a cubic Bézier bend through one route corner. */
interface RouteBend {
  /** Curve start on the incoming segment. */
  readonly start: ChartPoint;
  /** First curve control point. */
  readonly controlStart: ChartPoint;
  /** Second curve control point. */
  readonly controlEnd: ChartPoint;
  /** Curve end on the outgoing segment. */
  readonly end: ChartPoint;
}

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
  return Math.max(height / 8, 1.5);
}

/**
 * Builds a route with horizontal first and last thirds and one oblique middle segment.
 * Backward links fall back to a right-angle route.
 * @param from Source point.
 * @param to Target point.
 * @param bendSize Maximum distance cut back at a corner.
 * @returns The route points.
 */
export function metroRoute(from: ChartPoint, to: ChartPoint, bendSize: number): ChartPoint[] {
  const dx = to[0] - from[0];
  if (Math.abs(dx) < VERTICAL_TOLERANCE) {
    return [
      [from[0], from[1]],
      [from[0], to[1]],
    ];
  }
  if (dx < 0) {
    return orthogonalRoute(from, to).map(([x, y]): ChartPoint => [x, y]);
  }
  const third = dx / 3;
  if (dx < 8 * bendSize) {
    return [
      [from[0], from[1]],
      [from[0] + third, from[1]],
      [to[0], to[1]],
    ];
  }
  return [
    [from[0], from[1]],
    [from[0] + third, from[1]],
    [to[0] - third, to[1]],
    [to[0], to[1]],
  ];
}
