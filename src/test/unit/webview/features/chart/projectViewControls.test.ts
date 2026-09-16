import { DEFAULT_PROJECT_VIEW, ProjectView } from "@common/documents";
import {
  toggleProjectViewLayer,
  withZoomLevel,
  ZOOM_LEVELS,
  zoomIn,
  zoomOut,
} from "@webview/features/chart/projectViewControls";
import * as assert from "assert";

suite("projectViewControls", () => {
  test("keeps zoom levels ordered from finest to coarsest", () => {
    assert.deepStrictEqual(ZOOM_LEVELS, ["day", "week", "month", "quarter", "year"]);
  });

  test("moves in both zoom directions and clamps at the boundaries", () => {
    assert.strictEqual(zoomIn("year"), "quarter");
    assert.strictEqual(zoomIn("day"), "day");
    assert.strictEqual(zoomOut("day"), "week");
    assert.strictEqual(zoomOut("year"), "year");
  });

  test("changes only the selected zoom preference", () => {
    const view = withZoomLevel(DEFAULT_PROJECT_VIEW, "quarter");

    assert.deepStrictEqual(view, {
      ...DEFAULT_PROJECT_VIEW,
      zoomLevel: "quarter",
    });
    assert.deepStrictEqual(DEFAULT_PROJECT_VIEW, {
      zoomLevel: "week",
      showDependencies: true,
      showOffDays: false,
      showHolidays: false,
      showCriticalPath: false,
    });
  });

  test("toggles each layer independently and preserves the remaining view", () => {
    const view: ProjectView = {
      zoomLevel: "month",
      showDependencies: true,
      showOffDays: false,
      showHolidays: true,
      showCriticalPath: false,
    };

    assert.deepStrictEqual(toggleProjectViewLayer(view, "showDependencies"), {
      ...view,
      showDependencies: false,
    });
    assert.deepStrictEqual(toggleProjectViewLayer(view, "showOffDays"), {
      ...view,
      showOffDays: true,
    });
    assert.deepStrictEqual(toggleProjectViewLayer(view, "showHolidays"), {
      ...view,
      showHolidays: false,
    });
    assert.deepStrictEqual(toggleProjectViewLayer(view, "showCriticalPath"), {
      ...view,
      showCriticalPath: true,
    });
    assert.deepStrictEqual(view, {
      zoomLevel: "month",
      showDependencies: true,
      showOffDays: false,
      showHolidays: true,
      showCriticalPath: false,
    });
  });
});
