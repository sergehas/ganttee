---
description:
  "Use whenever an agent or skill reports issues, findings, risks, or open questions — the shared
  severity scale, symbols, item format, and ordering so every report looks the same."
---

# Reporting Standard

The single source of truth for how every agent and skill reports **issues, findings, risks, and open
questions**. Use the same severities, the same symbols, the same item format, and the same order
everywhere so reports are instantly comparable.

## Severity Scale

| Symbol | Severity     | T-shirt equivalent | Use for                         |
| ------ | ------------ | ------------------ | ------------------------------- |
| 🟣     | Critical     | XXL                | Blocks merge/release; must fix. |
| 🔴     | High         | XL                 | Should fix before merge.        |
| 🟡     | Medium       | L                  | Fix soon; not blocking.         |
| 🟢     | Low          | M                  | Minor; fix when convenient.     |
| 🔵     | Nice to have | S                  | Optional improvement.           |

The T-shirt equivalent is the same five-step ordinal scale expressed in sizing vocabulary (`XXL` →
`S`). Use it in place of the severity label wherever T-shirt sizing is already the established
convention for the artifact being reported on (e.g. a register or model that scores things in
`XXL`/`XL`/`L`/`M`/`S` elsewhere). Do not mix both vocabularies within the same report — pick one
per report and use it consistently for every item.

## Ordering

Always sort strictly from most to least severe:

Critical → High → Medium → Low → Nice to have

(equivalently, in T-shirt vocabulary: XXL → XL → L → M → S)

## Item Format

Every reported item follows the same shape: symbol, severity label, a location/context, and a
concrete fix, decision, or treatment — never just a description.

```text
🟣 Critical — <location / context> — <concrete fix, decision, or treatment>
```

Example rendered list:

```text
🟣 Critical — src/services/foo.ts:42 — parse errors are swallowed; rethrow.
🟡 Medium — spec §3 — acceptance criterion 2 is not testable; add G/W/T.
🔵 Nice to have — README — add a screenshot of the timeline.
```

Equivalent list using the T-shirt vocabulary instead of severity labels:

```text
🟣 XXL — src/services/foo.ts:42 — parse errors are swallowed; rethrow.
🟡 L — spec §3 — acceptance criterion 2 is not testable; add G/W/T.
🔵 S — README — add a screenshot of the timeline.
```

## Rendering Rules

- Prefix each item with its symbol **and** severity label (or its T-shirt equivalent, per the note
  above — not both).
- Keep the Critical → Nice to have (or `XXL` → `S`) order, whether items are a flat list or grouped
  under `### 🟣 Critical` (or `### 🟣 XXL`) style headers.
- Omit any severity that has no items — no empty headers or placeholder rows.
- Every item names a location/context and a concrete action, not just a problem statement.

## Relationship to Verdicts

This standard governs issue/risk/open-question **lists** only. Issue lists are always accompanied by
a terminal **verdict** that summarizes the overall assessment.

### Verdict States

Reports use one of three verdict states, ordered from most to least permissive:

1. ❌ **Changes required** — Issues found; action needed before merge.
2. ⚠️ **Ready with follow-ups** — Minor issues; can merge pending non-blocking fixes.
3. ✅ **Ready to approve** — No blocking issues; approved as-is.

### Verdict Decision Rules

Use these rules to determine the verdict:

- ❌ **Changes required**: if **Any** of these are true:
  - At least one Critical or High finding exists
  - Validation fails
  - A blocking security/compliance issue exists
- ⚠️ **Ready with follow-ups**: if **All** of these are true:
  - No Critical/High findings
  - Only Medium/Low findings or missing non-blocking tests
  - Validation passes
- ✅ **Ready to approve**: if **All** of these are true:
  - No blocking findings
  - No Medium findings requiring near-term fix
  - Validation passes

## Constraints

- **Nice to have** does not apply to risks.
