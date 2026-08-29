---
description: Ganttee coding guidelines — naming, style, types, strings, and code quality rules. Reference when writing or reviewing code.
applyTo: src/**
---

# Coding Guidelines

Canonical reference: https://github.com/microsoft/vscode/wiki/Coding-Guidelines

## Mandatory Requirements

These are non-negotiable and enforced in review:

1. **Localization (nls):** Every user-facing string MUST be externalized through the
   localization framework (`vscode.l10n.t()` in the extension host; `nls.localize()` where a
   bundle is used). No inline literals for user-visible text and no string concatenation — use
   `{0}` placeholders.
2. **Branch coverage ≥ 90%:** The test suite MUST keep branch coverage at or above 90%. A
   change that drops coverage below the threshold is not mergeable.
3. **Full JSDoc:** Every class, interface, enum, method, function, and member — **public and
   private** — MUST carry a JSDoc comment describing its purpose.
4. **Cyclomatic complexity ≤ 15:** Every function and method MUST have a cyclomatic
   complexity of 15 or less. Refactor higher-complexity code (extract helpers, use lookup tables
   , simplify branching) before merging.
5. **Class size ≤ 600 lines:** Every class MUST be no more than 600 lines long. Split larger
   classes into focused collaborators or extract cohesive responsibilities before merging.

## Indentation

Use spaces, not tabs. Width is enforced by Prettier.

## Naming

- PascalCase for types and enum values
- camelCase for functions, methods, properties, and local variables
- Use whole words when possible

## Types

- Do not export types or functions unless shared across multiple components
- Do not introduce new types or values to the global namespace
- Exported functions take named domain types — no inline anonymous shapes
- No boolean flag parameters; use intent-named functions instead
- Report findings as a list of discriminated records, never parallel id arrays

## Dates

- All date math goes through `src/common/dates.ts`. Never build a `Date` from an
  ISO string elsewhere — local-midnight parsing drifts across DST.

## Comments

- **Mandatory:** every class, interface, enum, method, function, and member (public **and**
  private) MUST have a JSDoc comment. See [Mandatory Requirements](#mandatory-requirements).
- Keep each JSDoc focused: state the purpose in 1–2 short sentences. Do not restate the
  signature, enumerate every branch, or explain parameters that are already obvious from their
  names/types.
- Document non-obvious parameters, return values, thrown errors, and side effects with the
  appropriate `@param`, `@returns`, and `@throws` tags.
- Inline comments inside a method body: at most 1 line, and only for a genuine workaround/hack, a
  non-obvious ordering constraint, or a surprising side effect. Never narrate the next statement
  (e.g. `// Expand the variable`, `// loop over args`).
- Never justify a design decision or name a principle in JSDoc — the rationale belongs in the
  commit message, not the source.

## Strings

- Quote style is owned by Prettier (`npm run format`), not by review
- **Mandatory:** every user-visible string MUST be externalized via the localization framework
  (`vscode.l10n.t()` / `nls.localize()`) — no string concatenation, use `{0}` placeholders.
- Every `l10n.t()` key exists in `l10n/bundle.l10n.json`, and the bundle carries no orphans.

## UI Labels

- Title case for command labels, buttons, and menu items (each major word capitalized)
- Don't capitalize prepositions of four or fewer letters unless first or last word
- Sentence case for view titles/headings (only first word capitalized), no trailing period

## Style

- Arrow functions over anonymous function expressions
- Always surround loop and conditional bodies with curly braces
- Prefer `export function x(…) {…}` over `export const x = (…) => {…}` at top-level scope (better stack traces)
- Everything else about layout — indentation, quotes, arrow parens, brace placement, wrapping
  — is owned by Prettier. Run `npm run format`; `npm run compile` verifies it.

## Code Quality

- Include Microsoft copyright header in all files
- Prefer `async`/`await` over `Promise.then()`
- For React webview code, keep components declarative and move branching
  business logic into hooks or pure helpers backed by tests.
- Localize all user-facing messages (mandatory — see [Mandatory Requirements](#mandatory-requirements))
- Keep branch coverage ≥ 90% (mandatory — see [Mandatory Requirements](#mandatory-requirements) and the test guidelines)
- Keep cyclomatic complexity ≤ 15 per function/method (mandatory — see [Mandatory Requirements](#mandatory-requirements))
- Document every class, method, and member with JSDoc (mandatory — see [Mandatory Requirements](#mandatory-requirements))
- Prefer named regex capture groups over numbered ones
- Do not use `any` or `unknown` unless absolutely necessary
- Register disposables immediately after creation — use `DisposableStore`, `MutableDisposable`, or `this._register()`
- Declare service dependencies in constructors via DI — never access services through `IInstantiationService` elsewhere. In particular, do **not** lazily resolve a service with `this.instantiationService.invokeFunction(accessor => accessor.get(ISomeService))`; add `@ISomeService` as a constructor parameter instead. If a constructor cycle prevents direct injection, break the cycle (e.g. pass the dependency into an `init()`/wiring method from the orchestrator, or relocate the call) rather than reaching through `invokeFunction`/`accessor.get`.
- Use `IEditorService` to open editors, not `IEditorGroupsService.activeGroup.openEditor`
- Avoid `bind()`/`call()`/`apply()` solely for `this` — prefer arrow functions
- Avoid events for control flow between components — prefer direct method calls
