---
applyTo: "**/*.md"
---

# Markdown Style Rules

Rules based on [markdownlint](https://github.com/DavidAnson/markdownlint).

**Formatting is automatic** — blank lines around headings/lists/fences/tables,
list marker/indentation consistency, emphasis/strong markers, code fence
characters, trailing whitespace, and the final newline are all normalized by
`npm run format` (Prettier). Don't hand-check these; just run format before
finishing. The rules below are things Prettier **cannot** fix for you —
structure and content correctness.

## Headings

- **MD001 / heading-increment** — Heading levels must only increment by one
  level at a time (no skipping from `#` to `###`).
- **MD024 / no-duplicate-heading** — Each heading must have unique content.
  Sibling-only duplicates (e.g. changelog sections) are allowed when
  `siblings_only` is enabled.
- **MD025 / single-title** — Only one top-level (`#`) heading per document.
- **MD026 / no-trailing-punctuation** — No trailing punctuation (`.`, `,`, `;`,
  `:`, `!`) at the end of a heading.
- **MD036 / no-emphasis-as-heading** — Do not use bold/italic text as a
  substitute for a heading.
- **MD041 / first-line-heading** — The first line of every file must be a
  top-level (`#`) heading.
- **MD043 / required-headings** — When a document type has a mandatory
  structure, headings must match the required list.

## Code

- **MD014 / commands-show-output** — Do not prefix every shell command in a
  code block with `$` unless some commands have visible output.
- **MD040 / fenced-code-language** — Every fenced code block must declare a
  language. Use `text` for plain-text blocks.

## Links & Images

- **MD011 / no-reversed-links** — Do not reverse the `[]()` link syntax.
- **MD034 / no-bare-urls** — Wrap bare URLs in angle brackets
  (`<https://example.com>`).
- **MD042 / no-empty-links** — Links must have a non-empty destination.
- **MD045 / no-alt-text** — Images must have alt text
  (`![description](image.png)`).
- **MD051 / link-fragments** — Internal link fragments (`#section`) must match
  an existing heading.
- **MD052 / reference-links-images** — Reference-style links and images must
  use a defined label.
- **MD053 / link-image-reference-definitions** — Every link/image reference
  definition must be used.
- **MD059 / descriptive-link-text** — Link text must be descriptive; avoid
  `[click here]`, `[here]`, `[link]`, or `[more]`.

## Other

- **MD013 / line-length** — Lines must not exceed 80 characters. Long URLs
  without spaces are exempt. Tables, headings, and code blocks follow the same
  limit unless explicitly relaxed. (Prettier's default `proseWrap: preserve`
  does not wrap prose for you.)
- **MD033 / no-inline-html** — Avoid raw HTML; use Markdown equivalents.
- **MD044 / proper-names** — Proper names (e.g. `JavaScript`, `GitHub`,
  `TypeScript`, `VS Code`) must be capitalized correctly.
- **MD056 / table-column-count** — Every row in a table must have the same
  number of cells.
