---
name: feature-spec
description:
  "Scaffold and complete a Ganttee feature specification. Use when starting a new feature, writing a
  spec/epic/user story, or defining acceptance criteria for the Gantt editor (tasks, groups,
  milestones, dependencies, resources). Bundles a spec template and the required section checklist."
argument-hint: "<feature name or short description>"
---

# Feature Spec

Produce an implementation-ready specification for a Ganttee feature.

## When to Use

- Turning a feature idea into a written spec before coding.
- Defining an epic, its user stories, and Given/When/Then acceptance criteria.
- Capturing data-model (`.ganttee` schema) and host↔webview protocol impact.

## Procedure

1. Create `docs/specs/<feature-slug>/SPEC.md` from the
   [spec template](./assets/feature-spec-template.md) (the folder holds `SPEC.md` and any
   spec-specific companion docs).
2. Fill every section. Follow
   [feature-spec.instructions.md](../../instructions/feature-spec.instructions.md) for section rules
   and the acceptance-criteria format.
3. Ground the spec in the codebase: reference real types in `src/common/models/`, messages in
   `src/common/protocol.ts`, and logic in `src/services/`.
4. For any `.ganttee` shape change, bump `CURRENT_DOCUMENT_VERSION` in the spec and describe the
   migration.
5. Write acceptance criteria for happy paths **and** error paths (cycle rejection, dangling
   dependencies, invalid dates). Ensure each is test-verifiable.
6. Number every Open Question per the [ID convention](./assets/open-question-ids.md), grouped by
   severity.
7. Sync status badge with front matter `Status`: place the mapped badge directly under
   `# Feature: <name>` and update it whenever `Status` changes.
8. Hand the finished spec to the **Test Planner** agent for a coverage plan and to the
   **Architecture Guard** agent for a boundary check.

## ADRs

ADRs are not spec-scoped. Follow the
[domain-modeling skill](../engineering/domain-modeling/SKILL.md)'s
[ADR-FORMAT.md](../engineering/domain-modeling/ADR-FORMAT.md) for when a decision warrants one (hard
to reverse, surprising without context, a real trade-off), its location (`docs/adr/`), and its
numbering. When a review or implementation session writes one, list it under the spec's front matter
`Related ADRs` and mark the open question(s) it resolves `**Resolved**` with a link to it. Most
resolved questions won't meet the bar — resolve those inline instead (see
[open-question-ids.md](./assets/open-question-ids.md)).

## Reminders

- User-facing strings are localized (`vscode.l10n.t()` / `nls`).
- Branch coverage must stay ≥ 90%.
- Reason about UX in design terms (see the `design-philosophy` skill).
- Rank each _Risk_ and each _Open Question_ with the shared severity scale in
  [reporting-standard.instructions.md](../../instructions/reporting-standard.instructions.md) (🟣
  critical → 🔵 nice to have for Open Questions only — a Risk is never "nice to have").
