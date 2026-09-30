import { ProjectView } from "@common/documents";
import { IconAction, IconActionMenu } from "@webview/components/IconAction";
import { Select } from "@webview/components/Select";
import {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import {
  createChartMenuPresentation,
  SelectOptionPresentation,
} from "@webview/features/chart/chartMenuPresentation";
import "@webview/features/chart/components/ChartMenuBar.scss";
import { withViewField } from "@webview/features/chart/projectViewControls";
import type { ChartThemeRegistry } from "@webview/features/chart/themes/chartThemes";
import { useTranslate } from "@webview/l10n";

interface ChartMenuBarProps {
  /** Current persisted chart preferences. */
  readonly view: ProjectView;
  /** Whether the session legend is visible. */
  readonly legendVisible: boolean;
  /** Whether the session colored-style mode is enabled. */
  readonly coloredStyleEnabled: boolean;
  /** Selectable color themes. */
  readonly themes: ChartThemeRegistry;
  /** Effective color theme, which may differ from an unregistered persisted theme. */
  readonly themeId: string;
  /** Emits a complete proposed persisted view. */
  readonly onViewChange: (view: ProjectView) => void;
  /** Toggles the session legend visibility. */
  readonly onToggleLegend: () => void;
  /** Toggles the session colored-style mode. */
  readonly onToggleColoredStyle: () => void;
  /** Fits the visible chart without changing persisted preferences. */
  readonly onFitToWindow: () => void;
  /** Exports the currently rendered chart image. */
  readonly onExport: (format: ChartExportFormat, destination: ChartExportDestination) => void;
  /** Opens Settings for the current project document. */
  readonly onOpenSettings: () => void;
}

/** View fields edited through a select. */
type SelectViewField = "zoomLevel" | "style" | "theme";

interface ViewSelectProps<K extends SelectViewField> {
  /** Edited view field. */
  readonly field: K;
  /** Selected value. */
  readonly value: ProjectView[K];
  /** Localized accessible label. */
  readonly label: string;
  /** Selectable values. */
  readonly options: readonly SelectOptionPresentation<ProjectView[K]>[];
  /** Current persisted chart preferences. */
  readonly view: ProjectView;
  /** Emits a complete proposed persisted view. */
  readonly onViewChange: (view: ProjectView) => void;
}

/**
 * Renders the reusable chart view command strip.
 * @param props Current view, session state, view callbacks, and export callback.
 * @returns Rendered chart menu markup.
 */
export function ChartMenuBar(props: ChartMenuBarProps): React.JSX.Element {
  const { view, onViewChange } = props;
  const translate = useTranslate();
  const presentation = createChartMenuPresentation(
    {
      view,
      legendVisible: props.legendVisible,
      coloredStyleEnabled: props.coloredStyleEnabled,
      themes: props.themes,
    },
    translate,
    props,
  );

  return (
    <nav className="ganttee-chart-menu-bar" aria-label={translate("Chart view controls")}>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Chart appearance")}>
        <ViewSelect
          field="style"
          value={view.style}
          label={translate("Visual style")}
          options={presentation.styleOptions}
          view={view}
          onViewChange={onViewChange}
        />
        <ViewSelect
          field="theme"
          value={props.themeId}
          label={translate("Color theme")}
          options={presentation.themeOptions}
          view={view}
          onViewChange={onViewChange}
        />
        {presentation.toggleActions.map((action) => (
          <IconAction action={action} key={action.id} />
        ))}
      </div>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Zoom controls")}>
        <IconAction action={presentation.zoomActions[0]} />
        <ViewSelect
          field="zoomLevel"
          value={view.zoomLevel}
          label={translate("Zoom level")}
          options={presentation.zoomOptions}
          view={view}
          onViewChange={onViewChange}
        />
        <IconAction action={presentation.zoomActions[1]} />
        <IconAction action={presentation.zoomActions[2]} />
      </div>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Export controls")}>
        <IconAction action={presentation.settingsAction} />
        <IconActionMenu action={presentation.exportAction} />
      </div>
    </nav>
  );
}

/**
 * Renders a compact select that proposes a complete view when one field changes.
 * @param props Edited field, its value and options, and the view callback.
 * @returns Rendered select markup.
 */
function ViewSelect<K extends SelectViewField>(props: ViewSelectProps<K>): React.JSX.Element {
  return (
    <Select
      className="ganttee-chart-menu-bar__select"
      variant="compact"
      aria-label={props.label}
      value={props.value}
      onChange={(event) =>
        props.onViewChange(
          withViewField(props.view, props.field, event.target.value as ProjectView[K]),
        )
      }
    >
      {props.options.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
