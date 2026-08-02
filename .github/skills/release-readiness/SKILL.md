---
name: release-readiness
description: "Run the Ganttee pre-merge / pre-release quality gate. Use before merging a PR, cutting a release, or when asked to verify a change is ready to ship. Checks types, lint, build, tests, coverage, localization, JSDoc, and the extension manifest."
argument-hint: "optional: PR or change description"
---

# Release Readiness

A pre-merge quality gate for the Ganttee extension. Run these checks and report a
clear PASS/FAIL with the failing items.

## When to Use

- Before merging a pull request or cutting a release.
- When asked "is this ready to ship?" or to run the quality gate.

## Procedure

Run each step; stop and report on the first hard failure (types/lint/build/tests).

1. **Type-check (host + webview):** `npm run check-types` — must be clean.
2. **Lint:** `npm run lint` — must be clean.
3. **Build both bundles:** `node esbuild.js` (or `npm run compile`) — must succeed;
   for a release also run `npm run package` (production, minified).
4. **Tests:** `npm test` — all passing.
5. **Branch coverage ≥ 90%:** verify coverage; if unavailable, confirm every new
   branch (conditionals, switch cases, error paths) has a covering test.
6. **Localization:** every user-facing string is externalized via
   `vscode.l10n.t()` / `nls` and package NLS keys — no raw literals in messages,
   command titles, or view names.
7. **JSDoc:** every class, method, and member (public and private) is documented.
8. **Manifest sanity:** `contributes` (customEditors, views, commands, menus) is
   consistent with the code; `activationEvents` and `main` are correct; the
   webview CSP uses a nonce and loads only from `dist/`.
9. **Boundaries:** no `vscode`/Node imports in `common/`, `services/`, or
   `webview/` (delegate to the **Architecture Guard** agent if unsure).
10. **Changelog:** the change has an entry under `## [Unreleased]` in
    `CHANGELOG.md`.

## Output Format

A checklist with ✅/❌ per item, the exact failing command output for any ❌, and a
final verdict (unchanged): **READY** or **NOT READY** with the blocking items
listed. Rank and render those blocking items using the shared severity scale in
[reporting-standard.instructions.md](../../instructions/reporting-standard.instructions.md)
(🟣 critical → 🔵 nice to have, in that order).
