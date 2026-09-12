import { createContext, useContext } from "react";

/** Localized strings and display language delivered by the extension host. */
export interface WebviewL10n {
  /** VS Code display language used for locale-sensitive presentation. */
  readonly locale: string;
  /** Resolved localized strings indexed by their English source messages. */
  readonly strings: Readonly<Record<string, string>>;
}

/** Resolves English source messages for webview presentation. */
export type WebviewTranslator = (
  source: string,
  ...values: unknown[]
) => string;

/** Resolves a catalog string and substitutes available positional values. */
export function translate(
  l10n: WebviewL10n,
  source: string,
  ...values: readonly unknown[]
): string {
  const message = l10n.strings[source] ?? source;
  return message.replace(/\{(\d+)\}/g, (placeholder, indexText) => {
    const value = values[Number(indexText)];
    return value === undefined ? placeholder : String(value);
  });
}

/** Provides webview localization to the React component tree. */
export const WebviewL10nContext = createContext<WebviewL10n | undefined>(
  undefined,
);

/** Returns the localization state after the webview session is initialized. */
export function useWebviewL10n(): WebviewL10n {
  const l10n = useContext(WebviewL10nContext);
  if (l10n === undefined) {
    throw new Error("Webview localization is not initialized.");
  }
  return l10n;
}

/** Returns a translator bound to the initialized webview catalog. */
export function useTranslate(): WebviewTranslator {
  const l10n = useWebviewL10n();
  return (source, ...values) => translate(l10n, source, ...values);
}
