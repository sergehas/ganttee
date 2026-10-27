# Vitest Test Backbone Findings

> [!IMPORTANT]
>
> **For AI agents:** This document is context only, not an implementation specification. Do not
> implement from it, derive implementation tasks or acceptance criteria from it, or change code
> based on it. The Spec Implementer must act only on a corresponding reviewed feature specification.

## Status

Intent. This document supports a future `Draft` feature specification. The `Intent` state remains
roadmap-only; no implementation is proposed by this document.

## Problem

Ganttee currently runs pure unit and integration tests through the VS Code extension test launcher,
while smoke tests exercise the real VS Code extension host. The pure tests do not need Electron or
the `vscode` API, so they incur unnecessary startup and test-runner overhead.

## Proposed Direction

Use a hybrid test backbone:

- Vitest for pure unit tests under `src/test/unit/`.
- Vitest for pure integration tests under `src/test/integration/`.
- `@vscode/test-cli` for smoke tests under `src/test/smoke/`.

The smoke tests must continue to run in the VS Code extension host because they use
`vscode.commands`, `vscode.workspace`, document events, and custom-editor activation.

## Current Repository Anchors

- `package.json` runs `vscode-test` for unit tests and direct `mocha` for integration tests.
- `.vscode-test.mjs` launches compiled unit tests through `@vscode/test-cli`.
- `.vscode-test-smoke.mjs` launches compiled smoke tests in VS Code Insiders.
- `.mocharc.integration.json` runs compiled integration tests with Mocha's TDD interface.
- `tsconfig.json` defines the `@common/*`, `@services/*`, `@webview/*`, and `@views/*` aliases and
  includes Mocha types.
- `src/test/smoke/` imports the VS Code API; the unit and integration suites are Node-only.
- `scripts/check-coverage.mjs` must be checked before changing coverage output.

## Migration Constraints

- Vitest needs equivalent resolution for the existing TypeScript path aliases.
- Running TypeScript directly with Vitest may change fixture paths that currently assume execution
  from `out/test`.
- Mocha globals and lifecycle names must be rewritten or isolated by test suite.
- Smoke-test compilation and the VS Code launch path must remain intact.
- Coverage thresholds must remain at least 90 percent branch coverage.
- The migration must not introduce `vscode` or Node imports into common services that are also used
  by the webview.

## Upstream Findings

As checked on September 14, 2026:

- The Microsoft `microsoft/vscode-test` repository uses Vitest for its own library tests and
  includes a `vitest.config.ts`.
- Its public `runTests` API still launches VS Code for extension tests; this is not a Vitest-backed
  extension-host runner.
- The Microsoft `microsoft/vscode-test-cli` repository documents that tests launched by the CLI run
  in Mocha.
- The `vscode-test-cli` issue search showed no open Vitest integration issue.
- The relevant `vscode-test` issue search showed no announced roadmap item for replacing the
  extension-test Mocha runner with Vitest.

Sources:

- <https://github.com/microsoft/vscode-test>
- <https://github.com/microsoft/vscode-test/blob/main/vitest.config.ts>
- <https://github.com/microsoft/vscode-test-cli>
- <https://github.com/microsoft/vscode-test-cli/issues?q=is%3Aissue+vitest>
- <https://github.com/microsoft/vscode-test/issues?q=is%3Aissue+vitest+extension>

## Suggested Draft Scope

The future spec should define:

1. Vitest configuration for Node-only source tests.
2. Test scripts and file ownership for Vitest versus `vscode-test`.
3. Alias and fixture-path resolution.
4. Coverage reporting and integration with `check-coverage.mjs`.
5. Removal or isolation of Mocha dependencies used only by migrated tests.
6. A compatibility check proving that smoke tests still run in VS Code Electron through
   `@vscode/test-cli`.

## Deferred Decision

Decide during the `Draft` phase whether Vitest should run TypeScript source files directly or run
compiled test output. Direct source execution is the simpler long-term model, but fixture paths and
alias configuration must be made explicit first.
