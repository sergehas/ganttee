import { ProjectView } from "@common/documents";
import { Select } from "@webview/components/Select";
import { createChartMenuPresentation } from "@webview/features/chart/chartMenuPresentation";
import "@webview/features/chart/components/ChartMenuBar.scss";
import { IconAction } from "@webview/features/chart/components/IconAction";
import { useTranslate } from "@webview/l10n";

interface ChartMenuBarProps {
  /** Current persisted chart preferences. */
  readonly view: ProjectView;
  /** Emits a complete proposed persisted view. */
  readonly onViewChange: (view: ProjectView) => void;
  /** Fits the visible chart without changing persisted preferences. */
  readonly onFitToWindow: () => void;
}

/** Renders the reusable chart view command strip. */
export function ChartMenuBar({
  view,
  onViewChange,
  onFitToWindow,
}: ChartMenuBarProps): React.JSX.Element {
  const translate = useTranslate();
  const presentation = createChartMenuPresentation(view, translate, onViewChange, onFitToWindow);

  return (
    <nav className="ganttee-chart-menu-bar" aria-label={translate("Chart view controls")}>
      <div className="ganttee-chart-menu-bar__group" aria-label={translate("Chart layers")}>
        {presentation.layerActions.map((action) => (
          <IconAction action={action} pressed={action.pressed} key={action.id} />
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
    </nav>
  );
}
