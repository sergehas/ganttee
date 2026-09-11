/** Default translation bundle containing the application-wide localization keys. */
const defaultL10nBundle = require("../../../l10n/bundle.l10n.json") as Readonly<
  Record<string, string>
>;

/** Builds the webview catalog by resolving each default-bundle source message. */
export function createWebviewL10nCatalog(
  localize: (source: string) => string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.keys(defaultL10nBundle).map((source) => [source, localize(source)]),
  );
}
