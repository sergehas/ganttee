import {
  PROJECT_STYLES,
  ProjectStyle,
  ProjectTheme,
  ProjectView,
  ZOOM_LEVELS,
  ZoomLevel,
} from "@common/documents";
import type { IconActionPresentation } from "@webview/components/IconAction.types";
import type {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import {
  toggleViewFlag,
  withViewField,
  zoomIn,
  zoomOut,
} from "@webview/features/chart/projectViewControls";
import type { ChartThemeRegistry } from "@webview/features/chart/themes/chartThemes";
import { WebviewTranslator } from "@webview/l10n";

/** One localized choice of a view select. */
export interface SelectOptionPresentation<T extends string> {
  /** Persisted value. */
  readonly value: T;
  /** Localized label. */
  readonly label: string;
}

/** Current state shown by the chart menu. */
export interface ChartMenuState {
  /** Current persisted chart view. */
  readonly view: ProjectView;
  /** Whether the session legend is visible. */
  readonly legendVisible: boolean;
  /** Whether the session colored-style mode is enabled. */
  readonly coloredStyleEnabled: boolean;
  /** Selectable color themes. */
  readonly themes: ChartThemeRegistry;
}

/** Callbacks invoked by chart menu actions. */
export interface ChartMenuHandlers {
  /** Receives complete proposed view values. */
  readonly onViewChange: (view: ProjectView) => void;
  /** Requests a temporary viewport fit. */
  readonly onFitToWindow: () => void;
  /** Requests an image export destination. */
  readonly onExport: (format: ChartExportFormat, destination: ChartExportDestination) => void;
  /** Toggles the session legend visibility. */
  readonly onToggleLegend: () => void;
  /** Toggles the session colored-style mode. */
  readonly onToggleColoredStyle: () => void;
}

/** Plain action groups used to render the chart menu bar. */
export interface ChartMenuPresentation {
  /** Independent on/off display actions. */
  readonly toggleActions: readonly IconActionPresentation[];
  /** Zoom and fit actions. */
  readonly zoomActions: readonly IconActionPresentation[];
  /** Choices of the zoom select. */
  readonly zoomOptions: readonly SelectOptionPresentation<ZoomLevel>[];
  /** Choices of the visual-style select. */
  readonly styleOptions: readonly SelectOptionPresentation<ProjectStyle>[];
  /** Choices of the color-theme select. */
  readonly themeOptions: readonly SelectOptionPresentation<ProjectTheme>[];
  /** Export format and destination action. */
  readonly exportAction: IconActionPresentation;
}

/**
 * Builds localized chart menu presentation data without depending on React or the DOM.
 * @param state Current view, legend visibility, and themes.
 * @param translate Localizes labels for controls and menus.
 * @param handlers Callbacks invoked by the actions.
 * @returns The actions and select options rendered by the chart menu.
 */
export function createChartMenuPresentation(
  state: ChartMenuState,
  translate: WebviewTranslator,
  handlers: ChartMenuHandlers,
): ChartMenuPresentation {
  const { view, legendVisible, coloredStyleEnabled, themes } = state;
  const { onViewChange } = handlers;
  const capitalized = (value: string) => translate(value[0].toUpperCase() + value.slice(1));

  return {
    toggleActions: [
      createToggleAction(
        "critical-path",
        "warning-compact",
        translate("Show critical path"),
        view.showCriticalPath,
        () => onViewChange(toggleViewFlag(view, "showCriticalPath")),
      ),
      createToggleAction(
        "item-labels",
        "tag",
        translate("Show labels on items"),
        view.showItemLabels,
        () => onViewChange(toggleViewFlag(view, "showItemLabels")),
      ),
      createToggleAction(
        "legend",
        "list-unordered",
        translate("Show legend"),
        legendVisible,
        handlers.onToggleLegend,
      ),
      createToggleAction(
        "colored-style",
        "symbol-color",
        translate("Colored style"),
        coloredStyleEnabled,
        handlers.onToggleColoredStyle,
      ),
    ],
    zoomActions: [
      createAction("zoom-in", "zoom-in", translate("Zoom in"), () =>
        onViewChange(withViewField(view, "zoomLevel", zoomIn(view.zoomLevel))),
      ),
      createAction("zoom-out", "zoom-out", translate("Zoom out"), () =>
        onViewChange(withViewField(view, "zoomLevel", zoomOut(view.zoomLevel))),
      ),
      createAction("fit", "screen-full", translate("Fit to window"), handlers.onFitToWindow),
    ],
    zoomOptions: ZOOM_LEVELS.map((value) => ({ value, label: capitalized(value) })),
    styleOptions: PROJECT_STYLES.map((value) => ({ value, label: capitalized(value) })),
    themeOptions: [...themes.values()].map((theme) => ({
      value: theme.id,
      label: translate(theme.label),
    })),
    exportAction: createExportAction(translate, handlers.onExport),
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
): IconActionPresentation {
  const createFormatAction = (format: ChartExportFormat): IconActionPresentation => ({
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
    onSelect: () => onExport("svg", "download"),
    children: [createFormatAction("svg"), createFormatAction("png")],
  };
}

/**
 * Creates an on/off action with its active state.
 * @param id Stable action identifier.
 * @param icon Codicon name.
 * @param label Localized accessible label.
 * @param pressed Whether the option is currently on.
 * @param onSelect Callback invoked on selection.
 * @returns A configured toggle action.
 */
function createToggleAction(
  id: string,
  icon: string,
  label: string,
  pressed: boolean,
  onSelect: () => void,
): IconActionPresentation {
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
): IconActionPresentation {
  return { id, icon, label, onSelect };
}
