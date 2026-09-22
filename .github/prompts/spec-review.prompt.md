---
description: "Review a Draft Ganttee feature specification and hand off its Reviewed transition"
name: "Review Feature Spec"
argument-hint: "<Draft spec path or slug>"
agent: "Spec Reviewer"
---

Review the Draft feature specification identified by `$ARGUMENTS` using the Spec Reviewer workflow.

- Confirm that the target spec's canonical status is `Draft` before reviewing.
- Follow the review agent's plan-first mode, consistency checks, and `/grilling` process for
  unresolved decisions.
- Do not promote the spec until the user explicitly confirms the proposed resolutions.
- On confirmation, let the Spec Reviewer apply only its approved spec, ADR, and roadmap updates and
  transition the spec to `Reviewed`.
- Do not implement code.
- For any other lifecycle status, stop and route to the command that owns it.
