---
description:
  "Use when implementing accessibility in Ganttee — ARIA roles/labels in webview React components,
  keyboard operability, screen reader announcements, the ECharts timeline, sidebar tree items, and
  keybinding scoping in package.json."
applyTo: "src/webview/**,src/views/**,package.json"
---

# Accessibility Guidelines

Accessibility is a high-priority area in Ganttee. The webview is a browser surface: VS Code's
internal accessibility services (`AccessibleContentProvider`, accessibility signals, verbosity
settings) are **not** available to extensions. Use standard WAI-ARIA in the webview and the public
`vscode` API in the host.

## Keyboard Operability

- Every action reachable with a mouse MUST be reachable with the keyboard (Tab, Enter, Space,
  Escape, arrow keys in menus).
- Prefer native `<button>`, `<input>`, `<select>`. When a non-native element acts as a control, give
  it `role`, `tabIndex={0}`, and Enter/Space handling — see `TextButton.tsx`.
- Menus (`IconAction.tsx`) use `role="menu"`/`menuitem`, close on Escape, and return focus to the
  trigger.
- Dialogs (`ConfirmationDialog.tsx`) use `role="alertdialog"` with `aria-labelledby` /
  `aria-describedby`, move focus into the dialog on open, and restore it on close.

## ARIA in Webview Components

- Reuse the shared components in `src/webview/components/` (`IconButton`, `TextButton`,
  `BooleanToggleField`, `StatusNotice`, …); they already carry the correct roles and states.
- Icon-only controls MUST have a localized `aria-label`. Decorative codicons get
  `aria-hidden="true"`.
- Toggle and popup state uses `aria-pressed`, `aria-expanded`, `aria-haspopup` — never only a CSS
  class. Style state from the ARIA attribute (e.g. `&[aria-pressed="true"]`).
- Group related controls with a labeled landmark or section (`<nav aria-label>`,
  `<section aria-labelledby>`).
- All `aria-label` text is localized like any other user-facing string.

## Announcements

- Announce state changes through a live region, not by moving focus. Use `StatusNotice`:
  `role="status"` for info/warning, `role="alert"` for errors only.
- Loading placeholders set `aria-busy="true"`.
- Prevent double-speak: render one live region per message and do not re-render it with identical
  text.

## Timeline (ECharts)

- The ECharts canvas is not readable by screen readers. Enable `aria` in the chart option and keep
  the sidebar tree a complete, keyboard-navigable alternative for every task, group, and milestone.
- Tooltip color swatches are decorative (`aria-hidden="true"`); always pair color with text (e.g.
  the status name).
- Never convey state (status, critical path, selection) by color alone.

## Sidebar Tree and Host UI

- Set a meaningful `label` and, when the label alone is ambiguous, `accessibilityInformation`
  (`label`, `role`) on `TreeItem`s.
- For host-side events, use `vscode.window.showInformationMessage` / `showWarningMessage` /
  `showErrorMessage`; VS Code handles screen reader output and focus for them.

## Keybinding Scoping

Contribute keybindings in `package.json` and always scope them with a `when` clause so they do not
take over standard shortcuts:

```json
{
  "command": "ganttee.someCommand",
  "key": "alt+f7",
  "when": "activeCustomEditorId == ganttee.chartEditor"
}
```

Use `accessibilityModeEnabled` in the `when` clause for shortcuts that only make sense for screen
reader users.

## Theming and Motion

- Use `--vscode-*` theme color variables so high-contrast themes work; never hardcode colors.
- Keep a visible focus indicator (`--vscode-focusBorder`).
- Respect `prefers-reduced-motion` for animations and chart transitions.
