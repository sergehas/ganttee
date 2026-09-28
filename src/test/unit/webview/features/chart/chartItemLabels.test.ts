import { withItemLabel } from "@webview/features/chart/chartItemLabels";
import { classicStyle } from "@webview/features/chart/styles/classicStyle";
import * as assert from "assert";
import { asElement, fakeApi, fakeParams } from "./styles/fakeRenderApi";

suite("chartItemLabels", () => {
  const render = withItemLabel(classicStyle.renderTask, ["Alpha", ""], 2);

  test("draws the row label right of the item, truncated at the grid edge", () => {
    const [item, label] = asElement(render(fakeParams(), fakeApi([0, 5, 15]))).children ?? [];

    assert.strictEqual(item.type, "rect");
    assert.deepStrictEqual(
      { type: label.type, x: label.x, y: label.y },
      { type: "text", x: 260, y: 10 },
    );
    assert.deepStrictEqual(
      [label.style?.text, label.style?.width, label.style?.overflow],
      ["Alpha", 240, "truncate"],
    );
  });

  test("uses the milestone date as the item end", () => {
    const milestone = withItemLabel(classicStyle.renderMilestone, ["Launch"], 1);
    const [, label] = asElement(milestone(fakeParams(), fakeApi([0, 10]))).children ?? [];
    assert.strictEqual(label.x, 210);
  });

  test("returns the bare item when the label has no room or no text", () => {
    const item = asElement(render(fakeParams(), fakeApi([0, 5, 39.5])));
    assert.strictEqual(item.type, "rect");
    assert.strictEqual(
      asElement(render(fakeParams(undefined, 1), fakeApi([0, 5, 15]))).type,
      "rect",
    );
  });

  test("omits the label of an omitted item", () => {
    assert.strictEqual(render(fakeParams(), fakeApi([0, -20, -15])), undefined);
  });
});
