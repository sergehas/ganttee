import { DEFAULT_PROJECT_VIEW, ProjectView } from "@common/documents";
import { ChartMenuModel, createChartMenuModel } from "@webview/chartMenuModel";
import * as assert from "assert";

suite("chartMenuModel", () => {
  test("creates ordered localized layer and zoom actions", () => {
    const model = createModel(DEFAULT_PROJECT_VIEW);

    assert.deepStrictEqual(
      model.layerActions.map((action) => action.label),
      [
        "Show dependencies",
        "Show off-days",
        "Show holidays",
        "Show critical path",
      ],
    );
    assert.deepStrictEqual(
      model.zoomActions.map((action) => action.label),
      ["Zoom in", "Zoom out", "Fit to window"],
    );
    assert.deepStrictEqual(model.zoomLevels, [
      "day",
      "week",
      "month",
      "quarter",
      "year",
    ]);
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
    const model = createChartMenuModel(
      view,
      (source) => source,
      (nextView) => proposals.push(nextView),
      () => {
        fitCount += 1;
      },
    );

    model.layerActions[0].onSelect();
    model.zoomActions[0].onSelect();
    model.zoomActions[2].onSelect();

    assert.deepStrictEqual(proposals, [
      { ...view, showDependencies: false },
      { ...view, zoomLevel: "day" },
    ]);
    assert.strictEqual(fitCount, 1);
  });
});

/** Builds a menu model with identity localization for test readability. */
function createModel(view: ProjectView): ChartMenuModel {
  return createChartMenuModel(
    view,
    (source) => source,
    () => undefined,
    () => undefined,
  );
}
