import {
  barPlacement,
  clipBar,
  createTransparentHitTarget,
  dependencyEndpoints,
  itemColor,
  milestonePlacement,
  orthogonalRoute,
} from "@webview/features/chart/styles/styleGeometry";
import type { VisualStyle } from "@webview/features/chart/styles/visualStyle";

/** Corner radius of classic bars. */
const CORNER_RADIUS = 3;

/** Default style: rounded-corner bars, bracket groups, diamond milestones, and right-angle links. */
export const classicStyle: VisualStyle = {
  id: "classic",

  /** Draws tasks as filled bars with small rounded corners. */
  renderTask: (params, api) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    return {
      type: "rect",
      shape: { ...shape, r: CORNER_RADIUS },
      style: { fill: itemColor(api) },
      transition: ["shape"],
    };
  },

  /** Draws groups as brackets with a transparent full-size hit target. */
  renderGroup: (params, api, _theme, context) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    const quarter = shape.height / 4;
    if (context.collapsed) {
      const yTop = shape.y + quarter / 2;
      const yBottom = shape.y + shape.height - quarter / 2;
      const lineStyle = {
        stroke: itemColor(api),
        lineWidth: quarter,
        lineDash: "dashed" as const,
        lineCap: "round" as const,
      };
      return {
        type: "group",
        children: [
          {
            type: "line" as const,
            shape: {
              x1: shape.x + quarter / 2,
              y1: yTop,
              x2: shape.x + shape.width - quarter / 2,
              y2: yTop,
            },
            style: lineStyle,
            transition: ["shape"],
          },
          {
            type: "line" as const,
            shape: { x1: shape.x + quarter / 2, y1: yTop, x2: shape.x + quarter / 2, y2: yBottom },
            style: lineStyle,
            transition: ["shape"],
          },
          {
            type: "line" as const,
            shape: {
              x1: shape.x + shape.width - quarter / 2,
              y1: yTop,
              x2: shape.x + shape.width - quarter / 2,
              y2: yBottom,
            },
            style: lineStyle,
            transition: ["shape"],
          },
          createTransparentHitTarget(shape),
        ],
      };
    }
    const segment = (x: number, width: number, height: number) => ({
      type: "rect",
      shape: { x, y: shape.y, width, height, r: CORNER_RADIUS },
    });
    return {
      type: "group",
      children: [
        {
          type: "compoundPath" as const,
          shape: {
            paths: [
              segment(shape.x, shape.width, quarter),
              segment(shape.x, quarter, shape.height),
              segment(shape.x + shape.width - quarter, quarter, shape.height),
            ],
          },
          style: { fill: itemColor(api) },
          transition: ["shape"],
        },
        createTransparentHitTarget(shape),
      ],
    };
  },

  /** Draws milestones as filled diamonds. */
  renderMilestone: (params, api) => {
    const placement = milestonePlacement(params, api);
    if (placement === undefined) {
      return undefined;
    }
    const [x, y] = placement.center;
    const size = placement.height / 2;
    return {
      type: "polygon",
      shape: {
        points: [
          [x, y - size],
          [x + size, y],
          [x, y + size],
          [x - size, y],
        ],
      },
      style: { fill: itemColor(api) },
      transition: ["shape"],
    };
  },

  /** Draws dependencies as orthogonal polylines. */
  renderDependency: (_params, api) => {
    const { from, to } = dependencyEndpoints(api);
    return {
      type: "polyline",
      shape: { points: orthogonalRoute(from, to) },
      style: { stroke: itemColor(api), lineWidth: 2, fill: "none" },
      transition: ["shape"],
    };
  },
};
