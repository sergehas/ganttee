---
description: "Use when writing, structuring, or reviewing a Ganttee feature specification — epics, user stories, acceptance criteria, domain/data model impact, host↔webview protocol changes, and test strategy. Covers the required spec sections and the Given/When/Then acceptance-criteria format."
---

# Feature Spec Guidelines

A Ganttee feature spec is implementation-ready when an engineer can build and test
it without further clarification. Keep specs concise; link to code rather than
restating it.

## Required Sections

1. **Summary** — one paragraph: the problem, the user, and the outcome.
2. **Goals / Non-goals** — bullet lists. Non-goals prevent scope creep (e.g.
   "resource leveling is out of scope for this phase").
3. **User Stories** — `As a <role>, I want <capability>, so that <benefit>.`
4. **Acceptance Criteria** — Given/When/Then, testable, one scenario per bullet
   (include edge cases and error paths).
5. **Domain & Data Model Impact** — new/changed types in `src/common/models/`,
   and any `.ganttee` schema change (bump `version` + describe the migration).
6. **Protocol Impact** — new/changed `HostToWebview` / `WebviewToHost` messages
   in `src/common/protocol.ts`.
7. **UX** — timeline (ECharts), sidebar tree, and edit-form behavior. Reason in
   design terms (see the `design-philosophy` skill), not pixels.
8. **Test Strategy** — unit (services/models), integration (commands/editor),
   and webview interaction slices. Branch coverage must stay ≥ 90%.
9. **Risks & Open Questions.**

## Acceptance Criteria Format

```
Given a task with a "start after" dependency on an unfinished task
When the user drags the successor before the predecessor's finish
Then the edit is rejected and an inline validation message is shown
```

- Each criterion must be independently verifiable by a test.
- Cover the invalid/error path, not just the happy path (e.g. cycle creation is
  rejected, dangling dependencies are flagged).

## Rules

- Respect the layer boundaries in
  [source-code-organization](./source-code-organization.instructions.md): the
  single source of truth is the `.ganttee` `TextDocument`.
- All user-facing strings are localized (`vscode.l10n.t()` / `nls`); note new
  strings in the spec.
- Use the `ganttee-feature-spec` skill to scaffold a spec from the template.
