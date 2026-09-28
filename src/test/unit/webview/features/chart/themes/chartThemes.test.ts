import {
  CHART_THEMES,
  createThemeRegistry,
  resolveChartTheme,
  themeLabel,
} from "@webview/features/chart/themes/chartThemes";
import { THEME_ASSETS } from "@webview/features/chart/themes/themeAssets.generated";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

const THEMES_DIR = path.resolve(__dirname, "../../../../../../../media/themes");

suite("chartThemes", () => {
  test("registers only *-theme.json assets", () => {
    const registry = createThemeRegistry([
      { fileName: "blue-theme.json", data: { palette: ["#00f"] } },
      { fileName: "notes.json", data: {} },
      { fileName: "-theme.json", data: {} },
      { fileName: "green-theme.jsonc", data: {} },
    ]);

    assert.deepStrictEqual([...registry.keys()], ["blue"]);
    assert.deepStrictEqual(registry.get("blue"), {
      id: "blue",
      label: "Blue",
      data: { color: ["#00f"] },
    });
  });

  test("derives title-cased labels from theme identifiers", () => {
    assert.strictEqual(themeLabel("my_dark-BLUE"), "My Dark Blue");
    assert.strictEqual(themeLabel("sea--_green"), "Sea Green");
  });

  test("rejects duplicate identifiers regardless of case", () => {
    assert.throws(
      () =>
        createThemeRegistry([
          { fileName: "blue-theme.json", data: {} },
          { fileName: "Blue-theme.json", data: {} },
        ]),
      /Duplicate chart theme identifier "Blue"/,
    );
  });

  test("creates an empty registry without assets", () => {
    assert.strictEqual(createThemeRegistry([]).size, 0);
  });

  test("resolves registered themes without a warning", () => {
    const warnings: string[] = [];
    assert.strictEqual(
      resolveChartTheme(CHART_THEMES, "green", (message) => warnings.push(message)).id,
      "green",
    );
    assert.deepStrictEqual(warnings, []);
  });

  test("falls back to blue with a warning for unregistered themes", () => {
    const warnings: string[] = [];
    const theme = resolveChartTheme(CHART_THEMES, "sunset", (message) => warnings.push(message));

    assert.strictEqual(theme.id, "blue");
    assert.deepStrictEqual(warnings, ['Chart theme "sunset" is not registered; using "blue".']);
  });

  test("fails when the default theme is not registered", () => {
    assert.throws(() => resolveChartTheme(createThemeRegistry([]), "sunset"), /blue/);
  });

  test("bundles every media/themes/*-theme.json asset", () => {
    const expected = fs
      .readdirSync(THEMES_DIR)
      .filter((fileName) => fileName.endsWith("-theme.json"))
      .map((fileName) => fileName.slice(0, -"-theme.json".length))
      .sort();

    assert.deepStrictEqual([...CHART_THEMES.keys()].sort(), expected);
    assert.ok(THEME_ASSETS.length >= expected.length);
    assert.ok(CHART_THEMES.has("blue"));
  });
});
