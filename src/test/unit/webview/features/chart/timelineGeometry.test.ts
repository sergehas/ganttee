import {
  clipTimelineRectangle,
  isPointInTimeline,
} from "@webview/features/chart/timelineGeometry";
import * as assert from "assert";

suite("timelineGeometry", () => {
  const grid = { x: 160, y: 68, width: 800, height: 400 };

  test("clips project items at the task-list boundary", () => {
    assert.deepStrictEqual(
      clipTimelineRectangle({ x: 120, y: 100, width: 100, height: 20 }, grid),
      { x: 160, y: 100, width: 60, height: 20 },
    );
  });

  test("omits project items outside the visible timeline grid", () => {
    assert.strictEqual(
      clipTimelineRectangle({ x: 20, y: 100, width: 100, height: 20 }, grid),
      undefined,
    );
    assert.strictEqual(isPointInTimeline([159, 100], grid), false);
    assert.strictEqual(isPointInTimeline([160, 100], grid), true);
  });
});
