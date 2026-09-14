import { ProjectView, ZoomLevel } from "../common/documents";
import { WebviewTranslator } from "./l10n";
import {
  toggleProjectViewLayer,
  withZoomLevel,
  ZOOM_LEVELS,
  zoomIn,
  zoomOut,
} from "./projectViewControls";

/** Plain icon action data consumed by the chart menu component. */
export interface ChartMenuAction {
  /** Stable action identifier. */
  readonly id: string;
  /** Codicon name without the `codicon-` prefix. */
  readonly icon: string;
  /** Localized accessible and tooltip label. */
  readonly label: string;
  /** Whether the action represents an enabled layer. */
  readonly pressed?: boolean;
  /** Runs when the action is selected. */
  readonly onSelect: () => void;
}

/** Plain action groups used to render the chart menu bar. */
export interface ChartMenuModel {
  /** Independent chart-layer actions. */
  readonly layerActions: readonly ChartMenuAction[];
  /** Zoom and fit actions. */
  readonly zoomActions: readonly ChartMenuAction[];
  /** Supported values for the zoom select. */
  readonly zoomLevels: readonly ZoomLevel[];
}

/** Builds the localized chart menu model without depending on React or the DOM. */
export function createChartMenuModel(
  view: ProjectView,
  translate: WebviewTranslator,
  onViewChange: (view: ProjectView) => void,
  onFitToWindow: () => void,
): ChartMenuModel {
  const toggle = (
    layer:
      "showDependencies" | "showOffDays" | "showHolidays" | "showCriticalPath",
  ) => onViewChange(toggleProjectViewLayer(view, layer));

  return {
    layerActions: [
      createLayerAction(
        "dependencies",
        "git-compare",
        translate("Show dependencies"),
        view.showDependencies,
        () => toggle("showDependencies"),
      ),
      createLayerAction(
        "off-days",
        "calendar",
        translate("Show off-days"),
        view.showOffDays,
        () => toggle("showOffDays"),
      ),
      createLayerAction(
        "holidays",
        "calendar-add",
        translate("Show holidays"),
        view.showHolidays,
        () => toggle("showHolidays"),
      ),
      createLayerAction(
        "critical-path",
        "pulse",
        translate("Show critical path"),
        view.showCriticalPath,
        () => toggle("showCriticalPath"),
      ),
    ],
    zoomActions: [
      createAction("zoom-in", "zoom-in", translate("Zoom in"), () =>
        onViewChange(withZoomLevel(view, zoomIn(view.zoomLevel))),
      ),
      createAction("zoom-out", "zoom-out", translate("Zoom out"), () =>
        onViewChange(withZoomLevel(view, zoomOut(view.zoomLevel))),
      ),
      createAction(
        "fit",
        "screen-full",
        translate("Fit to window"),
        onFitToWindow,
      ),
    ],
    zoomLevels: ZOOM_LEVELS,
  };
}

/** Creates a layer action with its active state. */
function createLayerAction(
  id: string,
  icon: string,
  label: string,
  pressed: boolean,
  onSelect: () => void,
): ChartMenuAction {
  return { id, icon, label, pressed, onSelect };
}

/** Creates a momentary chart action. */
function createAction(
  id: string,
  icon: string,
  label: string,
  onSelect: () => void,
): ChartMenuAction {
  return { id, icon, label, onSelect };
}
