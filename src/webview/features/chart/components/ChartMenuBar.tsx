import { ProjectView } from "@common/documents";
import { createChartMenuModel } from "../chartMenuModel";
import { useTranslate } from "../../../l10n";
import { IconAction } from "./IconAction";

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
  const model = createChartMenuModel(view, translate, onViewChange, onFitToWindow);

  return (
    <nav className="ganttee-menu-bar" aria-label={translate("Chart view controls")}>
      <div className="ganttee-menu-bar__group" aria-label={translate("Chart layers")}>
        {model.layerActions.map((action) => (
          <IconAction action={action} pressed={action.pressed} key={action.id} />
        ))}
      </div>
      <div className="ganttee-menu-bar__group" aria-label={translate("Zoom controls")}>
        <IconAction action={model.zoomActions[0]} />
        <select
          className="ganttee-zoom-select"
          aria-label={translate("Zoom level")}
          value={view.zoomLevel}
          onChange={(event) =>
            onViewChange({
              ...view,
              zoomLevel: event.target.value as typeof view.zoomLevel,
            })
          }
        >
          {model.zoomLevels.map((level) => (
            <option value={level} key={level}>
              {translate(level[0].toUpperCase() + level.slice(1))}
            </option>
          ))}
        </select>
        <IconAction action={model.zoomActions[1]} />
        <IconAction action={model.zoomActions[2]} />
      </div>
    </nav>
  );
}
