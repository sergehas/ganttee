# Ganttee Copilot Instructions

## Project Overview

Ganttee is a **VS Code extension** that provides a Gantt chart editor. It lets
users manage tasks, groups, milestones, and dependencies (e.g. "start after",
"start with"), with resource assignment planned for a later phase. The extension
contributes a custom editor for `.ganttee` files (an interactive Gantt timeline)
and a sidebar tree of tasks/groups/milestones. Double-clicking a task in the
timeline opens an edit form.

This is a standalone extension — **not** the VS Code core repository. There is no
`src/vs/`, no Electron, and no internal service DI container. Prefer the public
`vscode` extension API. User-facing strings are localized (see below).

## Tech Stack

- **TypeScript** (strict), bundled with **esbuild** ([esbuild.js](../esbuild.js)).
- **Extension host**: Node, entry [src/extension.ts](../src/extension.ts) → `dist/extension.js`.
- **Webview UI**: **React 18** + **Apache ECharts** (custom-series Gantt),
  entry [src/webview/index.tsx](../src/webview/index.tsx) → `dist/webview.js`/`dist/webview.css`.
- **Tests**: Mocha via `@vscode/test-cli` (`suite`/`test` + `assert`).

## Architecture & Layers

The on-disk `.ganttee` **TextDocument is the single source of truth**. Edits flow
one way: UI/command → controller applies a `WorkspaceEdit` → document re-parses →
new model is rebroadcast to the webview and the tree.

| Layer               | Folder                   | Rules                                                                                              |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| Domain models       | `src/common/models/`     | Pure types. **No** `vscode`, DOM, or Node imports. Shared host+webview.                            |
| Message protocol    | `src/common/protocol.ts` | Typed host↔webview messages. Pure.                                                                 |
| Services            | `src/services/`          | Pure logic (parse/validate, dependency graph). **No** `vscode` imports.                            |
| Active-editor store | `src/ganttStore.ts`      | Tracks the focused Gantt editor.                                                                   |
| Editor host         | `src/views/editor/`      | `CustomTextEditorProvider` + controller. `vscode` only.                                            |
| Sidebar             | `src/views/sidebar/`     | `TreeDataProvider`. `vscode` only.                                                                 |
| Webview UI          | `src/webview/`           | React + ECharts. **Browser only** — no `vscode`/Node imports. Talks to the host via `postMessage`. |

Keep `common/` and `services/` free of `vscode` so they can be unit-tested and
imported by the browser webview.

## Build & Validate

Always type-check and lint before declaring work complete. Do not run tests with
compilation errors outstanding.

- Type-check (host + webview): `npm run check-types`
- Lint: `npm run lint`
- Build both bundles: `node esbuild.js` (or `npm run compile`)
- Run tests: `npm test`
- Production build: `npm run package`
- Watch (background task): the `watch` task runs `watch:tsc` + `watch:esbuild`.

The webview has its own TS project ([tsconfig.webview.json](../tsconfig.webview.json),
DOM + JSX); the host project ([tsconfig.json](../tsconfig.json)) excludes
`src/webview`. `check-types` runs both.

## Conventions

- Indent with **spaces**. Use **double quotes** (Prettier default, matches the
  scaffold). See [coding-guidelines](instructions/coding-guidelines.instructions.md).
- **Localization is mandatory:** externalize every user-facing string via the
  localization framework (`vscode.l10n.t()` / `nls.localize()`), using `{0}`
  placeholders — never string concatenation.
- **JSDoc is mandatory** on every class, method, and member (public and private).
- **Branch coverage must stay ≥ 90%.**
- **Code design (DRY/SOLID):** apply the principles in
  [code-design-principles](instructions/code-design-principles.instructions.md)
  pragmatically — keep pure logic in `services/`, inject dependencies, and avoid
  premature abstraction.
- **Reporting issues/risks/questions:** when an agent or skill reports issues,
  findings, risks, or open questions, use the shared severity scale in
  [reporting-standard](instructions/reporting-standard.instructions.md) (🟣
  critical → 🔵 nice to have, in that order). Terminal verdicts are unchanged.
  -
- Register every disposable on `context.subscriptions` or a `Disposable` you own.
- Webview CSP uses a per-render nonce; only load scripts/styles from `dist/`.
- CSS: extension webviews receive `--vscode-*` **theme color** variables. The
  design-system **size** tokens (spacing/radius/font-size) are **not** injected
  into extension webviews — use them only with a px fallback, or use on-scale px.

## Working With Specs & Quality

Use the customization set in this folder:

- Write feature specs with the `ganttee-feature-spec` skill and follow
  [feature-spec.instructions.md](instructions/feature-spec.instructions.md).
- Delegate spec drafting to the **Spec Writer** agent, layering/boundary checks to
  the **Architecture Guard** agent, and test planning to the **Test Planner** agent.
- Before merging, run the `release-readiness` skill checklist.

## Inherited Instructions (VS Code core)

Some files under `instructions/` and `skills/` were inherited from the VS Code
core repo and describe internal APIs that do **not** exist in a standalone
extension (`best-practices` toolbars/`ResourceLabel`, `observables`,
`accessibility` `AccessibleContentProvider`, and the design **size** tokens).
Apply their general spirit, but ignore references to internal `vs/*` modules that
are unavailable here.
