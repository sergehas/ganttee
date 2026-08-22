---
Status: Intend
Owner: Copilot
Last updated: 2026-08-15
---

# Feature: l10n Bridge & Webview Codicon Adoption

![Status: Intend](https://img.shields.io/badge/status-Intend-ADB5BD?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The editor webview cannot call `vscode.l10n` directly, so form strings today are
hardcoded English (US), for example the `Close`, `Save`, and `Delete` labels in
[TaskForm.tsx](../../src/webview/TaskForm.tsx). [UI-integration.md](../requirements/UI-integration.md)
(NFR-1, NFR-6) requires a host-resolved string catalog delivered to the webview
once per session, with no hardcoded user-facing English left in the webview.
This spec defines that l10n bridge mechanism plus adoption of the
`@vscode/codicons` icon set in the webview so its iconography (add/edit/delete/
refresh) matches the same actions already expressed as `$(add)`, `$(edit)`,
`$(trash)`, `$(refresh)` in [package.json](../../package.json) commands.

## 2. Goals / Non-goals

### Goals

- Resolve all webview-facing strings on the host via `vscode.l10n.t()` and
  deliver them to the webview as a single catalog.
- Send the catalog once per webview session, alongside the existing
  `init`/`ready` handshake, and never re-request it on subsequent form opens.
- Define a webview-side cache and accessor/hook with an explicit fallback
  behavior for a missing key.
- Establish a lightweight convention so a feature spec can introduce new
  string keys without re-plumbing the bridge mechanism itself.
- Adopt `@vscode/codicons` in the webview, bundled into `dist/` (CSP-safe, no
  CDN), so webview icon actions match the native VS Code icon used for the
  same command where one exists.

### Non-goals

- Concrete per-entity message fields and the generalized entity protocol —
  owned by [Editable Work Item Kinds](editable-all-task-kinds.md).
- Whether settings use the shared editor webview or a dedicated webview — open
  question owned by [UI-integration.md](../requirements/UI-integration.md)
  (Section 9).
- The full field-type component catalog (date-range, color picker, etc.) from
  UI-integration FR-2.
- New translation/language infrastructure or additional `l10n` bundles beyond
  what `vscode.l10n` already provides.
- An exhaustive, icon-by-icon mapping table for every current and future
  webview action.

## 3. User Stories

- As a non-English-speaking user, I want every label in the edit form to
  respect my VS Code display language, so that the webview feels consistent
  with the rest of the editor.
- As a Ganttee contributor adding a new form field, I want to introduce a new
  localized string without touching the message-protocol plumbing, so that
  localization stays low-friction.
- As a VS Code user familiar with the Explorer tree's add/edit/delete/refresh
  icons, I want the same icon shapes in the webview form, so that the same
  action looks the same everywhere in the product.

## 4. Acceptance Criteria

- Given a webview session that has just sent `ready`
  When the host responds
  Then it sends exactly one string-catalog message in addition to `init`, and
  no further catalog message is sent for the lifetime of that webview session.

- Given the webview has already received the string catalog
  When the user opens, closes, and reopens an edit form multiple times in the
  same session
  Then no additional catalog request or catalog message is exchanged; the
  cached catalog is reused.

- Given the webview requests a string key that is absent from the delivered
  catalog
  When the accessor/hook resolves that key
  Then it returns a defined, non-throwing fallback (the key itself) and does
  not crash the render.

- Given a new feature spec introduces a new user-facing string
  When the host registers the new key with its `vscode.l10n.t()` source string
  Then the string reaches the webview through the existing catalog message on
  the next session without any change to `HostToWebviewMessage`/
  `WebviewToHostMessage` shapes or the handshake sequence.

- Given the webview renders an add, edit, delete, or refresh action that has a
  native VS Code command icon in [package.json](../../package.json)
  (`$(add)`, `$(edit)`, `$(trash)`, `$(refresh)`)
  Then the webview renders the corresponding `@vscode/codicons` glyph instead
  of an ad hoc SVG or emoji, so the action reads as the same icon in both
  places.

- Given the webview bundle is built for production
  When the codicon font/asset is resolved at runtime
  Then it loads from `dist/` under the existing per-render CSP nonce, with no
  external/CDN request.

## 5. Domain & Data Model Impact

- No new or changed types in `src/common/models/`.
- No `.ganttee` schema change; no `CURRENT_DOCUMENT_VERSION` bump. This is
  pure UI/host-webview plumbing with no effect on persisted documents.

## 6. Protocol Impact

- New `HostToWebviewMessage` variant carrying a resolved string catalog
  (candidate shape: `{ type: "l10nCatalog", strings: Record<string, string> }`),
  added to [protocol.ts](../../src/common/protocol.ts) alongside `init`.
- Sent once by [GanttEditorController](../../src/views/editor/ganttEditorController.ts)
  in response to the existing `ready` message (the same point `sendInit()` is
  currently invoked from `handleMessage`), not on every `editEntity`/
  `selectEntity` round-trip.
- No changes to `WebviewToHostMessage`; the webview does not request the
  catalog explicitly — it arrives unsolicited alongside `init`.
- The exact key-naming convention (flat vs. namespaced keys) and the registry
  mechanism for feature specs to add keys are implementation detail for the
  implementing PR, not fixed by this spec.

## 7. UX

- Edit form: every visible label (`Close`, `Save`, `Delete`, field labels)
  resolves through the webview's l10n accessor/hook instead of a literal
  string, per NFR-1.
- Timeline (ECharts): no change; timeline chrome is not currently a source of
  hardcoded strings in scope here.
- Sidebar tree: no change; tree item titles already localize via
  `package.nls.json`/`vscode.l10n` on the host and are unaffected.
- Icon consistency (design terms): the **value** is a coherent, native-feeling
  product — the same action should look the same whether it is triggered from
  the Explorer tree's inline command icon or the webview form. The
  **principle** is icon parity with the platform vocabulary rather than
  inventing a second visual language. The **move** is adopting
  `@vscode/codicons` glyphs (the same glyph set backing `$(add)`, `$(edit)`,
  `$(trash)`, `$(refresh)`) inside the webview instead of ad hoc SVGs or
  emoji, so add/edit/delete/refresh read identically across both surfaces.
- CSP: codicon font/CSS assets are bundled into `dist/` at build time and
  referenced only from there, preserving the existing per-render nonce policy
  (NFR-5) with no CDN dependency.

## 8. Test Strategy

- Unit (host): a resolver test for the host-side catalog builder, asserting it
  returns the expected key→localized-string map and that `vscode.l10n.t()` is
  invoked per registered key.
- Unit (webview): tests for the string cache/hook covering (a) a missing key
  returns the defined fallback without throwing, and (b) re-rendering or
  reopening a form does not trigger a second catalog fetch/request once a
  catalog is cached.
- Integration (editor/webview handshake): one test asserting the webview
  session receives exactly one catalog message for the lifetime of the panel,
  regardless of how many times `editEntity`/`selectEntity` messages follow.
- Coverage: branch coverage stays ≥ 90%, including the missing-key fallback
  branch and the no-recatalog-on-rerender branch.

## 9. Risks & Open Questions

- 🔴 High — bridge scope — the concrete key-naming/registry convention (how a
  feature spec "registers" a key without touching plumbing) is left at
  intent-level here and must be nailed down before implementation starts, to
  avoid ad hoc conventions per PR.
- 🟡 Medium — [UI-integration.md](../requirements/UI-integration.md) Section 9
  — whether settings forms share this webview/bridge or get a dedicated
  webview and catalog is an open question owned by that document, not this
  spec.
- 🟡 Medium — [editable-all-task-kinds.md](editable-all-task-kinds.md) — the
  generalized, entity-generic protocol shape is owned there; this spec
  assumes the catalog message can be added independently of that
  generalization.
- 🟢 Low — codicon bundling — confirm the exact build step (esbuild loader or
  copy step) needed to get the codicon font/CSS into `dist/` without adding a
  runtime dependency on Node APIs in the webview bundle.
