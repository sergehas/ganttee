---
description: Ganttee code design principles — DRY and SOLID applied pragmatically to the extension's layered architecture. Reference when writing, refactoring, or reviewing non-trivial code.
applyTo: src/**
---

# Code Design Principles

Apply DRY and SOLID as **guidance**, not dogma. They exist to keep the codebase
changeable — never to justify premature abstraction. When they conflict with the
"avoid over-engineering" rule (no helpers/abstractions for one-time operations,
no speculative extensibility), prefer the simplest thing that works and revisit
only when a real second use case or a real change pressure appears.

## DRY (Don't Repeat Yourself)

- Extract shared logic **after** genuine duplication appears (rule of three), not
  in anticipation of it. Two similar-looking blocks that evolve independently are
  not duplication.
- When multiple UI entry points trigger the same domain mutation, consolidate
  rule enforcement behind one typed workflow API instead of re-implementing it
  per surface.
- The `.ganttee` `TextDocument` is the single source of truth — don't cache or
  re-derive model state in parallel. Compute from the parsed model, not copies.
- Reuse the existing parse/validate/serialize helpers in `src/services/` and the
  shared types in `src/common/models/` rather than re-implementing them per view.
- Prefer one well-named function over copy-pasted variants that differ by a flag
  only when the branches share real behavior; otherwise keep them separate.

## SOLID

- **SRP (Single Responsibility):** Each module owns one reason to change. This is
  already encoded by the layer table in
  [source-code-organization](source-code-organization.instructions.md) — keep
  pure logic in `services/`, `vscode` glue in `views/`, and browser/UI concerns
  in `webview/`. Don't mix parsing, orchestration, and rendering in one unit.
- **OCP (Open/Closed):** Extend behavior by adding a case to the typed protocol
  or a new service function, not by threading conditionals through unrelated
  layers. New domain concepts are added, not retrofitted into existing types.
- **LSP (Liskov Substitution):** Subtypes and interface implementations must honor
  the contract they claim. Don't narrow inputs or throw where the base type
  promises a value; entity-kind unions must behave consistently across kinds.
- **ISP (Interface Segregation):** Keep the host↔webview contract in
  `src/common/protocol.ts` as small, purpose-specific message unions. Consumers
  should depend only on the messages/fields they use, not a god-object payload.
- **DIP (Dependency Inversion):** Depend on abstractions, not concretions. Inject
  dependencies through constructors/parameters rather than reaching for globals
  or singletons, and keep `common/`/`services/` free of `vscode` so higher layers
  depend inward on pure logic.
- In webview code, UI components depend on workflow abstractions (callbacks/hooks);
  the workflow must not depend on concrete component implementations.

## Refactor tripwires

Refactor when you hit one of these, while it is still small:

- a result type gains a 3rd parallel id array → model as discriminated records
- a function gains a 2nd boolean flag → split into intent-named functions
- the same rule exists on both sides of the host/webview boundary → hoist to `services/`
- a rule is expressed over two shapes (document and hydrated model) → pick one shape

## When principles collide

- DRY vs. clarity → prefer clarity; a little duplication beats the wrong abstraction.
- SOLID vs. simplicity → prefer simplicity for one-off code; introduce seams only
  where change is already happening.
- Any principle vs. the layer/boundary rules in
  [source-code-organization](source-code-organization.instructions.md) → the
  boundary rules win.
