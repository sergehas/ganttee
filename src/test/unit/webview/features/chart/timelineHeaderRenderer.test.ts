import { createTimelineTickRenderer } from "@webview/features/chart/timelineHeaderRenderer";
import * as assert from "assert";
import { asElement, fakeApi, fakeParams, GRID, ITEM_COLOR } from "./styles/fakeRenderApi";

suite("timelineHeaderRenderer", () => {
  test("renders a grid line and selected-level label without a parent formatter", () => {
    const render = createTimelineTickRenderer((value) => `selected:${value}`);
    const element = asElement(render(fakeParams(), fakeApi([5])));

    assert.deepStrictEqual(element, {
      type: "group",
      children: [
        {
          type: "line",
          shape: { x1: 150, y1: GRID.y, x2: 150, y2: GRID.y + GRID.height },
          style: { stroke: ITEM_COLOR, lineWidth: 1 },
        },
        {
          type: "text",
          x: 150,
          y: GRID.y - 12,
          style: {
            text: "selected:5",
            fill: ITEM_COLOR,
            align: "center",
            verticalAlign: "bottom",
          },
        },
      ],
    });
  });

  test("adds a parent-level label when its formatter returns text", () => {
    const render = createTimelineTickRenderer(
      (value) => `selected:${value}`,
      (value) => `parent:${value}`,
    );
    const element = asElement(render(fakeParams(), fakeApi([5])));

    assert.strictEqual(element.children?.length, 3);
    assert.deepStrictEqual(element.children?.[2], {
      type: "text",
      x: 150,
      y: GRID.y - 40,
      style: {
        text: "parent:5",
        fill: ITEM_COLOR,
        align: "center",
        verticalAlign: "bottom",
      },
    });
  });

  test("omits ticks outside either side of the grid", () => {
    const render = createTimelineTickRenderer(String);

    assert.strictEqual(render(fakeParams(), fakeApi([-1])), undefined);
    assert.strictEqual(render(fakeParams(), fakeApi([41])), undefined);
  });
});
