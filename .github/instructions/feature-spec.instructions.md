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
9. **Risks & Open Questions.** Rank each item with the shared severity scale in
   [reporting-standard](./reporting-standard.instructions.md) (🟣 critical → 🔵
   nice to have, in that order).

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
- Front matter `Status` is canonical for workflow state.
- The status badge must appear directly under `# Feature: <name>` and must match
  front matter `Status` in the same edit.
- Use this mapping for badge sync:
  - `To be defined` →
    `![Status: To be defined](https://img.shields.io/badge/status-To%20be%20defined-ADB5BD?style=for-the-badge)`
  - `Draft` →
    `![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)`
  - `Reviewed` →
    `![Status: Reviewed](https://img.shields.io/badge/status-Reviewed-0D6EFD?style=for-the-badge)`
  - `Implementing` →
    `![Status: Implementing](https://img.shields.io/badge/status-Implementing-F59F00?style=for-the-badge)`
  - `Implemented` →
    `![Status: Implemented](https://img.shields.io/badge/status-Implemented-2B8A3E?style=for-the-badge)`
  - `Blocked` →
    `![Status: Blocked](https://img.shields.io/badge/status-Blocked-C92A2A?style=for-the-badge)`
  - `On Hold` →
    `![Status: On Hold](https://img.shields.io/badge/status-On%20Hold-7048E8?style=for-the-badge)`
- If `Status` uses a value outside this mapping, keep `Status` unchanged and add
  a follow-up note in _Risks & Open Questions_ to resolve the mismatch.

## Status Lifecycle

States flow in order; each transition has one owner. Every status change updates
the spec front matter **and** its badge (when a spec file exists) **and** the
matching `docs/specs/ROADMAP.md` row (Status text + Badge column) in the same
edit. See [the spec workflow](../../docs/specs/README.md) for who does what.

- **To be defined** — roadmap-only; no spec file yet. Brainstorm requirements in
  general chat (default agent) to feed the next step.
- **Draft** — initial spec authored. Owner: **Spec Writer**.
- **Reviewed** (optional) — spec checked, ready to build. Owner: **Spec
  Reviewer**. May be skipped (Draft → Implementing).
- **Implementing** — coding has started. Owner: **Spec Implementer** (set on
  plan approval).
- **Implemented** — the PR is raised. Owner: **Spec Implementer**; also add a
  `CHANGELOG.md` entry under `## [Unreleased]`.

**Blocked** / **On Hold** are reversible side-states settable from any state
before **Implementing**; note the state to resume in _Risks & Open Questions_
and follow the same spec + roadmap sync rule.
