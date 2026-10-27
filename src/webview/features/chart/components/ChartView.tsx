import { ProjectView } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import { EditableEntityRef } from "@common/protocol";
import type {
  ChartExportDestination,
  ChartExportFormat,
} from "@webview/features/chart/chartExport.types";
import { ChartMenuBar } from "@webview/features/chart/components/ChartMenuBar";
import { GanttChart, GanttChartHandle } from "@webview/features/chart/components/GanttChart";
import { VISUAL_STYLES } from "@webview/features/chart/styles/visualStyles";
import { CHART_THEMES, resolveChartTheme } from "@webview/features/chart/themes/chartThemes";
import { translate, useWebviewL10n } from "@webview/l10n";
import { useEffect, useRef, useState } from "react";

/** Props for the chart feature container. */
interface ChartViewProps {
  /** Current authored and computed project presentation. */
  readonly project: ProjectPresentation;
  /** Persisted chart preferences. */
  readonly view: ProjectView;
  /** Whether the project has no chartable task or milestone items. */
  readonly isEmpty: boolean;
  /** Content shown instead of the chart when the project is empty. */
  readonly emptyState: React.ReactNode;
  /** Feedback rendered between the menu and chart. */
  readonly toolbarFeedback: React.ReactNode;
  /** Emits a complete proposed persisted view.
   * @param view Proposed chart preferences.
   * @returns Nothing.
   */
  readonly onViewChange: (view: ProjectView) => void;
  /** Opens an entity in the edit form.
   * @param entity Entity to edit.
   * @returns Nothing.
   */
  readonly onEditEntity: (entity: EditableEntityRef) => void;
  /** Reports a localized export error, or clears the previous error.
   * @param message Error to show, or `null` to clear it.
   * @returns Nothing.
   */
  readonly onExportError: (message: string | null) => void;
  /** Opens Settings for the current project document. */
  readonly onOpenSettings: () => void;
}

/**
 * Owns chart-specific theme selection, menu composition, and session-only display state.
 * @param props Project data, persisted preferences, and editor callbacks.
 * @returns The chart menu and either the chart or the supplied empty state.
 */
export function ChartView(props: ChartViewProps): React.JSX.Element {
  const l10n = useWebviewL10n();
  const chartRef = useRef<GanttChartHandle | null>(null);
  const selectedStyleRef = useRef(props.view.style);
  const [legendVisible, setLegendVisible] = useState(true);
  const [coloredStyleEnabled, setColoredStyleEnabled] = useState(
    VISUAL_STYLES[props.view.style].colored ?? false,
  );
  const [fitVersion, setFitVersion] = useState(0);
  const theme = resolveChartTheme(CHART_THEMES, props.view.theme);

  /** Resets the session color mode when the persisted style changes externally. */
  function resetColoredStyleForView(): void {
    if (selectedStyleRef.current !== props.view.style) {
      selectedStyleRef.current = props.view.style;
      setColoredStyleEnabled(VISUAL_STYLES[props.view.style].colored ?? false);
    }
  }
  useEffect(resetColoredStyleForView, [props.view.style]);

  /** Updates the session color default for a style change and forwards the view proposal.
   * @param view Proposed chart preferences.
   * @returns Nothing.
   */
  const updateView = (view: ProjectView) => {
    if (view.style !== selectedStyleRef.current) {
      selectedStyleRef.current = view.style;
      setColoredStyleEnabled(VISUAL_STYLES[view.style].colored ?? false);
    }
    props.onViewChange(view);
  };

  /** Requests a temporary viewport fit without changing persisted preferences.
   * @returns Nothing.
   */
  const fitToWindow = () => {
    setFitVersion((version) => version + 1);
  };

  /** Exports the current chart and reports browser failures to the owning app.
   * @param format Image format to export.
   * @param destination Download or clipboard destination.
   * @returns A promise settled after export handling completes.
   */
  const exportImage = async (
    format: ChartExportFormat,
    destination: ChartExportDestination,
  ): Promise<void> => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    try {
      props.onExportError(null);
      await chart.exportImage(format, destination);
    } catch {
      props.onExportError(translate(l10n, "Unable to export chart image."));
    }
  };

  return (
    <>
      <ChartMenuBar
        view={props.view}
        legendVisible={legendVisible}
        coloredStyleEnabled={coloredStyleEnabled}
        themes={CHART_THEMES}
        themeId={theme.id}
        onViewChange={updateView}
        onToggleLegend={() => setLegendVisible((visible) => !visible)}
        onToggleColoredStyle={() => setColoredStyleEnabled((enabled) => !enabled)}
        onFitToWindow={fitToWindow}
        onExport={exportImage}
        onOpenSettings={props.onOpenSettings}
      />
      {props.toolbarFeedback}
      {props.isEmpty ? (
        props.emptyState
      ) : (
        <GanttChart
          ref={chartRef}
          project={props.project}
          view={props.view}
          theme={theme}
          legendVisible={legendVisible}
          coloredStyleEnabled={coloredStyleEnabled}
          fitVersion={fitVersion}
          onEditEntity={props.onEditEntity}
          onViewChange={updateView}
        />
      )}
    </>
  );
}
