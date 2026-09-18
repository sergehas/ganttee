---
description: "Implement all or selected stories from a Reviewed Ganttee feature specification"
name: "Implement Feature Spec"
argument-hint: "<Reviewed spec path or slug; full spec or story IDs>"
agent: "Spec Implementer"
---

Implement the Reviewed feature specification identified by `$ARGUMENTS` using the Spec Implementer
workflow.

- Confirm that the canonical status is `Reviewed` or `Implementing`; reject any different status and
  route to its owning lifecycle command.
- Support either the complete spec or an explicit set of user-story IDs and acceptance criteria. Do
  not infer a partial scope.
- Preserve the implementation agent's plan-first confirmation gate. On plan approval, it transitions
  the spec and roadmap to `Implementing` before code edits.
- After that approval, explicitly delegate TDD planning to the Test Planner, then implement and
  validate only the approved scope.
- A passing partial delivery remains `Implementing`; report the completed story IDs and recommend
  normal issue or pull-request tracking for durable progress.
- Only a fully implemented spec with the agent's required validation may move to `Implemented`.
