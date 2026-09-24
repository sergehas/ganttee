import { ProjectView } from "@common/documents";
import { IconAction, IconActionMenu } from "@webview/components/IconAction";
import { Select } from "@webview/components/Select";
import {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import { createChartMenuPresentation } from "@webview/features/chart/chartMenuPresentation";
import "@webview/features/chart/components/ChartMenuBar.scss";
import { useTranslate } from "@webview/l10n";

interface ChartMenuBarProps {
  /** Current persisted chart preferences. */
  readonly view: ProjectView;
  /** Emits a complete proposed persisted view. */
  readonly onViewChange: (view: ProjectView) => void;
  /** Fits the visible chart without changing persisted preferences. */
  readonly onFitToWindow: () => void;
  /** Exports the currently rendered chart image. */
  readonly onExport: (format: ChartExportFormat, destination: ChartExportDestination) => void;
}

/**
 * Renders the reusable chart view command strip.
 * @param props Current view, view callbacks, and export callback.
 * @returns Rendered chart menu markup.
 */
export function ChartMenuBar({
  view,
  onViewChange,
  onFitToWindow,
  onExport,
}: ChartMenuBarProps): React.JSX.Element {
  const translate = useTranslate();
  const presentation = createChartMenuPresentation(
    view,
    translate,
    onViewChange,
    onFitToWindow,
    onExport,
  );

  return (
    <nav className="ganttee-chart-menu-bar" aria-label={translate("Chart view controls")}>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Chart layers")}>
        {presentation.layerActions.map((action) => (
          <IconAction action={action} key={action.id} />
        ))}
      </div>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Zoom controls")}>
        <IconAction action={presentation.zoomActions[0]} />
        <Select
          className="ganttee-chart-menu-bar__zoom-select"
          variant="compact"
          aria-label={translate("Zoom level")}
          value={view.zoomLevel}
          onChange={(event) =>
            onViewChange({
              ...view,
              zoomLevel: event.target.value as typeof view.zoomLevel,
            })
          }
        >
          {presentation.zoomLevels.map((level) => (
            <option value={level} key={level}>
              {translate(level[0].toUpperCase() + level.slice(1))}
            </option>
          ))}
        </Select>
        <IconAction action={presentation.zoomActions[1]} />
        <IconAction action={presentation.zoomActions[2]} />
      </div>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Export controls")}>
        <IconActionMenu action={presentation.exportAction} />
      </div>
    </nav>
  );
}
