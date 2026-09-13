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

`<severity-indicator> <letter>-<sequence>`, with the indicator before the ID. The sequence is
zero-padded to two digits and restarts per letter. The letter follows the severity defined by the
reporting standard.

Examples: `🟣 C-01`, `🔴 H-01`, `🔴 H-02`, `🟡 M-01`.

## Entry Shape

```md
- 🔴 **H-01** — <question or risk text>
  - Status: **Open**
```

Once resolved, use whichever of the two forms applies:

```md
- 🔴 **H-01** — <question or risk text>
  - Status: **Resolved** — <one-line rationale>
```

```md
- 🔴 **H-01** — <question or risk text>
  - Status: **Resolved** (see [docs/adr/0007-slug.md](../../../../docs/adr/0007-slug.md))
```

Use the ADR form only when the decision meets domain-modeling's ADR-FORMAT.md bar (hard to reverse,
surprising without context, a real trade-off). Otherwise resolve inline — most items should.

## Rules

- Assign the next unused number for that letter; never reuse a number, even if an item is later
  dropped.
- Re-grouping by severity changes only the letter+number of new entries; never renumber existing
  ones.
- Keep the severity indicator aligned with the ID letter.
- An ADR may resolve more than one item — link it from every item it resolves.
- An item can move up or down in severity as understanding improves; when it does, retire the old ID
  (mark `Superseded by <new-id>`) and open a new one — do not relabel in place.
