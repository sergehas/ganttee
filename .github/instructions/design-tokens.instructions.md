---
description:
  Design-system sizing guidance for Ganttee webview styles. Use when writing or editing SCSS.
applyTo: src/**/*.scss
---

# Design tokens for webview styles

> **These tokens are the _moves_, not the reasoning.** They implement the **design philosophy**
> (Values → Principles → Moves): reach for a token _after_ naming the feeling and the principle it
> serves - a radius is an _elevation tier_, a font is a _type role_, not a number. See the
> [`design-philosophy` skill](../skills/design-philosophy/SKILL.md) for the full vocabulary, worked
> examples, and how to give UI feedback in design terms.

Ganttee's extension webviews receive VS Code theme color variables, but VS Code design-system size
variables are not injected. Existing SCSS uses size variables with px fallbacks, so the styles stay
valid when those variables are unavailable.

Use these rules:

- Use `--vscode-*` theme variables for colors.
- For spacing, radius, type, icon size, and stroke, prefer a known size variable with an on-scale px
  fallback. For example, use `var(--vscode-spacing-size120, 12px)`.
- If a size variable is unavailable or does not fit the role, use an on-scale px value.
- Keep structural measurements, such as data-driven chart geometry and responsive breakpoints, at
  the value the layout requires instead of forcing them onto the spacing ramp.

This repository is a standalone extension. Do not rely on VS Code core source files or core-only
style validation when changing its styles.

## Spacing — padding, margin, gap

Use for `padding`, `margin`, `gap`, and fixed `width`/`height` of spacers. The numeric token name is
the value in tenths of a px (`size200` = 20px).

| px  | Variable                    |
| --- | --------------------------- |
| 0   | `--vscode-spacing-sizeNone` |
| 2   | `--vscode-spacing-size20`   |
| 4   | `--vscode-spacing-size40`   |
| 6   | `--vscode-spacing-size60`   |
| 8   | `--vscode-spacing-size80`   |
| 10  | `--vscode-spacing-size100`  |
| 12  | `--vscode-spacing-size120`  |
| 16  | `--vscode-spacing-size160`  |
| 20  | `--vscode-spacing-size200`  |
| 24  | `--vscode-spacing-size240`  |
| 28  | `--vscode-spacing-size280`  |
| 32  | `--vscode-spacing-size320`  |
| 36  | `--vscode-spacing-size360`  |
| 40  | `--vscode-spacing-size400`  |

```scss
/* Prefer the token with a fallback. */
padding: var(--vscode-spacing-size80, 8px) var(--vscode-spacing-size120, 12px);
/* An on-scale px value is also fine. */
padding: 8px 12px;
/* Avoid off-scale values. */
padding: 5px 7px;
```

For visual spacing, values should land on the scale (0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 36,
40). Snap off-scale values (3, 5, 7, 14, 26px…) to the nearest scale value, ties rounding up:
`5px → 6px`, `3px → 4px`, `1px → 2px`, `26px → 28px`. Check each length in a shorthand independently
(`0 5px → 0 6px`). Leave structural measurements, `auto`, `%`, `em`/`rem`, and `var()`/`calc()`
expressions unchanged.

## Corner radius — `border-radius`

| px   | Variable                       | Use                         |
| ---- | ------------------------------ | --------------------------- |
| 2    | `--vscode-cornerRadius-xSmall` | very compact elements       |
| 4    | `--vscode-cornerRadius-small`  | controls (buttons, inputs)  |
| 6    | `--vscode-cornerRadius-medium` | base / inner surfaces       |
| 8    | `--vscode-cornerRadius-large`  | prominent / outer surfaces  |
| 12   | `--vscode-cornerRadius-xLarge` | very prominent surfaces     |
| 9999 | `--vscode-cornerRadius-circle` | fully rounded (pills, dots) |

**Snap map** for off-scale literals (ties round **up**): `2→xSmall`, `3,4→small`, `5,6→medium`,
`7,8→large`, `10,11,12→xLarge`, `14,16,18,20→xLarge`, `999→circle`.

- **Pills** (radius ≈ half the element height, e.g. `28h`/`14r`, `36h`/`18r`, `22×22`/`11r`) →
  `--vscode-cornerRadius-circle`, **not** xLarge. The literal-nearest token would square them and
  lose the fully-rounded intent.
- **Leave untouched:** `50%`, `0`, `0px`, `inherit`, and any `calc()`/`var()` expression. Preserve
  `!important`.

## Font size — `font-size`

Generic UI ramp — pair a **size** token with a **weight** token; "Strong" reuses the matching size
token + `fontWeight.semiBold`, **never** a separate "strong" size:

| px  | Size var                     | Weight   |
| --- | ---------------------------- | -------- |
| 26  | `--vscode-fontSize-heading1` | semiBold |
| 18  | `--vscode-fontSize-heading2` | semiBold |
| 13  | `--vscode-fontSize-heading3` | semiBold |
| 13  | `--vscode-fontSize-body1`    | regular  |
| 11  | `--vscode-fontSize-body2`    | regular  |
| 12  | `--vscode-fontSize-label1`   | regular  |
| 11  | `--vscode-fontSize-label2`   | regular  |
| 10  | `--vscode-fontSize-label3`   | regular  |

The legacy `--vscode-bodyFontSize*` tokens are deprecated. Use the generic ramp above instead:

| Deprecated                     | px  | Use instead                |
| ------------------------------ | --- | -------------------------- |
| `--vscode-bodyFontSize`        | 13  | `--vscode-fontSize-body1`  |
| `--vscode-bodyFontSize-small`  | 12  | `--vscode-fontSize-label1` |
| `--vscode-bodyFontSize-xSmall` | 11  | `--vscode-fontSize-body2`  |

## Font weight — `font-weight`

Use the **two-weight ramp** — `regular` or `semiBold` — for text styles:

| weight | Variable                       | Use                         |
| ------ | ------------------------------ | --------------------------- |
| 400    | `--vscode-fontWeight-regular`  | body, labels, metadata      |
| 600    | `--vscode-fontWeight-semiBold` | headings, "strong" emphasis |

- **No medium (500).** `font-weight: 500` is **off the ramp** — snap it to `semiBold` (600). The
  same goes for `700`/`bold` and any other numeric weight: round to the nearer of 400/600.
- **"Strong" is not a separate size.** A "Body 1 Strong" / "Label 2 Strong" style reuses the
  matching `--vscode-fontSize-*` token paired with `semiBold`. Never introduce a separate strong
  _size_ token.
- `normal` ≡ 400 → `regular`. **Leave untouched:** `inherit`, `lighter`, `bolder`, and any
  `var()`/`calc()` expression. Preserve `!important`.

```scss
/* avoid */
font-weight: 500; /* not on the 400/600 ramp */
/* prefer */
font-weight: var(--vscode-fontWeight-semiBold, 600);
```

## Codicon size — icon `font-size`

Codicons are **only ever 16px or 12px**. There is no in-between size — never use `14px` (or any
other value) for a codicon. Pick the base or the compact token:

| px  | Variable                           | Use                 |
| --- | ---------------------------------- | ------------------- |
| 16  | `--vscode-codiconFontSize` (base)  | default icon size   |
| 12  | `--vscode-codiconFontSize-compact` | dense/inline chrome |

If a design or existing CSS sizes a codicon at 14px, treat it as a bug: snap it to 16 (default) or
12 (compact) and flag it.

When sizing an icon at the **compact** 12px size, also swap the registered glyph to its `*Compact`
variant (e.g. `Codicon.close` → `Codicon.closeCompact`) so the icon is visually optimized for the
small size. CSS `font-size` alone only scales the icon — it does not change to the compact glyph.
Only swap the glyph when no CSS selector targets the original glyph class (e.g. `.codicon-close`),
otherwise update that selector too. Some icons (settings/sliders, agent, vm, info, lock, plus) have
no compact variant — keep the regular glyph at the compact size.

## Stroke — border width

The design system has a **single** stroke thickness: 1px. Any `border`/`outline` width of 1px should
use the token.

| px  | Variable                   |
| --- | -------------------------- |
| 1   | `--vscode-strokeThickness` |

```scss
/* prefer */
border: var(--vscode-strokeThickness, 1px) solid var(--vscode-widget-border);
/* avoid  */
border: 1px solid var(--vscode-widget-border);
```

Applies to the `border: 1px solid <color>` shorthand and `border-width: 1px`. Other widths have no
token — leave them as-is.
