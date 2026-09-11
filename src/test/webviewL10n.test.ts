import * as assert from "assert";
import { createWebviewL10nCatalog } from "../views/editor/webviewL10n";
import { translate, WebviewL10n } from "../webview/l10n";

/** Default translation bundle containing the source-message catalog. */
const defaultL10nBundle = require("../../l10n/bundle.l10n.json") as Readonly<
  Record<string, string>
>;

suite("webview l10n", () => {
  test("resolves every default-bundle key through the supplied localizer", () => {
    const localizedSources: string[] = [];
    const catalog = createWebviewL10nCatalog((source) => {
      localizedSources.push(source);
      return `localized: ${source}`;
    });

    assert.deepStrictEqual(
      localizedSources.sort(),
      Object.keys(defaultL10nBundle).sort(),
    );
    assert.strictEqual(catalog.Save, "localized: Save");
  });

  test("formats placeholders and preserves absent values without throwing", () => {
    const l10n = createL10n({
      greeting: "Hello {0}, item {1}.",
    });

    assert.strictEqual(
      translate(l10n, "greeting", "Ada", 3),
      "Hello Ada, item 3.",
    );
    assert.strictEqual(
      translate(l10n, "greeting", "Ada"),
      "Hello Ada, item {1}.",
    );
  });

  test("uses the key as a missing-catalog fallback", () => {
    assert.strictEqual(translate(createL10n({}), "missing.key"), "missing.key");
  });
});

/** Creates an l10n value with a stable test display language. */
function createL10n(strings: Readonly<Record<string, string>>): WebviewL10n {
  return { locale: "en", strings };
}
