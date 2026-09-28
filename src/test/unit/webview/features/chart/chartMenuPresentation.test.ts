import { DEFAULT_PROJECT_VIEW, ProjectView } from "@common/documents";
import {
  ChartMenuHandlers,
  ChartMenuPresentation,
  createChartMenuPresentation,
} from "@webview/features/chart/chartMenuPresentation";
import { createThemeRegistry } from "@webview/features/chart/themes/chartThemes";
import * as assert from "assert";

const THEMES = createThemeRegistry([
  { fileName: "blue-theme.json", data: {} },
  { fileName: "dark_ocean-theme.json", data: {} },
]);

suite("chartMenuPresentation", () => {
  test("creates ordered localized toggle, zoom, and export actions", () => {
    const model = createModel(DEFAULT_PROJECT_VIEW);

    assert.deepStrictEqual(
      model.toggleActions.map((action) => action.label),
      ["[Show critical path]", "[Show labels on items]", "[Show legend]"],
    );
    assert.deepStrictEqual(
      model.zoomActions.map((action) => action.label),
      ["[Zoom in]", "[Zoom out]", "[Fit to window]"],
    );
    assert.deepStrictEqual(
      model.exportAction.children?.map((action) => action.label),
      ["[SVG]", "[PNG]"],
    );
    assert.notEqual(model.exportAction.onSelect, undefined);
    assert.deepStrictEqual(
      model.exportAction.children?.map((action) => action.onSelect),
      [undefined, undefined],
    );
  });

  test("does not expose dependency, off-day, or holiday layer actions", () => {
    const ids = createModel(DEFAULT_PROJECT_VIEW).toggleActions.map((action) => action.id);
    assert.deepStrictEqual(ids, ["critical-path", "item-labels", "legend"]);
  });

  test("creates localized zoom, style, and theme options", () => {
    const model = createModel(DEFAULT_PROJECT_VIEW);

    assert.deepStrictEqual(model.zoomOptions, [
      { value: "day", label: "[Day]" },
      { value: "week", label: "[Week]" },
      { value: "month", label: "[Month]" },
      { value: "quarter", label: "[Quarter]" },
      { value: "year", label: "[Year]" },
    ]);
    assert.deepStrictEqual(model.styleOptions, [
      { value: "classic", label: "[Classic]" },
      { value: "rounded", label: "[Rounded]" },
      { value: "metro", label: "[Metro]" },
    ]);
    assert.deepStrictEqual(model.themeOptions, [
      { value: "blue", label: "[Blue]" },
      { value: "dark_ocean", label: "[Dark Ocean]" },
    ]);
  });

  test("reflects persisted flags and session legend visibility as pressed states", () => {
    const view: ProjectView = {
      ...DEFAULT_PROJECT_VIEW,
      showCriticalPath: true,
      showItemLabels: false,
    };

    assert.deepStrictEqual(
      createModel(view, true).toggleActions.map((action) => action.pressed),
      [true, false, true],
    );
    assert.deepStrictEqual(
      createModel({ ...view, showItemLabels: true }, false).toggleActions.map(
        (action) => action.pressed,
      ),
      [true, true, false],
    );
  });

  test("emits complete view proposals and toggles the legend without a view proposal", () => {
    const view = { ...DEFAULT_PROJECT_VIEW };
    const proposals: ProjectView[] = [];
    let fitCount = 0;
    let legendToggles = 0;
    const model = createChartMenuPresentation(
      { view, legendVisible: true, themes: THEMES },
      (source) => source,
      createHandlers({
        onViewChange: (nextView) => proposals.push(nextView),
        onFitToWindow: () => {
          fitCount += 1;
        },
        onToggleLegend: () => {
          legendToggles += 1;
        },
      }),
    );

    for (const action of [...model.toggleActions, ...model.zoomActions]) {
      action.onSelect?.();
    }

    assert.deepStrictEqual(proposals, [
      { ...view, showCriticalPath: true },
      { ...view, showItemLabels: true },
      { ...view, zoomLevel: "day" },
      { ...view, zoomLevel: "month" },
    ]);
    assert.strictEqual(fitCount, 1);
    assert.strictEqual(legendToggles, 1);
  });

  test("emits format and destination for export actions", () => {
    const exports: string[] = [];
    const model = createChartMenuPresentation(
      { view: DEFAULT_PROJECT_VIEW, legendVisible: true, themes: THEMES },
      (source) => source,
      createHandlers({
        onExport: (format, destination) => exports.push(`${format}:${destination}`),
      }),
    );

    model.exportAction.onSelect?.();
    for (const formatAction of model.exportAction.children ?? []) {
      for (const destinationAction of formatAction.children ?? []) {
        destinationAction.onSelect?.();
      }
    }

    assert.deepStrictEqual(exports, [
      "svg:download",
      "svg:download",
      "svg:clipboard",
      "png:download",
      "png:clipboard",
    ]);
  });
});

/** Builds menu presentation data with a bracketing translator that exposes localized keys. */
function createModel(view: ProjectView, legendVisible = true): ChartMenuPresentation {
  return createChartMenuPresentation(
    { view, legendVisible, themes: THEMES },
    (source) => `[${source}]`,
    createHandlers({}),
  );
}

/** Fills unspecified menu handlers with no-ops. */
function createHandlers(overrides: Partial<ChartMenuHandlers>): ChartMenuHandlers {
  return {
    onViewChange: () => undefined,
    onFitToWindow: () => undefined,
    onExport: () => undefined,
    onToggleLegend: () => undefined,
    ...overrides,
  };
}
