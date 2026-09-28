import { GroupPresentation } from "@common/presentation/project/projectItemPresentation";
import {
  buildMetroGroupColorMap,
  resolveMetroItemColor,
} from "@webview/features/chart/chartItemColors";
import * as assert from "assert";

const GROUPS = [{ id: "group-a" }, { id: "group-b" }, { id: "group-c" }] as GroupPresentation[];

suite("chartItemColors", () => {
  test("assigns colors from the eighth palette entry in group order", () => {
    const colors = ["#0", "#1", "#2", "#3", "#4", "#5", "#6", "#7", "#8"];
    const groupColors = buildMetroGroupColorMap(GROUPS, colors);

    assert.deepStrictEqual(
      [...groupColors],
      [
        ["group-a", "#7"],
        ["group-b", "#8"],
        ["group-c", "#7"],
      ],
    );
  });

  test("returns no group assignments when the reserved palette tail is empty", () => {
    assert.strictEqual(
      buildMetroGroupColorMap(GROUPS, ["#0", "#1", "#2", "#3", "#4", "#5", "#6"]).size,
      0,
    );
    assert.strictEqual(buildMetroGroupColorMap(GROUPS, undefined).size, 0);
  });

  test("resolves critical path, group, status, then fallback colors", () => {
    assert.strictEqual(
      resolveMetroItemColor("critical", "group", "status", "fallback"),
      "critical",
    );
    assert.strictEqual(resolveMetroItemColor(undefined, "group", "status", "fallback"), "group");
    assert.strictEqual(resolveMetroItemColor(undefined, undefined, "status", "fallback"), "status");
    assert.strictEqual(
      resolveMetroItemColor(undefined, undefined, undefined, "fallback"),
      "fallback",
    );
    assert.strictEqual(
      resolveMetroItemColor(undefined, undefined, undefined, undefined),
      undefined,
    );
  });
});
