# Dependency Injection Findings

![Status: Intent](https://img.shields.io/badge/status-Intent-ADB5BD?style=for-the-badge)

> [!IMPORTANT]
>
> **For AI agents:** This document is context only, not an implementation specification. Do not
> implement from it, derive implementation tasks or acceptance criteria from it, or change code
> based on it. The Spec Implementer must act only on a corresponding reviewed feature specification.

## Status

Intent. This document supports a future `Draft` feature specification. The `Intent` state remains
roadmap-only. This document proposes no implementation. The full research, with sources, is in
[research.md](./research.md).

## Summary

**Recommendation: typed-inject**, ideally reached through a **Pure DI first** step.

**Key constraint:** esbuild cannot emit `emitDecoratorMetadata`, and decorators are off in every
tsconfig. So reflection-based libraries (TypeDI, tsyringe, InversifyJS auto-wiring) need an explicit
`@inject(token)` on every parameter, or an extra compiler plugin. They can also behave differently
in `tsc`-built tests and in esbuild bundles.

**Baseline:** `activate()` is already a hand-made composition root that uses constructor injection.
But it has no abstractions, `services/` contains only free functions, and the controller calls
`vscode.window`, `vscode.workspace` and `vscode.commands` directly. The guidance conflicts:
`copilot-instructions.md` says "no DI container", while the inherited `coding-guidelines` says
`@ISomeService`.

| Option                   | Verdict                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **typed-inject**         | Best fit. No decorators, compile-time missing-dependency errors, ~1.3 kB, `static inject` keeps services library-free, async `dispose()`, child injectors per panel |
| **Pure DI** (no library) | Lowest-risk first step (GitLens does this). Moving to typed-inject later costs almost nothing                                                                       |
| **@needle-di/core**      | TC39 standard decorators + `inject()`, no reflection, 2.7 kB. No disposal API, and services import the library                                                      |
| **InversifyJS 8**        | Most widely used and actively maintained (Theia, vscode-jupyter). But 20.7 kB, legacy decorators + reflect-metadata, ESM-only                                       |
| **tsyringe**             | Small, but legacy decorators, and no release since April 2025                                                                                                       |
| ❌ Avoid                 | TypeDI (no release since 2021), @wessberg/di (dormant), Awilix CLASSIC mode                                                                                         |

**Guardrails:**

- Keep the container in `extension.ts` only.
- Keep React context for the webview.
- Put `vscode.*` calls behind adapters.
- Record the decision in ADR 0006, and resolve the guidance conflict there.

## Problem

Ganttee wants to introduce object-oriented design, starting with dependency injection (DI). The code
already passes dependencies through constructors, but it has no abstractions to substitute in tests
or to scope per editor panel.

## Current Repository Anchors

- `src/extension.ts:18-36` builds the object graph by hand in `activate()`. `registerCommands`
  (`:42-237`) registers 16 command closures that reach the editor through `store.active`.
- `src/views/editor/ganttEditorProvider.ts:23-36` uses a static `register` factory. It shares one
  `DocumentEditQueue` between two provider instances.
- `src/views/editor/ganttEditorProvider.ts:70-101` creates one `GanttEditorController` per webview
  panel. This is a candidate for a per-panel child scope.
- `src/views/editor/ganttEditorController.ts:27-70` imports about 15 service free functions. `:107`,
  `:157`, `:587`, `:656` and `:677` call `vscode.*` namespaces directly.
- `src/services/**` contains no service classes. The only classes are error types.
- `src/common/models/**` contains immutable domain classes (`ProjectModel`, `Task`, `Milestone`,
  `Group`, `ProjectDependencyGraph`).
- `src/webview/vscodeApi.ts:15` holds the only module singleton (`acquireVsCodeApi()`).
  `src/webview/l10n.ts:28` passes localization through React context.
- No ADR and no spec (including `in-memory-oo-model`) records a DI decision.

## Constraints

- **Decorators:** `tsconfig.json` and `tsconfig.webview.json` do not set `experimentalDecorators` or
  `emitDecoratorMetadata`. esbuild does not support `emitDecoratorMetadata`.
- **Standards:** TC39 standard decorators do not support parameter decorators. The parameter
  decorators proposal is at Stage 1.
- **TypeScript:** ADR 0003 pins TypeScript 6.x. TypeScript 6 does not deprecate the legacy decorator
  flags, and TypeScript 7 supports them.
- **Build parity:** tests compile with `tsc` + `tsc-alias`, and bundles compile with esbuild. If
  decorator metadata were enabled, tests and bundles would behave differently.
- **Layer boundaries:** `src/common/**` and `src/services/**` must not import `vscode`, Node or DOM
  globals, because the browser webview uses them. A DI library imported there also ships in the
  webview bundle.
- **Single source of truth:** the `.ganttee` `TextDocument` remains the single source of truth. DI
  must not bypass the `WorkspaceEdit` flow.
- **Tests:** `writing-tests.instructions.md` requires injectable dependencies instead of stubbed
  globals. Branch coverage must stay at or above 90 percent per file.
- **Bundle size:** `vsce package --no-dependencies` means that esbuild bundles every runtime
  dependency.
- **No premature abstraction:** `code-design-principles.instructions.md` requires seams only where
  change already happens.

## Candidate Options

Ranked for Ganttee. See [research.md](./research.md) for the full comparison.

1. **typed-inject:** no decorators, compile-time errors for missing dependencies, same behavior
   under `tsc` and esbuild, about 1.3 kB, async disposal, child injectors.
2. **Pure DI (no library):** interfaces, adapters and a hand-written composition root. Lowest risk.
   A later move to typed-inject keeps the constructor signatures.
3. **@needle-di/core:** standard decorators and `inject()` default parameters, no reflection, about
   2.7 kB. No disposal API was found, and services must import the library.
4. **InversifyJS 8:** the richest feature set and most active maintenance. Needs legacy decorators,
   `reflect-metadata`, an explicit `@inject` on every parameter under esbuild, and about 20.7 kB.
   ESM-only.
5. **tsyringe:** about 4.0 kB, with disposal and container scopes. Needs legacy decorators and
   `reflect-metadata`. No release since April 2025.
6. **Do not use:** TypeDI (unmaintained since 2021), @wessberg/di (dormant, needs a custom
   transformer), Awilix CLASSIC mode and `loadModules` (break under minification and bundlers).

## Open Questions

- 🔴 **Q-01** — Which DI approach must Ganttee adopt: typed-inject, Pure DI first, @needle-di/core
  or InversifyJS 8?
  - Status: **Open**
- 🔴 **Q-02** — How must the conflict between `copilot-instructions.md` ("no internal service DI
  container") and `coding-guidelines.instructions.md` (`@ISomeService` constructor parameters) be
  resolved?
  - Status: **Open**
- 🔴 **Q-03** — Does the DI decision meet the ADR bar? If it does, record it as ADR 0006.
  - Status: **Open**
- 🟡 **Q-04** — In what order must the `services/` free functions become classes behind interfaces?
  - Status: **Open**
- 🟡 **Q-05** — Which `vscode.*` APIs must adapters wrap (for example notifications, workspace edits
  and commands)?
  - Status: **Open**
- 🟡 **Q-06** — How do we make sure that `tsc`-built tests and esbuild bundles resolve dependencies
  in the same way?
  - Status: **Open**
- 🟡 **Q-07** — Must each `GanttEditorController` panel get its own child scope?
  - Status: **Open**
- 🟢 **Q-08** — Must DI enter the webview, or does React context stay the only mechanism there?
  - Status: **Open**

## Suggested Draft Scope

The future spec should define:

1. The selected DI approach and the composition root in `src/extension.ts`.
2. The interfaces and adapters for the `vscode.*` APIs that views use.
3. The conversion of `services/` free functions into injectable classes, in order.
4. Lifetimes: singletons for the host, and child scopes per editor panel.
5. Disposal through `context.subscriptions`.
6. Updated guidance in `copilot-instructions.md` and `coding-guidelines.instructions.md`.
7. A test strategy that uses injected fakes and keeps branch coverage at or above 90 percent.

## Next Step

Draft a feature specification with the Spec Writer agent.
