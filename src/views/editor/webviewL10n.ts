import * as defaultL10nBundle from "../../../l10n/bundle.l10n.json";

/** Default translation bundle containing the application-wide localization keys. */
/** Builds the webview catalog by resolving each default-bundle source message. */
export function createWebviewL10nCatalog(
  localize: (source: string) => string,
  forceLoad?: boolean,
): Readonly<Record<string, string>> {
  const bundle = defaultL10nBundle as Record<string, string>;
  return Object.fromEntries(
    Object.keys(bundle).map((source) => [source, forceLoad ? bundle[source] : localize(source)]),
  );
}
