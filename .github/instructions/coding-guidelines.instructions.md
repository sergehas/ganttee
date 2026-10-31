---
description:
  Ganttee coding guidelines — naming, style, types, strings, and code quality rules. Reference when
  writing or reviewing code.
applyTo: src/**
---

# Coding Guidelines

Canonical reference: https://github.com/microsoft/vscode/wiki/Coding-Guidelines

## Mandatory Requirements

These are non-negotiable and enforced in review:

1. **Localization (nls):** Every user-facing string MUST be externalized through the localization
   framework. Use `vscode.l10n.t()` in all extension host code. Do not use `nls.localize()` unless
   the file already imports from the `vscode-nls` package. In webview code, use the `@webview/l10n`
   helpers (see [Strings](#strings)). No inline literals for user-visible text and no string
   concatenation — use `{0}` placeholders.
2. **Branch coverage ≥ 90%:** The test suite MUST keep branch coverage at or above 90% **per source
   file**, as reported by `scripts/check-coverage.mjs`. A change that drops any file below the
   threshold is not mergeable, even if the overall figure stays above 90%.
3. **Meaningful JSDoc:** Every declaration in scope MUST have meaningful JSDoc. See
   [Documentation](#documentation) for the scope and the rules for source code and tests.
4. **Cyclomatic complexity ≤ 15:** Every function and method MUST have a cyclomatic complexity of 15
   or less. Refactor higher-complexity code (extract helpers, use lookup tables , simplify
   branching) before merging.
5. **Class size ≤ 600 lines:** Every class MUST be no more than 600 lines long. Split larger classes
   into focused collaborators or extract cohesive responsibilities before merging.

## Indentation

Use spaces, not tabs. Width is enforced by Prettier.

## Naming

- PascalCase for types and enum values
- camelCase for functions, methods, properties, and local variables
- Use whole words for identifiers. Abbreviate only widely used terms: `id`, `url`, `api`, `config`.

## Types

- Do not export types or functions unless they are imported by at least one other source file
  outside their own module
- Do not introduce new types or values to the global namespace
- Exported functions take named domain types — no inline anonymous shapes
- No boolean flag parameters; use intent-named functions instead
- Report findings as a list of discriminated records, never parallel id arrays

## Dates

- All date math goes through `src/common/dates.ts`. Never build a `Date` from an ISO string
  elsewhere — local-midnight parsing drifts across DST.

## Documentation

This section is the single source for JSDoc rules.

**Source code:**

- Every top-level or class-level declaration — class, interface, enum, function, method, and
  property/member (public **and** private) — plus any named callback passed as a standalone function
  MUST have a 1–2 sentence JSDoc that explains its purpose and relevant context.
- Inline arrow callbacks and local variables do not require JSDoc.

**Tests:**

- Every suite, test, and test helper needs a 1–2 sentence purpose comment. No `@` tags are required.
  A test's description may serve as the purpose for its inline callback.

**Both:**

- Keep documentation meaningful. Do not restate the signature, enumerate every branch, or explain
  details already clear from names and types. Use `@param`, `@returns`, `@throws`, and related tags
  when they clarify purpose, constraints, format, uniqueness, behavior, or side effects. A tag that
  only repeats a type or says something generic like "the identifier" is not useful.
- Inline comments inside a method body: at most 1 line, and only for a genuine workaround/hack, a
  non-obvious ordering constraint, or a surprising side effect. Never narrate the next statement
  (e.g. `// Expand the variable`, `// loop over args`).
- Never justify a design decision or name a principle in JSDoc — the rationale belongs in the commit
  message, not the source.

## Strings

- Quote style is owned by Prettier (`npm run format`), not by review
- **Mandatory:** every user-visible string MUST be externalized via the localization framework (see
  [Mandatory Requirements](#mandatory-requirements)) — no string concatenation, use `{0}`
  placeholders.
- In React webview code, get localized strings from the catalog that the extension host sends, via
  `useTranslate()` / `translate()` from `@webview/l10n`. Do not call `vscode.l10n.t()` from webview
  code.
- Every `l10n.t()` key exists in `l10n/bundle.l10n.json`, and the bundle carries no orphans.

## UI Labels

- Title case for command labels, buttons, and menu items (each major word capitalized)
- Don't capitalize prepositions of four or fewer letters unless first or last word
- Sentence case for view titles/headings (only first word capitalized), no trailing period

## Style

- Arrow functions over anonymous function expressions
- Always surround loop and conditional bodies with curly braces
- Prefer `export function x(…) {…}` over `export const x = (…) => {…}` at top-level scope (better
  stack traces)
- Everything else about layout — indentation, quotes, arrow parens, brace placement, wrapping — is
  owned by Prettier. Run `npm run format`; `npm run compile` verifies it.

## Code Quality

- Prefer `async`/`await` over `Promise.then()`
- For React webview code, keep components declarative and move branching business logic into hooks
  or pure helpers backed by tests.
- Localize all user-facing messages (mandatory — see
  [Mandatory Requirements](#mandatory-requirements))
- Keep branch coverage ≥ 90% (mandatory — see [Mandatory Requirements](#mandatory-requirements) and
  the test guidelines)
- Keep cyclomatic complexity ≤ 15 per function/method (mandatory — see
  [Mandatory Requirements](#mandatory-requirements))
- Document declarations with meaningful JSDoc (mandatory — see [Documentation](#documentation))
- Prefer named regex capture groups over numbered ones
- Do not use `any` or `unknown` unless absolutely necessary
- Register disposables immediately after creation — use `DisposableStore`, `MutableDisposable`, or
  `this._register()`
- Declare service dependencies in constructors via DI — never access services through
  `IInstantiationService` elsewhere. In particular, do **not** lazily resolve a service with
  `this.instantiationService.invokeFunction(accessor => accessor.get(ISomeService))`; add
  `@ISomeService` as a constructor parameter instead. If a constructor cycle prevents direct
  injection, break the cycle (e.g. pass the dependency into an `init()`/wiring method from the
  orchestrator, or relocate the call) rather than reaching through `invokeFunction`/`accessor.get`.
- Use `IEditorService` to open editors, not `IEditorGroupsService.activeGroup.openEditor`
- Avoid `bind()`/`call()`/`apply()` solely for `this` — prefer arrow functions
- Avoid events for control flow between components — prefer direct method calls
