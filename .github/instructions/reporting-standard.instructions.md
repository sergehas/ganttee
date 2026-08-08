---
description: "Use whenever an agent or skill reports issues, findings, risks, or open questions — the shared severity scale, symbols, item format, and ordering so every report looks the same. Referenced by the review/plan agents and quality skills."
---

# Reporting Standard

The single source of truth for how every agent and skill reports **issues,
findings, risks, and open questions**. Use the same severities, the same
symbols, the same item format, and the same order everywhere so reports are
instantly comparable.

## Severity Scale

| Symbol | Severity     | Use for                         |
| ------ | ------------ | ------------------------------- |
| 🟣     | Critical     | Blocks merge/release; must fix. |
| 🔴     | High         | Should fix before merge.        |
| 🟡     | Medium       | Fix soon; not blocking.         |
| 🟢     | Low          | Minor; fix when convenient.     |
| 🔵     | Nice to have | Optional improvement.           |

## Ordering

Always sort strictly from most to least severe:

Critical → High → Medium → Low → Nice to have

## Item Format

Every reported item follows the same shape: symbol, severity label, a
location/context, and a concrete fix, decision, or treatment — never just a
description.

```text
🟣 Critical — <location / context> — <concrete fix, decision, or treatment>
```

Example rendered list:

```text
🟣 Critical — src/services/foo.ts:42 — parse errors are swallowed; rethrow.
🟡 Medium — spec §3 — acceptance criterion 2 is not testable; add G/W/T.
🔵 Nice to have — README — add a screenshot of the timeline.
```

## Rendering Rules

- Prefix each item with its symbol **and** severity label.
- Keep the Critical → Nice to have order, whether items are a flat list or
  grouped under `### 🟣 Critical` style headers.
- Omit any severity that has no items — no empty headers or placeholder rows.
- Every item names a location/context and a concrete action, not just a
  problem statement.

## Relationship to Verdicts

This standard governs issue/risk/open-question **lists** only. Terminal
verdicts — `PASS` / `CHANGES REQUESTED`, `READY` / `NOT READY` with ✅/❌, and
similar — are unchanged and sit alongside the list.

## Constraints

- 'nice to have' does not apply to risks.
