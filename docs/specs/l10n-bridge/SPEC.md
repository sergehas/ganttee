---
Status: Implemented
Owner: Copilot
Last updated: 2026-09-11
---

# Feature: l10n Bridge & Webview Codicons Adoption

![Status: Implemented](https://img.shields.io/badge/status-Implemented-2B8A3E?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The editor webview cannot call `vscode.l10n` directly, so its strings are hardcoded English (US),
including the `Close`, `Save`, and `Delete` labels in
[TaskForm.tsx](../../src/webview/TaskForm.tsx).
[UI-integration.md](../requirements/UI-integration.md) (NFR-1, NFR-6) requires a host-resolved
string catalog delivered to the webview once per session, with no hardcoded user-facing English left
in the webview. This spec defines that bridge and targeted adoption of `@vscode/codicons` for
compact form actions, preserving text labels for the primary save and destructive delete commands.

## 2. Goals / Non-goals

### Goals

- Resolve every existing user-facing webview string on the host via `vscode.l10n.t()` and deliver
  them as one catalog. This includes form chrome, field labels, select options, empty states,
  validation messages, chart UI, and accessible action names.
- Deliver the VS Code display language with the catalog and use it in one shared, UTC date-display
  formatter. Date format patterns are locale data owned by `Intl.DateTimeFormat`, not translated
  catalog strings.
- Send the catalog, then `init`, once per webview session. Ignore duplicate `ready` messages and
  never re-request or resend the catalog when a form opens.
- Define a webview-side cache, formatter, and accessor with explicit, non-throwing fallbacks for a
  missing key and missing interpolation value.
- Use the `l10n/bundle.l10n*.json` files as the single application-wide catalog. A feature uses its
  English source message as the key at each host or webview call site and adds that key only to the
  applicable bundle files; it never changes protocol or handshake plumbing.
- Adopt `@vscode/codicons` in the webview, bundled into `dist/` (CSP-safe, no CDN), for the exact
  compact actions defined in the UX section.

### Non-goals

- Concrete per-entity message fields and the generalized entity protocol — owned by
  [Editable Work Item Kinds](editable-all-task-kinds.md).
- Whether settings use the shared editor webview or a dedicated webview — open question owned by
  [UI-integration.md](../requirements/UI-integration.md) (Section 9).
- The full field-type component catalog (date-range, color picker, etc.) from UI-integration FR-2.
- New translation/language infrastructure or additional `l10n` bundles beyond what `vscode.l10n`
  already provides.
- Semantic or TypeScript-owned translation-key registries, generated catalogs, and source-to-key
  mapping layers.
- Translator-authored date format patterns. The extension uses the browser and runtime `Intl` locale
  data instead, so it correctly handles locale-specific ordering, digits, and punctuation.
- Replacing the visible `Save` and `Delete` footer labels. They are primary and destructive commands
  and must retain explicit text.
- Requiring every future action to be icon-only. New controls choose text, icon, or icon-plus-text
  from their action role and accessibility needs.

## 3. User Stories

- As a non-English-speaking user, I want every label in the edit form to respect my VS Code display
  language, so that the webview feels consistent with the rest of the editor.
- As a Ganttee contributor adding a new form field, I want to introduce a new localized string
  without touching the message-protocol plumbing, so that localization stays low-friction.
- As a user whose VS Code display language differs from their operating-system locale, I want dates
  in the editor and Explorer tree to use my VS Code display language, so that dates have one
  predictable presentation throughout the extension.
- As a VS Code user, I want compact secondary form actions to use familiar native icons, so that I
  can scan and operate the form efficiently without weakening the clarity of save or delete.

## 4. Acceptance Criteria

- Given a webview session sends its first `ready` message When the host responds Then it posts
  exactly one `l10nCatalog` message before exactly one `init` message.

- Given a webview session completed the catalog and `init` exchange When it sends another `ready`
  message or the user reopens an edit form Then the host posts no further catalog or `init` message
  and the webview reuses its cached catalog.

- Given the webview requests a string key that is absent from the delivered catalog When the
  accessor resolves that key Then it returns the key itself, does not throw, and does not crash the
  render.

- Given a catalog value contains positional placeholders such as `{0}` When the webview resolves it
  with all required values Then the rendered string contains each supplied value in its placeholder
  position; missing values leave their placeholder intact and do not throw.

- Given the VS Code display language is `de` and a scheduled calendar date is displayed in either
  the editor webview or Explorer tree When the shared date formatter renders it Then both surfaces
  use `Intl.DateTimeFormat("de", { dateStyle: "short", timeZone: "UTC" })` semantics and do not
  render the persisted ISO value as user-facing text.

- Given a new feature adds a webview string When it uses the English source message as the argument
  to webview `t()` and adds the same message as an entry in
  [bundle.l10n.json](../../l10n/bundle.l10n.json) Then the localized string reaches the webview in
  the next session without changing either message union or the handshake sequence.

- Given the form renders its close, add-dependency, remove-dependency, or ungroup-member action When
  the action is available Then it uses the respective `close`, `add`, `trash`, or `remove`
  `@vscode/codicons` glyph as its only visible content, with a localized accessible name and
  tooltip.

- Given the form renders its `Save` or `Delete` footer action When the form is usable Then the
  action retains its localized visible text; neither control becomes icon-only.

- Given the webview bundle is built for production When the codicon font/asset is resolved at
  runtime Then its CSS and font load from `dist/` under the existing per-render CSP nonce, with no
  external/CDN request.

## 5. Domain & Data Model Impact

- No new or changed types in `src/common/models/`.
- No `.ganttee` schema change; no `CURRENT_DOCUMENT_VERSION` bump. This is pure UI/host-webview
  plumbing with no effect on persisted documents.

## 6. Protocol Impact

- Add the `HostToWebviewMessage` variant
  `{ type: "l10nCatalog", locale: string, strings: Readonly<Record<string, string>> }` to
  [protocol.ts](../../src/common/protocol.ts) alongside `init`.
- [bundle.l10n.json](../../l10n/bundle.l10n.json) is the default and sole translation catalog; its
  English source-message keys are the application-wide localization keys. Locale-specific
  `bundle.l10n.<locale>.json` files use the same keys with translated values.
- The host reads the default bundle only to enumerate its source-message keys, resolves each key
  through `vscode.l10n.t(source, ...values)`, and sends the resolved source-to-string map. This is
  transport plumbing, not a second catalog.
- The webview receives only that resolved catalog. Its `t(source, ...values)` accessor follows the
  host's functional behavior: it looks up the English source message, formats positional `{0}`,
  `{1}`, and later placeholders locally, returns the source message for an absent catalog entry, and
  leaves a missing substitution placeholder intact. It has no `vscode` or l10n-bundle dependency.
- Resolve `locale` from `vscode.env.language` when the host creates the catalog message. Add a pure
  date-presentation helper in `src/common/` that accepts a `Date` and locale, and formats it with
  `Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" })`. It is a presentation
  helper, distinct from the persisted ISO date arithmetic in [dates.ts](../../src/common/dates.ts);
  it must not change stored `YYYY-MM-DD` values.
- In response to the first `ready`,
  [GanttEditorController](../../src/views/editor/ganttEditorController.ts) posts the catalog and
  then calls `sendInit()`. A controller-owned session flag makes later `ready` messages no-ops. The
  webview holds its normal UI render until it has received both the catalog and `init`, eliminating
  a source-text or key flash.
- No changes to `WebviewToHostMessage`; the webview does not request the catalog explicitly — it
  arrives unsolicited alongside `init`.
- This bridge is independent of entity-message generalization. Any later protocol rebase preserves
  this host-to-webview variant and the catalog-before-`init` ordering.

## 7. UX

- Edit form: every visible or assistive label resolves through the webview accessor rather than a
  literal string, per NFR-1. This includes field labels, option labels, empty states, and validation
  messages. Its scheduled-date outputs use the shared UTC short-date formatter with the catalog
  locale. Native `<input type="date">` values remain ISO calendar dates. The accessor is called with
  each label's English source message, for example `t("Save")` and `t("Close")`.
- Timeline (ECharts): every user-visible chart string resolves through the same accessor. Tooltip
  dates use the shared UTC short-date formatter with the catalog locale.
- Sidebar tree: all literal tree-facing strings use direct host `vscode.l10n.t()` calls, rather than
  the webview catalog. Its group, task, and milestone date descriptions use the same shared UTC
  short-date formatter with `vscode.env.language`; replace its private `Intl.DateTimeFormat`
  implementation. The tree must not depend on a webview session or receive `l10nCatalog` messages.
- Icon policy (design terms): the **value** is a focused, native-feeling form. The **principle** is
  that secondary, repeatable controls can be compact while consequential commands explain
  themselves. The **move** is an icon-only `close` button in the header, icon-only `add` beside the
  dependency selectors, icon-only `trash` for each dependency, and icon-only `remove` for each owned
  entity's ungroup action. Each uses a localized `aria-label` and hover tooltip. `Save` and `Delete`
  retain localized text in the footer.
- Codicon build: add `@vscode/codicons` as a webview dependency; import its CSS from the webview
  entry point; configure esbuild's `.ttf` file loader so the font is emitted to `dist/`; and include
  the generated webview stylesheet with a nonce-bearing, `asWebviewUri`-resolved link. No CDN or
  Node API reaches the browser bundle.

## 8. Test Strategy

- Unit (host): test the catalog builder with an injected default-bundle reader and localizer. Assert
  that every delivered key comes from the default bundle and produces one localization call without
  requiring a live VS Code locale.
- Unit (webview): test source-key lookup, missing-key fallback, positional formatting, missing
  interpolation values, catalog caching, catalog locale handling, and render deferral until catalog
  plus `init` arrive.
- Unit (common): test the shared date formatter with an explicit locale and UTC instant. Assert that
  it does not change the calendar day at a local-time boundary.
- Unit (sidebar): inject or provide a deterministic locale and assert group, task, and milestone
  descriptions use the shared formatter rather than an independent `Intl.DateTimeFormat` call.
- Integration (editor/webview handshake): assert the first `ready` produces catalog then `init` and
  that duplicate `ready`, `editEntity`, and `selectEntity` activity produces no second catalog or
  `init` message.
- Webview interaction: assert each named icon-only action has its expected codicon class, localized
  accessible name, and tooltip; assert `Save` and `Delete` retain visible localized text.
- Webview interaction: assert form outputs and chart tooltips use the catalog locale and shared
  formatter, not `toISOString()`.
- Build: assert the production bundle emits a codicon font under `dist/` and the generated
  stylesheet refers to that local asset without an external URL.
- Coverage: branch coverage stays at or above 90%, including missing keys, missing formatting
  values, duplicate readiness, and render deferral.

## 9. Risks & Open Questions

- 🟡 Medium — future settings webview — [UI-integration.md](../requirements/UI-integration.md)
  Section 9 must decide whether settings share this panel. **Treatment**: a dedicated settings
  webview uses this same catalog protocol and registry; it does not alter this editor-session
  contract.
- 🟢 Low — protocol rebase — a future entity-protocol refactor may touch
  [protocol.ts](../../src/common/protocol.ts). **Treatment**: retain the catalog variant and its
  ordering test while resolving that refactor's merge conflict.
- 🟢 Low — codicon package updates — an upstream package asset-path change can break emitted font
  URLs. **Treatment**: keep the production asset-emission test and update the esbuild loader/import
  as part of the dependency update.
- 🟢 Low — locale coverage — some `vscode.env.language` values may be nonstandard or unavailable to
  `Intl.DateTimeFormat`. **Treatment**: pass the locale directly to `Intl` and fall back to its
  runtime default if it rejects the requested tag; cover this fallback in the shared formatter test.
- 🟢 Low — catalog completeness — a webview source message omitted from the default bundle falls
  back to English at runtime. **Treatment**: test that delivered catalog keys derive from the
  default bundle and add a lint-style check that every webview `t()` source occurs in it.
