import type { ProjectStyle } from "@common/documents";
import { classicStyle } from "@webview/features/chart/styles/classicStyle";
import { metroStyle } from "@webview/features/chart/styles/metroStyle";
import { roundedStyle } from "@webview/features/chart/styles/roundedStyle";
import type { VisualStyle } from "@webview/features/chart/styles/visualStyle";

/** Every supported visual style, keyed by its persisted identifier. */
export const VISUAL_STYLES: Readonly<Record<ProjectStyle, VisualStyle>> = {
  classic: classicStyle,
  rounded: roundedStyle,
  metro: metroStyle,
};
