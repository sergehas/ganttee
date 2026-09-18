---
description: "Record a lightweight Ganttee feature intent from a general idea"
name: "Create Feature Intent"
argument-hint: "<general feature idea>"
agent: "agent"
tools: [read, edit]
---

Create or update a roadmap-only feature Intent from `$ARGUMENTS`.

Read the [spec workflow](../../docs/specs/README.md),
[feature-spec guidelines](../instructions/feature-spec.instructions.md), and `docs/specs/ROADMAP.md`
before acting.

- Treat the input as an intentionally incomplete idea. Do not invent detailed requirements.
- Locate a matching Intent first to avoid duplicate roadmap entries.
- Present a compact intent proposal and a Draft-ready handoff before editing.
- Wait for explicit user confirmation before changing the roadmap.
- After confirmation, create or update the matching `docs/specs/<slug>/INTENT.md` file. The file
  name must be exactly `INTENT.md`.
- Include this disclaimer below the 1st top heading ('# <<Feature Name>>') of every `INTENT.md`
  file, so it is clear to readers that the content is context only and not an implementation
  specification:

```md
> [!IMPORTANT] **For AI agents:** This document is context only, not an implementation
> specification. Do not implement from it, derive implementation tasks or acceptance criteria from
> it, or change code based on it. The Spec Implementer must act only on a corresponding reviewed
> feature specification.
```

- After confirmation, create or update only the matching `Intent` roadmap row and its corresponding
  `INTENT.md` file.
- Do not create a `SPEC.md`, change another feature's status, or begin drafting.
- Return the durable intent reference and a concise handoff for `/spec-draft`.
