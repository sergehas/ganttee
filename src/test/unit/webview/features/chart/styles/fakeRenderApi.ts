import type { TimelineRectangle } from "@webview/features/chart/timelineGeometry";
import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from "echarts";

/** Axis-aligned pixel bounds. */
export interface Bounds {
  /** Smallest x. */
  readonly left: number;
  /** Smallest y. */
  readonly top: number;
  /** Largest x. */
  readonly right: number;
  /** Largest y. */
  readonly bottom: number;
}

/** Default grid: 400 px wide starting at x = 100, 10 rows of 20 px. */
export const GRID: TimelineRectangle = { x: 100, y: 0, width: 400, height: 200 };

/** Fake item color returned by `api.visual("color")`. */
export const ITEM_COLOR = "#123456";

/**
 * Creates a fake custom-series API with a linear coordinate mapping:
 * `x = GRID.x + value * 10` and `y = row * rowHeight + rowHeight / 2`.
 */
export function fakeApi(values: readonly number[], rowHeight = 20): CustomSeriesRenderItemAPI {
  return {
    value: (dimension: number) => values[dimension],
    coord: ([x, row]: number[]) => [GRID.x + x * 10, row * rowHeight + rowHeight / 2],
    size: () => [0, rowHeight],
    visual: () => ITEM_COLOR,
  } as unknown as CustomSeriesRenderItemAPI;
}

/** Creates fake custom-series parameters for the given grid and data index. */
export function fakeParams(
  grid: TimelineRectangle = GRID,
  dataIndex = 0,
): CustomSeriesRenderItemParams {
  return { coordSys: grid, dataIndex } as unknown as CustomSeriesRenderItemParams;
}

/** A rendered element as inspected by tests. */
export interface RenderedElement {
  /** ECharts element type. */
  readonly type: string;
  /** Element geometry. */
  readonly shape?: Record<string, unknown>;
  /** Element style. */
  readonly style?: Record<string, unknown>;
  /** Group children. */
  readonly children?: readonly RenderedElement[];
  /** Text x position. */
  readonly x?: number;
  /** Text y position. */
  readonly y?: number;
}

/** Narrows a render result to an inspectable element. */
export function asElement(item: CustomSeriesRenderItemReturn): RenderedElement {
  if (!item) {
    throw new Error("Expected a rendered element.");
  }
  return item as unknown as RenderedElement;
}

/** Computes the global bounds of a rendered element tree, including stroke-free geometry. */
export function boundingBox(item: CustomSeriesRenderItemReturn): Bounds {
  return boundsOf(asElement(item));
}

/** Returns every point of a polyline element. */
export function polylinePoints(item: CustomSeriesRenderItemReturn): number[][] {
  return asElement(item).shape?.points as number[][];
}

/** Classifies each segment of a route as horizontal, vertical, diagonal (45°), or other. */
export function segmentKinds(points: readonly (readonly number[])[]): string[] {
  return points.slice(1).map((point, index) => {
    const dx = Math.abs(point[0] - points[index][0]);
    const dy = Math.abs(point[1] - points[index][1]);
    if (dy === 0) {
      return "h";
    }
    if (dx === 0) {
      return "v";
    }
    return Math.abs(dx - dy) < 1e-9 ? "45" : "other";
  });
}

/** Computes the bounds of one element, recursing into paths and children. */
function boundsOf(element: RenderedElement): Bounds {
  const shape = element.shape ?? {};
  switch (element.type) {
    case "rect": {
      const { x, y, width, height } = shape as Record<string, number>;
      return { left: x, top: y, right: x + width, bottom: y + height };
    }
    case "circle": {
      const { cx, cy, r } = shape as Record<string, number>;
      return { left: cx - r, top: cy - r, right: cx + r, bottom: cy + r };
    }
    case "polygon":
    case "polyline":
      return union(
        (shape.points as number[][]).map(([x, y]) => ({ left: x, top: y, right: x, bottom: y })),
      );
    case "compoundPath":
      return union((shape.paths as RenderedElement[]).map(boundsOf));
    case "group":
      return union((element.children ?? []).map(boundsOf));
    case "text":
      return {
        left: element.x ?? 0,
        top: element.y ?? 0,
        right: element.x ?? 0,
        bottom: element.y ?? 0,
      };
    default:
      throw new Error(`Unsupported element type ${element.type}.`);
  }
}

/** Returns the smallest bounds containing every input. */
function union(bounds: readonly Bounds[]): Bounds {
  return {
    left: Math.min(...bounds.map((bound) => bound.left)),
    top: Math.min(...bounds.map((bound) => bound.top)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
  };
}
