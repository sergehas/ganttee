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

/** Rounded style: pill tasks, circle milestones, thin H-shaped groups, and round-joined links. */
export const roundedStyle: VisualStyle = {
  id: "rounded",

  /** Draws tasks as pill-ended bars. */
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

  /** Draws groups as parenthesized bands with a full-size hit target. */
  renderGroup: (params, api) => {
    const shape = clipBar(params, barPlacement(api));
    if (shape === undefined) {
      return undefined;
    }
    const stroke = shape.height / 4;
    const radius = stroke / 2;
    const arcRadius = shape.height / 2 - stroke / 2;
    const centerY = shape.y + shape.height / 2;
    const lineStyle = {
      fill: "none" as const,
      stroke: itemColor(api),
      lineWidth: stroke,
      lineCap: "round" as const,
    };
    return {
      type: "group",
      children: [
        {
          type: "rect" as const,
          shape: {
            x: shape.x,
            y: centerY - stroke / 2,
            width: shape.width,
            height: stroke,
            r: radius,
          },
          style: { fill: itemColor(api) },
        },
        {
          type: "arc" as const,
          shape: {
            cx: shape.x + shape.height / 2,
            cy: centerY,
            r: arcRadius,
            startAngle: Math.PI / 2,
            endAngle: (3 * Math.PI) / 2,
            clockwise: true,
          },
          style: lineStyle,
        },
        {
          type: "arc" as const,
          shape: {
            cx: shape.x + shape.width - shape.height / 2,
            cy: centerY,
            r: arcRadius,
            startAngle: -Math.PI / 2,
            endAngle: Math.PI / 2,
            clockwise: true,
          },
          style: lineStyle,
        },
        createTransparentHitTarget(shape),
      ],
    };
  },

  /** Draws milestones as filled circles. */
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

  /** Draws dependencies as rounded, right-angle routes. */
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
