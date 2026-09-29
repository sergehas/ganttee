import {
  CHART_ITEM_MAX_HEIGHT,
  CHART_ITEM_MIN_HEIGHT,
} from "@webview/features/chart/chart.constants";
import {
  barPlacement,
  clipBar,
  dependencyEndpoints,
  itemColor,
  itemHeight,
  milestonePlacement,
  orthogonalRoute,
  timelineGrid,
} from "@webview/features/chart/styles/styleGeometry";
import * as assert from "assert";
import { fakeApi, fakeParams, GRID, ITEM_COLOR } from "./fakeRenderApi";

suite("styleGeometry", () => {
  test("clamps the item height to the chart limits", () => {
    assert.strictEqual(itemHeight(fakeApi([], 5)), CHART_ITEM_MIN_HEIGHT);
    assert.strictEqual(itemHeight(fakeApi([], 20)), 12);
    assert.strictEqual(itemHeight(fakeApi([], 100)), CHART_ITEM_MAX_HEIGHT);
  });

  test("places bars on their row with a minimum width", () => {
    assert.deepStrictEqual(barPlacement(fakeApi([1, 5, 15])), {
      x: 150,
      width: 100,
      centerY: 30,
      height: 12,
    });
    assert.strictEqual(barPlacement(fakeApi([0, 5, 5])).width, 2);
  });

  test("clips bars to the grid and omits bars outside it", () => {
    const bar = barPlacement(fakeApi([0, -5, 5]));
    assert.deepStrictEqual(clipBar(fakeParams(), bar), { x: 100, y: 4, width: 50, height: 12 });
    assert.deepStrictEqual(clipBar(fakeParams(), bar, 4, 2), {
      x: 100,
      y: 8,
      width: 52,
      height: 4,
    });
    assert.strictEqual(clipBar(fakeParams(), barPlacement(fakeApi([0, 60, 70]))), undefined);
  });

  test("places milestones inside the grid only", () => {
    assert.deepStrictEqual(milestonePlacement(fakeParams(), fakeApi([0, 10])), {
      center: [200, 10],
      height: 12,
    });
    assert.strictEqual(milestonePlacement(fakeParams(), fakeApi([0, 60])), undefined);
  });

  test("maps dependency values to endpoints and a right-angle route", () => {
    const { from, to } = dependencyEndpoints(fakeApi([0, 5, 2, 15]));
    assert.deepStrictEqual(
      [from, to],
      [
        [150, 10],
        [250, 50],
      ],
    );
    assert.deepStrictEqual(orthogonalRoute(from, to), [
      [150, 10],
      [200, 10],
      [200, 50],
      [250, 50],
    ]);
  });

  test("reads the grid and item color from ECharts", () => {
    assert.deepStrictEqual(timelineGrid(fakeParams()), GRID);
    assert.strictEqual(itemColor(fakeApi([])), ITEM_COLOR);
  });
});
