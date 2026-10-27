---
description: "Refine a Draft Ganttee feature specification from chat instructions"
name: "Refine Draft Feature Spec"
argument-hint: "<Draft spec path or slug; requested refinements>"
agent: "Spec Writer"
---

Refine the Draft feature specification identified by `$ARGUMENTS` using the Spec Writer agent.

Read the target specification, its roadmap row, and
[the feature-spec guidelines](../instructions/feature-spec.instructions.md).

- Continue only when the target spec's canonical status is `Draft`.
- Translate the chat instructions into a targeted refinement plan and wait for explicit user
  confirmation before editing.
- Apply only the approved content changes needed to the Draft specification.
- Keep the spec status and status badge as `Draft`; do not transition it or alter the roadmap row.
- Do not implement code. For a non-Draft status, stop and route to the command that owns that
  lifecycle state.
