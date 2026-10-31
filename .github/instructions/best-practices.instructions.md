---
description:
  Ganttee best practices — reusing common UI primitives and patterns. Reference when writing or
  reviewing code.
applyTo: src/**
---

# Best Practices

## Buttons & Actions

- Don't create new button/menu markup or custom CSS in the webview. Reuse the shared components in
  `src/webview/components/` (`IconButton`, `TextButton`, `IconAction`, `Select`, `FormField`,
  `BooleanToggleField`, `ConfirmationDialog`, `StatusNotice`). This keeps theming, accessibility,
  and behavior consistent.
- Host-side actions are commands: register them in `extension.ts`, declare them under
  `contributes.commands`, and place them with `contributes.menus` (`view/title`,
  `view/item/context`, `editor/title`) scoped by `when` clauses — not by hand-rendered UI.
- Webview buttons that change the document post a `WebviewToHost` message; the host applies the
  `WorkspaceEdit`. Never mutate model state locally in the webview.

## Command Context

- Don't assume a command runs on the active editor. Commands invoked from a menu receive the
  originating `Uri` or `TreeItem` as arguments; use them first and fall back to the active Gantt
  editor from `ganttStore` only when no argument is given.
- Support multi-selection for tree commands (`canSelectMany`): the second argument holds all
  selected items.

## URI

- Compare URIs with `a.toString() === b.toString()`; never compare `fsPath` strings or `Uri`
  instances with `===`. Use `uri.toString()` as the map/set key.
- Build paths with `vscode.Uri.joinPath`, not string concatenation, so remote and virtual workspaces
  work.
- Load webview resources only through `webview.asWebviewUri` from `dist/`.

## Tree Items

- Use `ThemeIcon` (codicons) or the SVGs in `media/icons/` with light/dark variants for tree icons.
- Set `contextValue` (e.g. `ganttee.task`) so menus can target the item kind; keep it in sync with
  `package.json` `when` clauses.

## Styling

- Avoid `getComputedStyle`. If a value is needed in both SCSS and TypeScript, set it from TypeScript
  directly or through a CSS custom property via `element.style.setProperty('--my-var', value)`.
- Never anchor a `:has()` selector on `body`, `html`, or the webview root. A global `:has()` forces
  re-evaluation on nearly every DOM mutation. Toggle a class on the specific container instead and
  scope rules to it. Local `:has()` on a component element is fine.
- Use `--vscode-*` theme color variables; use design-system size tokens only with a px fallback.

## Error handling

- Handle errors at boundaries: command handlers, provider entry points, and webview message
  handlers.
- Treat expected cancellations/aborts as non-errors; return early without user-facing noise.
- Use typed/custom errors (with cause/context) for recoverable domain failures.
- Show user-facing messages only for actionable failures; keep wording localized and specific.
- Log technical details (error object plus context) to the `Ganttee` `LogOutputChannel` created in
  `extension.ts` and injected into providers/controllers — not `console`.
- Never swallow errors silently; either recover explicitly or rethrow after logging.
