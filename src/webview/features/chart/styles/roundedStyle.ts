import {
  barPlacement,
  clipBar,
  dependencyEndpoints,
  itemColor,
  milestonePlacement,
  orthogonalRoute,
} from "@webview/features/chart/styles/styleGeometry";
import type { VisualStyle } from "@webview/features/chart/styles/visualStyle";

/** Rounded style: pill tasks, circle milestones, thin H-shaped groups, and round-joined links. */
export const roundedStyle: VisualStyle = {
  id: "rounded",

  renderTask: (params, api) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    return {
      type: "rect",
      shape: { ...shape, r: shape.height / 2 },
      style: { fill: itemColor(api) },
    };
  },

  renderGroup: (params, api) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    const stroke = shape.height / 4;
    const radius = stroke / 2;
    return {
      type: "compoundPath",
      shape: {
        paths: [
          {
            type: "rect",
            shape: {
              x: shape.x,
              y: shape.y + (shape.height - stroke) / 2,
              width: shape.width,
              height: stroke,
              r: radius,
            },
          },
          {
            type: "rect",
            shape: { x: shape.x, y: shape.y, width: stroke, height: shape.height, r: radius },
          },
          {
            type: "rect",
            shape: {
              x: shape.x + shape.width - stroke,
              y: shape.y,
              width: stroke,
              height: shape.height,
              r: radius,
            },
          },
        ],
      },
      style: { fill: itemColor(api) },
    };
  },

  renderMilestone: (params, api) => {
    const placement = milestonePlacement(params, api);
    if (placement === undefined) {
      return undefined;
    }
    const [cx, cy] = placement.center;
    return {
      type: "circle",
      shape: { cx, cy, r: placement.height / 2 },
      style: { fill: itemColor(api) },
    };
  },

  renderDependency: (_params, api) => {
    const { from, to } = dependencyEndpoints(api);
    return {
      type: "polyline",
      shape: { points: orthogonalRoute(from, to) },
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
