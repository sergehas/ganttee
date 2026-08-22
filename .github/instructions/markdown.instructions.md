---
applyTo: "**/*.md"
---

# Markdown Style Rules (markdownlint)

All Markdown files must comply with the following rules based on
[markdownlint](https://github.com/DavidAnson/markdownlint).

## Headings

- **MD001 / heading-increment** — Heading levels must only increment by one
  level at a time (no skipping from `#` to `###`).
- **MD003 / heading-style** — Use a consistent heading style throughout the
  document. Prefer ATX style (`# Heading`).
- **MD018 / no-missing-space-atx** — Always put one space after the `#` in ATX
  headings (`# Heading`, not `#Heading`).
- **MD019 / no-multiple-space-atx** — Only one space after the `#` in ATX
  headings.
- **MD020 / no-missing-space-closed-atx** — Put spaces inside hashes on closed
  ATX headings.
- **MD021 / no-multiple-space-closed-atx** — Only one space inside hashes on
  closed ATX headings.
- **MD022 / blanks-around-headings** — Surround every heading with exactly one
  blank line above and below (except at the start/end of the file).
- **MD023 / heading-start-left** — Headings must start at the beginning of the
  line (no indentation).
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

## Whitespace & Blank Lines

- **MD009 / no-trailing-spaces** — No trailing spaces at the end of lines
  (2 trailing spaces for an intentional `<br>` are allowed).
- **MD010 / no-hard-tabs** — Use spaces, not hard tab characters.
- **MD012 / no-multiple-blanks** — No more than one consecutive blank line.
- **MD027 / no-multiple-space-blockquote** — Only one space after the `>`
  blockquote symbol.
- **MD028 / no-blanks-blockquote** — Separate consecutive blockquotes with
  text, not just a blank line.

## Lists

- **MD004 / ul-style** — Use a consistent unordered-list marker throughout the
  document (`-`, `*`, or `+`).
- **MD005 / list-indent** — List items at the same level must have consistent
  indentation.
- **MD007 / ul-indent** — Unordered list items must be indented by 2 spaces per
  level.
- **MD029 / ol-prefix** — Ordered list item prefixes must follow the configured
  style (default: `one_or_ordered`).
- **MD030 / list-marker-space** — Use exactly one space after a list marker.
- **MD032 / blanks-around-lists** — Surround every list with a blank line above
  and below.

## Code

- **MD014 / commands-show-output** — Do not prefix every shell command in a
  code block with `$` unless some commands have visible output.
- **MD031 / blanks-around-fences** — Surround every fenced code block with a
  blank line above and below.
- **MD040 / fenced-code-language** — Every fenced code block must declare a
  language. Use `text` for plain-text blocks.
- **MD046 / code-block-style** — Use a consistent code block style (prefer
  fenced).
- **MD048 / code-fence-style** — Use a consistent code fence character
  (prefer backticks ` ``` `).

## Links & Images

- **MD011 / no-reversed-links** — Do not reverse the `[]()` link syntax.
- **MD034 / no-bare-urls** — Wrap bare URLs in angle brackets
  (`<https://example.com>`).
- **MD039 / no-space-in-links** — No spaces surrounding link text
  (`[text](url)`, not `[ text ](url)`).
- **MD042 / no-empty-links** — Links must have a non-empty destination.
- **MD045 / no-alt-text** — Images must have alt text
  (`![description](image.png)`).
- **MD051 / link-fragments** — Internal link fragments (`#section`) must match
  an existing heading.
- **MD052 / reference-links-images** — Reference-style links and images must
  use a defined label.
- **MD053 / link-image-reference-definitions** — Every link/image reference
  definition must be used.
- **MD054 / link-image-style** — Use a consistent link/image style.
- **MD059 / descriptive-link-text** — Link text must be descriptive; avoid
  `[click here]`, `[here]`, `[link]`, or `[more]`.

## Emphasis

- **MD037 / no-space-in-emphasis** — No spaces inside emphasis markers
  (`**bold**`, not `** bold **`).
- **MD049 / emphasis-style** — Use a consistent emphasis marker (`*` or `_`).
- **MD050 / strong-style** — Use a consistent strong marker (`**` or `__`).

## Tables

- **MD055 / table-pipe-style** — Use consistent leading/trailing pipe
  characters in tables.
- **MD056 / table-column-count** — Every row in a table must have the same
  number of cells.
- **MD058 / blanks-around-tables** — Surround every table with a blank line
  above and below.
- **MD060 / table-column-style** — Use a consistent column spacing style
  within tables (default: `any`).

## HTML

- **MD033 / no-inline-html** — Avoid raw HTML; use Markdown equivalents.

## Other

- **MD013 / line-length** — Lines must not exceed 80 characters. Long URLs
  without spaces are exempt. Tables, headings, and code blocks follow the same
  limit unless explicitly relaxed.
- **MD035 / hr-style** — Use a consistent horizontal-rule style (`---`).
- **MD038 / no-space-in-code** — No unnecessary spaces inside inline code
  spans.
- **MD044 / proper-names** — Proper names (e.g. `JavaScript`, `GitHub`,
  `TypeScript`, `VS Code`) must be capitalized correctly.
- **MD047 / single-trailing-newline** — Every file must end with exactly one
  newline character.
