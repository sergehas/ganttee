import { DEFAULT_PROJECT_VIEW, ProjectView, ZOOM_LEVELS } from "@common/documents";
import {
  toggleViewFlag,
  withViewField,
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

  test("changes only the selected view field", () => {
    const source = { ...DEFAULT_PROJECT_VIEW };

    assert.deepStrictEqual(withViewField(source, "zoomLevel", "quarter"), {
      ...DEFAULT_PROJECT_VIEW,
      zoomLevel: "quarter",
    });
    assert.deepStrictEqual(withViewField(source, "style", "metro"), {
      ...DEFAULT_PROJECT_VIEW,
      style: "metro",
    });
    assert.deepStrictEqual(withViewField(source, "theme", "green"), {
      ...DEFAULT_PROJECT_VIEW,
      theme: "green",
    });
    assert.deepStrictEqual(withViewField(source, "showItemLabels", true), {
      ...DEFAULT_PROJECT_VIEW,
      showItemLabels: true,
    });
    assert.deepStrictEqual(source, DEFAULT_PROJECT_VIEW);
  });

  test("materializes classic, blue, and hidden item labels by default", () => {
    assert.deepStrictEqual(DEFAULT_PROJECT_VIEW, {
      zoomLevel: "week",
      showDependencies: true,
      showOffDays: false,
      showHolidays: false,
      showCriticalPath: false,
      style: "classic",
      theme: "blue",
      showItemLabels: false,
    });
  });

  test("toggles each flag independently and preserves the remaining view", () => {
    const view: ProjectView = {
      ...DEFAULT_PROJECT_VIEW,
      zoomLevel: "month",
      showHolidays: true,
    };
    const snapshot = { ...view };

    for (const field of [
      "showDependencies",
      "showOffDays",
      "showHolidays",
      "showCriticalPath",
      "showItemLabels",
    ] as const) {
      assert.deepStrictEqual(toggleViewFlag(view, field), { ...view, [field]: !view[field] });
    }
    assert.deepStrictEqual(view, snapshot);
  });
});
