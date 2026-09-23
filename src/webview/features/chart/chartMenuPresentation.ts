import { ProjectView, ZoomLevel } from "@common/documents";
import type {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import {
  toggleProjectViewLayer,
  withZoomLevel,
  ZOOM_LEVELS,
  zoomIn,
  zoomOut,
} from "@webview/features/chart/projectViewControls";
import { WebviewTranslator } from "@webview/l10n";

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
  readonly onSelect?: () => void;
  /** Nested actions shown by a grouped control. */
  readonly children?: readonly ChartMenuAction[];
}

/** Plain action groups used to render the chart menu bar. */
export interface ChartMenuPresentation {
  /** Independent chart-layer actions. */
  readonly layerActions: readonly ChartMenuAction[];
  /** Zoom and fit actions. */
  readonly zoomActions: readonly ChartMenuAction[];
  /** Supported values for the zoom select. */
  readonly zoomLevels: readonly ZoomLevel[];
  /** Export format and destination action. */
  readonly exportAction: ChartMenuAction;
}

/**
 * Builds localized chart menu presentation data without depending on React or the DOM.
 * @param view Current persisted chart view.
 * @param translate Localizes labels for controls and menus.
 * @param onViewChange Receives complete proposed view values.
 * @param onFitToWindow Requests a temporary viewport fit.
 * @param onExport Requests an image export destination.
 * @returns The actions and zoom options rendered by the chart menu.
 */
export function createChartMenuPresentation(
  view: ProjectView,
  translate: WebviewTranslator,
  onViewChange: (view: ProjectView) => void,
  onFitToWindow: () => void,
  onExport: (format: ChartExportFormat, destination: ChartExportDestination) => void,
): ChartMenuPresentation {
  const toggle = (
    layer: "showDependencies" | "showOffDays" | "showHolidays" | "showCriticalPath",
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
      createLayerAction("off-days", "off-days", translate("Show off-days"), view.showOffDays, () =>
        toggle("showOffDays"),
      ),
      createLayerAction("holidays", "calendar", translate("Show holidays"), view.showHolidays, () =>
        toggle("showHolidays"),
      ),
      createLayerAction(
        "critical-path",
        "warning-compact",
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
      createAction("fit", "screen-full", translate("Fit to window"), onFitToWindow),
    ],
    exportAction: createExportAction(translate, onExport),
    zoomLevels: ZOOM_LEVELS,
  };
}

/**
 * Creates the nested export format and destination actions.
 * @param translate Localizes format and destination labels.
 * @param onExport Receives selected format and destination pairs.
 * @returns A grouped export action.
 */
function createExportAction(
  translate: WebviewTranslator,
  onExport: (format: ChartExportFormat, destination: ChartExportDestination) => void,
): ChartMenuAction {
  const createFormatAction = (format: ChartExportFormat): ChartMenuAction => ({
    id: format,
    icon: format === "svg" ? "file-code" : "file-media",
    label: translate(format.toUpperCase()),
    children: [
      {
        id: `${format}-download`,
        icon: "download",
        label: translate("Download"),
        onSelect: () => onExport(format, "download"),
      },
      {
        id: `${format}-clipboard`,
        icon: "clippy",
        label: translate("Copy to clipboard"),
        onSelect: () => onExport(format, "clipboard"),
      },
    ],
  });

  return {
    id: "export",
    icon: "export",
    label: translate("Export to image"),
    children: [createFormatAction("svg"), createFormatAction("png")],
  };
}

/**
 * Creates a layer action with its active state.
 * @param id Stable action identifier.
 * @param icon Codicon name.
 * @param label Localized accessible label.
 * @param pressed Whether the layer is currently active.
 * @param onSelect Callback invoked on selection.
 * @returns A configured layer action.
 */
function createLayerAction(
  id: string,
  icon: string,
  label: string,
  pressed: boolean,
  onSelect: () => void,
): ChartMenuAction {
  return { id, icon, label, pressed, onSelect };
}

/**
 * Creates a momentary chart action.
 * @param id Stable action identifier.
 * @param icon Codicon name.
 * @param label Localized accessible label.
 * @param onSelect Callback invoked on selection.
 * @returns A configured leaf action.
 */
function createAction(
  id: string,
  icon: string,
  label: string,
  onSelect: () => void,
): ChartMenuAction {
  return { id, icon, label, onSelect };
}
