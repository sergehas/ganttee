# Open Question IDs

Every Open Question gets a stable ID so it can be referenced from an ADR, a commit, or a chat
message. Risks are not IDed — they carry only a severity tag (see
[reporting-standard](../../../instructions/reporting-standard.instructions.md)) since they are
tracked as accepted/mitigated, not resolved one by one.

ADRs themselves are not spec-scoped: they follow the
[domain-modeling skill](../../engineering/domain-modeling/SKILL.md)'s
[ADR-FORMAT.md](../../engineering/domain-modeling/ADR-FORMAT.md) — repo-wide `docs/adr/`, globally
sequential numbering, and offered only when its 3-criteria bar is met. Most resolved questions won't
have one.

## Format

`<letter>-<sequence>`, zero-padded to two digits, sequence restarts per letter.

| Letter | Severity     |
| ------ | ------------ |
| `C`    | Critical     |
| `H`    | High         |
| `M`    | Medium       |
| `L`    | Low          |
| `N`    | Nice to have |

Examples: `C-01`, `H-01`, `H-02`, `M-01`.

## Question Entry Shape

```md
- **H-01** — <question text> Status: Open
```

Once resolved, use whichever of the two applies:

```md
- **H-01** — <question text> Status: **Resolved** — <one-line rationale>
```

```md
- **H-01** — <question text> Status: **Resolved** (see
  [docs/adr/0007-slug.md](../../../../docs/adr/0007-slug.md))
```

Use the ADR form only when the decision meets domain-modeling's ADR-FORMAT.md bar (hard to reverse,
surprising without context, a real trade-off). Otherwise resolve inline — most questions should.

## Rules

- Assign the next unused number for that letter; never reuse a number, even if a question is later
  dropped.
- Re-grouping by severity changes only the letter+number of new entries; never renumber existing
  ones.
- An ADR may resolve more than one question — link it from every question it resolves.
- A question can move up or down in severity as understanding improves; when it does, retire the old
  ID (mark `Superseded by <new-id>`) and open a new one — do not relabel in place.
