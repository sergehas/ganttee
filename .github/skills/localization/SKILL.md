---
name: localization
description:
  "Audit localization catalogs, add languages, or translate application strings. Use when checking
  unused or missing translations, package.nls or l10n parity, placeholders, or translation quality."
---

# Localization

## Audit

1. Read the current source and catalog changes. When another session edits these files, keep
   findings provisional and coordinate before changing overlapping files.
2. Run `npm run check:l10n` (the audit; also part of `compile` and CI).
3. Resolve every error using its source location. Manifest keys belong to `package.nls.json`;
   runtime and webview keys belong to `l10n/bundle.l10n.json`. Each localized catalog must have
   exactly its reference's keys. Reference values are English, not replacement translations.
4. Prove usage at a production consumer. Tests, comments, an unrelated matching literal, and
   broadcasting an entire catalog do not establish usage. The script traces const registries,
   function returns, parameter call sites, and object literals typed by a declared property;
   mutation, spreads, and escaped functions stay unresolved. Unresolved calls are errors: first
   extend the resolver. Only for values that are truly computed at runtime (library callbacks,
   file-name derivation), add an entry with the exact argument text, a reason, and every possible
   key to [dynamic-keys.json](./dynamic-keys.json). Entries that no longer match an unresolved call
   fail as stale.
5. Review unchanged-English warnings in context. Some are correct, including product names, OK, and
   image format names. A passing audit establishes structural correctness, not language quality.

Completion: no audit errors remain and every warning has been reviewed.

## Translate

1. Establish the exact target locale, including regional variants. Create both families:
   `package.nls.<locale>.json` and `l10n/bundle.l10n.<locale>.json`, with the lowercase VS Code
   locale id (`pt-br`, `pt-pt`). VS Code loads the runtime bundle by exact name with no fallback to
   the base language, so a regional variant needs its own runtime file.
2. Read each English entry with its actual host/webview context. Distinguish labels, buttons,
   tooltips, validation messages, and diagnostic sentence fragments. Preserve the domain meanings of
   task, group, milestone, dependency, start, end, and duration throughout a locale.
3. Translate from English. Consult French for established terminology and especially as guidance for
   Italian, Spanish, and Portuguese. Prefer natural target-language phrasing over copying French
   syntax. Keep European and Brazilian Portuguese distinct.
4. Use familiar application wording rather than inventive synonyms. These are contextual defaults,
   not automatic substitutions. Prefer established, consistent application terminology when the
   action has a more specific meaning.

5. Preserve placeholder identifiers and counts, significant spaces in sentence fragments, line
   breaks, technical identifiers, and product names. Use proper diacritics and native
   capitalization. Keep the grammatical role of fragments correct when interpolated together.
6. Review every added or changed entry for completeness, idiomatic wording, consistent terminology,
   and fit for its UI role. Review entries equal to English individually; change them only when
   their meaning requires translation. Identify uncertain language choices explicitly rather than
   claiming native-speaker review or substituting untranslated English.
7. Format every touched file using the repository formatter configuration. Run the audit, then the
   application tests under `src/test/` that import each changed runtime module. For new locales,
   verify the packaging file list includes both catalog families.

Completion: exact key parity and placeholders pass, every translation has received contextual
review, and any remaining linguistic limitations are reported.
