---
description:
  "Use when writing, structuring, or reviewing a Ganttee feature specification — epics, user
  stories, acceptance criteria, domain/data model impact, host↔webview protocol changes, and test
  strategy. Covers the required spec sections and the Given/When/Then acceptance-criteria format."
---

# Feature Spec Guidelines

A Ganttee feature spec is implementation-ready when an engineer can build and test it without
further clarification. Keep specs concise; link to code rather than restating it. Specs are written
using English prose. Use mermaid for diagrams.

## Required Sections

1. **Summary** — one paragraph: the problem, the user, and the outcome.
2. **Goals / Non-goals** — bullet lists. Non-goals prevent scope creep (e.g. "resource leveling is
   out of scope for this phase").
3. **Epic** — one paragraph naming the capability the spec delivers. One spec is usually one epic.
4. **User Stories & Acceptance Criteria** — `As a <role>, I want <capability>, so that <benefit>.`,
   each with its own Given/When/Then nested beneath it (testable, one scenario per bullet, include
   edge cases and error paths).
5. **Business Rules** — declarative, unambiguous statements the system enforces, independent of any
   single story. Lean prose: every sentence carries load-bearing content — no hedging, backstory, or
   throat-clearing.
6. **Domain & Data Model Impact** — new/changed types in `src/common/models/`, and any `.ganttee`
   schema change (bump `version` + describe the migration).
7. **Protocol Impact** — new/changed `HostToWebview` / `WebviewToHost` messages in
   `src/common/protocol.ts`.
8. **UX** — timeline (ECharts), sidebar tree, and edit-form behavior. Reason in design terms (see
   the `design-philosophy` skill), not pixels.
9. **Test Strategy** — unit (services/models), integration (commands/editor), and webview
   interaction slices. Branch coverage must stay ≥ 90%.
10. **Risks** — severity-tagged only (🟣🔴🟡🟢, no "nice to have" — a risk is real or untracked).
11. **Open Questions** — one bullet per question, IDed and grouped by severity (see below).

## Spec Folder Layout

Every new spec is a folder: `docs/specs/<slug>/`.

- `SPEC.md` — the kernel; follows the section order above.
- Optional spec-specific companion docs (not glossary — project terminology belongs in the root
  `CONTEXT.md`, owned by the `domain-modeling` skill).

ADRs live outside the spec folder, in the repo-wide `docs/adr/` (see Open Question IDs below).

This layout applies to specs created from this point forward. Existing single-file specs are not
migrated.

## Open Question IDs

Format `<letter>-<sequence>` (`C`ritical/`H`igh/`M`edium/`L`ow/`N`ice-to-have, zero-padded, sequence
per letter — e.g. `H-01`, `H-02`, `M-01`). Full convention and entry shape:
[open-question-ids.md](../skills/feature-spec/assets/open-question-ids.md). When a question is
resolved, mark it `**Resolved**` with either a one-line inline rationale or, when the decision meets
the `domain-modeling` skill's [ADR-FORMAT.md](../skills/engineering/domain-modeling/ADR-FORMAT.md)
bar, a link to the ADR that resolved it (`docs/adr/NNNN-slug.md`). Never delete or renumber a
question.

## Acceptance Criteria Format

```
Given a task with a "start after" dependency on an unfinished task
When the user drags the successor before the predecessor's finish
Then the edit is rejected and an inline validation message is shown
```

- Each criterion must be independently verifiable by a test.
- Cover the invalid/error path, not just the happy path (e.g. cycle creation is rejected, dangling
  dependencies are flagged).

## Rules

- Respect the layer boundaries in
  [source-code-organization](./source-code-organization.instructions.md): the single source of truth
  is the `.ganttee` `TextDocument`.
- All user-facing strings are localized (`vscode.l10n.t()` / `nls`); note new strings in the spec.
- Use the `feature-spec` skill to scaffold a spec from the template.
- Front matter `Status` is canonical for workflow state.
- The status badge must appear directly under `# Feature: <name>` and must match front matter
  `Status` in the same edit.
- Use this mapping for badge sync:
  - `Intent` →
    `![Status: Intent](https://img.shields.io/badge/status-Intent-ADB5BD?style=for-the-badge)`
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
- If `Status` uses a value outside this mapping, keep `Status` unchanged and add a follow-up note in
  _Open Questions_ to resolve the mismatch.
- **ADR write exception:** while a spec is `Implementing`, the Spec Implementer may create a new
  `docs/adr/NNNN-slug.md` file — only when the decision meets the `domain-modeling` skill's
  ADR-FORMAT.md bar — and flip a resolved Open Question's marker to its `**Resolved**` form. It may
  not otherwise edit `SPEC.md` prose (stories, acceptance criteria, business rules, domain/protocol
  impact) — the spec body stays owned by Spec Writer/Reviewer transitions.

## Status Lifecycle

States flow in order; each transition has one owner. Every status change updates the spec front
matter **and** its badge (when a spec file exists) **and** the matching `docs/specs/ROADMAP.md` row
(Status text + Badge column) in the same edit. See [the spec workflow](../../docs/specs/README.md)
for who does what. Entry-point routing to the right agent may be suggested by a router skill, but
every transition still requires the owning agent to get explicit user confirmation first.

- **Intent** — roadmap-only; no spec file yet. Brainstorm requirements in general chat (default
  agent) to feed the next step.
- **Draft** — initial spec authored. Owner: **Spec Writer**.
- **Reviewed** (optional) — spec checked, ready to build. Owner: **Spec Reviewer**. May be skipped
  (Draft → Implementing).
- **Implementing** — coding has started. Owner: **Spec Implementer** (set on plan approval).
- **Implemented** — the PR is raised. Owner: **Spec Implementer**; also add a `CHANGELOG.md` entry
  under `## [Unreleased]`.

**Blocked** / **On Hold** are reversible side-states settable from any state before
**Implementing**; note the state to resume in _Open Questions_ and follow the same spec + roadmap
sync rule.
