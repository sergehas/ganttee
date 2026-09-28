import {
  barPlacement,
  clipBar,
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

  renderTask: (params, api) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    return { type: "rect", shape: { ...shape, r: CORNER_RADIUS }, style: { fill: itemColor(api) } };
  },

  renderGroup: (params, api) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    const quarter = shape.height / 4;
    const segment = (x: number, width: number, height: number) => ({
      type: "rect",
      shape: { x, y: shape.y, width, height, r: CORNER_RADIUS },
    });
    return {
      type: "compoundPath",
      shape: {
        paths: [
          segment(shape.x, shape.width, quarter),
          segment(shape.x, quarter, shape.height),
          segment(shape.x + shape.width - quarter, quarter, shape.height),
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
    };
  },

  renderDependency: (_params, api) => {
    const { from, to } = dependencyEndpoints(api);
    return {
      type: "polyline",
      shape: { points: orthogonalRoute(from, to) },
      style: { stroke: itemColor(api), lineWidth: 2, fill: "none" },
    };
  },
};
