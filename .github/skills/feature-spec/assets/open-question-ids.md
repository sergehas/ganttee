# Open Question and Risk IDs

Every Open Question and Risk gets a visible severity indicator and stable ID so it can be referenced
from an ADR, a commit, or a chat message. The indicator's meaning and the required severity order
are defined in the [reporting standard](../../../instructions/reporting-standard.instructions.md).

ADRs themselves are not spec-scoped: they follow the
[domain-modeling skill](../../engineering/domain-modeling/SKILL.md)'s
[ADR-FORMAT.md](../../engineering/domain-modeling/ADR-FORMAT.md) — repo-wide `docs/adr/`, globally
sequential numbering, and offered only when its 3-criteria bar is met. Most resolved questions won't
have one.

## ID Format

`<severity-indicator> <type-letter>-<sequence>`, with the indicator before the ID. The sequence is
zero-padded to two digits and restarts per type. The type letter is `R` for risks and `Q` for open
questions. Severity is represented only by the leading indicator.

Examples: `🔴 R-01`, `🔴 R-02`, `🟡 Q-01`, `🟣 Q-02`.

## Entry Shape

```md
- 🔴 **R-01** — <risk text>
  - Status: **Open**
```

Once resolved, use whichever of the two forms applies:

```md
- 🔴 **R-01** — <risk text>
  - Status: **Resolved** — <one-line rationale>
```

```md
- 🔴 **R-01** — <risk text>
  - Status: **Resolved** (see [docs/adr/0007-slug.md](../../../../docs/adr/0007-slug.md))
```

Use the ADR form only when the decision meets domain-modeling's ADR-FORMAT.md bar (hard to reverse,
surprising without context, a real trade-off). Otherwise resolve inline — most items should.

## Rules

- Assign the next unused number for that type; never reuse a number, even if an item is later
  dropped.
- Sort entries by severity in descending order: from critical to nice to have, then by sequence
  number ascending. Sorting changes display order only; never change or renumber existing IDs.
- If an item's severity changes, update only its leading severity indicator. Keep its type letter
  and sequence number unchanged.
- Keep the leading indicator aligned with the item's severity.
- An ADR may resolve more than one item — link it from every item it resolves.
