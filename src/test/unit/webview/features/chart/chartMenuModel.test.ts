import { DEFAULT_PROJECT_VIEW, ProjectView } from "@common/documents";
import {
  ChartMenuPresentation,
  createChartMenuPresentation,
} from "@webview/features/chart/chartMenuPresentation";
import * as assert from "assert";

suite("chartMenuPresentation", () => {
  test("creates ordered localized layer and zoom actions", () => {
    const model = createModel(DEFAULT_PROJECT_VIEW);

    assert.deepStrictEqual(
      model.layerActions.map((action) => action.label),
      ["Show dependencies", "Show off-days", "Show holidays", "Show critical path"],
    );
    assert.deepStrictEqual(
      model.zoomActions.map((action) => action.label),
      ["Zoom in", "Zoom out", "Fit to window"],
    );
    assert.deepStrictEqual(model.zoomLevels, ["day", "week", "month", "quarter", "year"]);
    assert.deepStrictEqual(
      model.exportAction.children?.map((action) => action.label),
      ["SVG", "PNG"],
    );
    assert.strictEqual(model.exportAction.onSelect, undefined);
    assert.deepStrictEqual(
      model.exportAction.children?.map((action) => action.onSelect),
      [undefined, undefined],
    );
  });

  test("preserves each layer's pressed state", () => {
    const view: ProjectView = {
      ...DEFAULT_PROJECT_VIEW,
      showDependencies: false,
      showOffDays: true,
      showHolidays: true,
      showCriticalPath: false,
    };

    assert.deepStrictEqual(
      createModel(view).layerActions.map((action) => action.pressed),
      [false, true, true, false],
    );
  });

  test("emits complete view proposals for layer and zoom actions", () => {
    const view = { ...DEFAULT_PROJECT_VIEW };
    const proposals: ProjectView[] = [];
    let fitCount = 0;
    const model = createChartMenuPresentation(
      view,
      (source) => source,
      (nextView) => proposals.push(nextView),
      () => {
        fitCount += 1;
      },
      () => undefined,
    );

    model.layerActions[0].onSelect?.();
    model.zoomActions[0].onSelect?.();
    model.zoomActions[2].onSelect?.();

    assert.deepStrictEqual(proposals, [
      { ...view, showDependencies: false },
      { ...view, zoomLevel: "day" },
    ]);
    assert.strictEqual(fitCount, 1);
  });

  test("emits format and destination for export actions", () => {
    const exports: string[] = [];
    const model = createChartMenuPresentation(
      DEFAULT_PROJECT_VIEW,
      (source) => source,
      () => undefined,
      () => undefined,
      (format, destination) => exports.push(`${format}:${destination}`),
    );

    for (const formatAction of model.exportAction.children ?? []) {
      for (const destinationAction of formatAction.children ?? []) {
        destinationAction.onSelect?.();
      }
    }

    assert.deepStrictEqual(exports, [
      "svg:download",
      "svg:clipboard",
      "png:download",
      "png:clipboard",
    ]);
  });
});

/** Builds menu presentation data with identity localization for test readability. */
function createModel(view: ProjectView): ChartMenuPresentation {
  return createChartMenuPresentation(
    view,
    (source) => source,
    () => undefined,
    () => undefined,
    () => undefined,
  );
}
