# Ganttee Extension Quickstart

## What's in the folder

**Ganttee** is a VS Code extension that provides an interactive Gantt chart editor for `.ganttee` files. It combines a custom editor (webview UI with React + ECharts) and a sidebar task explorer.

- `package.json` — extension manifest, declaring the custom editor type (`ganttee.chartEditor`), sidebar views, and commands.
- `src/extension.ts` — extension host entry point; registers the custom editor provider, sidebar tree view, and commands.
- `src/views/editor/` — `CustomTextEditorProvider` and editor controller for `.ganttee` files.
- `src/views/sidebar/` — sidebar tree view provider for the task explorer.
- `src/webview/` — React UI (webview) bundled separately; handles rendering the Gantt chart via ECharts and user interactions.
- `src/common/` — shared domain models and protocol types (host ↔ webview messaging).
- `src/services/` — pure logic: document parsing, validation, dependency graph resolution.

## Setup

1. Install dependencies: `npm install`
2. Install the recommended VS Code extensions: ESLint, Test Runner.

## Get up and running

- Press `F5` to launch the extension in a new VS Code window.
- Open or create a `.ganttee` file; it will open in the Gantt editor.
- Use the sidebar **Ganttee** view to browse tasks, groups, and milestones.
- Set breakpoints in `src/extension.ts` or webview code in `src/webview/` to debug.
- Find extension host output in the Debug Console.

## Build & Validate

- **Type-check** (host + webview): `npm run check-types`
- **Lint**: `npm run lint`
- **Build** both bundles: `npm run compile` (or `node esbuild.js`)
- **Run tests**: `npm test` (Mocha via `@vscode/test-cli`)
- **Watch mode** (background): Ctrl+Shift+B or run the `watch` task to auto-rebuild on changes.

## Make changes

- Edit `src/extension.ts` (host logic) or `src/webview/` (UI).
- Rebuild with `npm run compile` or enable the watch task.
- Reload the extension window with `Ctrl+R` (Cmd+R on Mac) to test.
- Webview changes require a full extension reload.

## Run tests

- Run the `watch` task (Ctrl+Shift+B) to enable test discovery.
- Open the Testing view (from the activity bar) and click Run.
- Tests are located in `src/**/test/` and match `**/*.test.ts` or `**/*.integrationTest.ts`.
- Make changes to test files and re-run; the test runner will pick them up automatically.

## Structure & Architecture

The `.ganttee` file (YAML/JSON) is the single source of truth. Edit flow: UI command → controller applies a `WorkspaceEdit` → document re-parses → new model is broadcast to webview and sidebar tree.

**Separation of concerns:**

- `common/` and `services/` are pure (no VS Code or browser APIs) — unit-testable and reusable.
- Host (`src/views/`, `src/extension.ts`) uses `vscode` APIs only.
- Webview (`src/webview/`) is browser-only; talks to host via `postMessage`.

## Localization & Conventions

- All user-facing strings use `vscode.l10n.t()` with `{0}` placeholders (never string concatenation).
- JSDoc is mandatory on every class, method, and member.
- Branch coverage must stay ≥ 90%.
- Follow Conventional Commits for git history.

## Learn more

- [Feature specs & roadmap](docs/specs/ROADMAP.md)
- [Source organization](.github/instructions/source-code-organization.instructions.md)
- [Code design principles](.github/instructions/code-design-principles.instructions.md)
- [VS Code Extension API](https://code.visualstudio.com/api)
