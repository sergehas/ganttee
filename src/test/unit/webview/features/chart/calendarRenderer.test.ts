import { renderCalendarArea } from "@webview/features/chart/calendarRenderer";
import * as assert from "assert";
import { asElement, fakeApi, fakeParams, GRID, ITEM_COLOR } from "./styles/fakeRenderApi";

suite("calendarRenderer", () => {
  test("renders a full-height calendar band with the ECharts item color", () => {
    assert.deepStrictEqual(asElement(renderCalendarArea(fakeParams(), fakeApi([0, 10]))), {
      type: "rect",
      shape: { x: GRID.x, y: GRID.y, width: 100, height: GRID.height },
      style: { fill: ITEM_COLOR },
    });
  });

  test("clips the band to the timeline grid", () => {
    assert.deepStrictEqual(asElement(renderCalendarArea(fakeParams(), fakeApi([-5, 10]))).shape, {
      x: GRID.x,
      y: GRID.y,
      width: 100,
      height: GRID.height,
    });
  });

  test("keeps zero-width calendar bands visible", () => {
    assert.deepStrictEqual(asElement(renderCalendarArea(fakeParams(), fakeApi([10, 10]))).shape, {
      x: 200,
      y: GRID.y,
      width: 1,
      height: GRID.height,
    });
  });

  test("omits bands outside the timeline grid", () => {
    assert.strictEqual(renderCalendarArea(fakeParams(), fakeApi([60, 70])), undefined);
  });
});
