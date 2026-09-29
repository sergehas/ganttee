import { withItemLabel } from "@webview/features/chart/chartItemLabels";
import { classicStyle } from "@webview/features/chart/styles/classicStyle";
import { metroStyle } from "@webview/features/chart/styles/metroStyle";
import { bindThemeToRenderer } from "@webview/features/chart/styles/visualStyle";
import * as assert from "assert";
import { asElement, fakeApi, fakeParams } from "./styles/fakeRenderApi";

suite("chartItemLabels", () => {
  const theme = {
    color: [],
    backgroundColor: "#ffffff",
    textStyle: {},
    categoryAxis: {
      axisLabel: {
        color: "#999999",
        textBorderColor: "rgba(255, 255, 255, 0.9)",
        textBorderWidth: 8,
      },
    },
  };
  const render = withItemLabel(
    bindThemeToRenderer(classicStyle.renderTask, theme),
    ["Alpha", ""],
    2,
    theme.categoryAxis.axisLabel,
  );

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
    assert.deepStrictEqual(
      [label.style?.fill, label.style?.stroke, label.style?.lineWidth, label.style?.strokeFirst],
      ["#999999", "rgba(255, 255, 255, 0.9)", 8, true],
    );
  });

  test("uses the milestone date as the item end", () => {
    const milestone = withItemLabel(
      bindThemeToRenderer(classicStyle.renderMilestone, theme),
      ["Launch"],
      1,
      theme.categoryAxis.axisLabel,
    );
    const [, label] = asElement(milestone(fakeParams(), fakeApi([0, 10]))).children ?? [];
    assert.strictEqual(label.x, 210);
  });

  test("keeps the same wrapper structure when labels are disabled", () => {
    const withoutLabels = withItemLabel(
      bindThemeToRenderer(classicStyle.renderTask, theme),
      ["Alpha"],
      2,
      theme.categoryAxis.axisLabel,
      false,
    );
    const item = asElement(withoutLabels(fakeParams(), fakeApi([0, 5, 15])));

    assert.strictEqual(item.type, "group");
    assert.deepStrictEqual(
      item.children?.map((child) => child.type),
      ["rect", "text"],
    );
    assert.strictEqual(item.children?.[1].ignore, true);
  });

  test("keeps Metro station positions stable when toggling right-side labels", () => {
    const renderWithLabels = withItemLabel(
      bindThemeToRenderer(metroStyle.renderTask, theme),
      ["Alpha"],
      2,
      theme.categoryAxis.axisLabel,
      true,
    );
    const renderWithoutLabels = withItemLabel(
      bindThemeToRenderer(metroStyle.renderTask, theme),
      ["Alpha"],
      2,
      theme.categoryAxis.axisLabel,
      false,
    );
    const itemWithLabels = asElement(renderWithLabels(fakeParams(), fakeApi([0, 5, 15])));
    const itemWithoutLabels = asElement(renderWithoutLabels(fakeParams(), fakeApi([0, 5, 15])));
    const startStationWithLabels = itemWithLabels.children?.[0].children?.[1];
    const startStationWithoutLabels = itemWithoutLabels.children?.[0].children?.[1];

    assert.strictEqual(itemWithLabels.type, "group");
    assert.strictEqual(itemWithoutLabels.type, "group");
    assert.deepStrictEqual(
      [startStationWithLabels?.type, startStationWithLabels?.shape?.cx],
      [startStationWithoutLabels?.type, startStationWithoutLabels?.shape?.cx],
    );
    assert.strictEqual(itemWithoutLabels.children?.[1].ignore, true);
  });

  test("returns the bare item when the label has no room or no text", () => {
    const item = asElement(render(fakeParams(), fakeApi([0, 5, 39.5])));
    assert.strictEqual(item.type, "group");
    assert.strictEqual(item.children?.[1].ignore, true);
    assert.strictEqual(
      asElement(render(fakeParams(undefined, 1), fakeApi([0, 5, 15]))).type,
      "rect",
    );
  });

  test("omits the label of an omitted item", () => {
    assert.strictEqual(render(fakeParams(), fakeApi([0, -20, -15])), undefined);
  });
});
