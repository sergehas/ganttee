---
description: "Draft a Ganttee feature specification from requirements and an optional Intent"
name: "Draft Feature Spec"
argument-hint: "<requirements or path; optional Intent name or link>"
agent: "Spec Writer"
---

Draft a feature specification from `$ARGUMENTS` using the Spec Writer workflow.

Read the optional Intent entry and any supplied requirements document before planning. Current
supplied requirements take precedence over an older Intent; identify any material divergence in the
drafting plan.

- Enforce the lifecycle in [the spec workflow](../../docs/specs/README.md).
- An Intent is roadmap-only. On approval, create the first `SPEC.md` as `Draft` and create or update
  its matching roadmap row.
- If the target already has a spec or is not an Intent/Draft drafting case, stop and route to the
  lifecycle command that owns its current status.
- Preserve the Spec Writer's plan-first confirmation gate and all required specification, risk,
  question, and roadmap conventions.
