---
name: ganttee-feature-spec
description: "Scaffold and complete a Ganttee feature specification. Use when starting a new feature, writing a spec/epic/user story, or defining acceptance criteria for the Gantt editor (tasks, groups, milestones, dependencies, resources). Bundles a spec template and the required section checklist."
argument-hint: "<feature name or short description>"
---

# Ganttee Feature Spec

Produce an implementation-ready specification for a Ganttee feature.

## When to Use

- Turning a feature idea into a written spec before coding.
- Defining epics, user stories, and Given/When/Then acceptance criteria.
- Capturing data-model (`.ganttee` schema) and host↔webview protocol impact.

## Procedure

1. Copy the [spec template](./assets/feature-spec-template.md) into
   `docs/specs/<feature-slug>.md` (create the folder if needed).
2. Fill every section. Follow
   [feature-spec.instructions.md](../../instructions/feature-spec.instructions.md)
   for section rules and the acceptance-criteria format.
3. Ground the spec in the codebase: reference real types in `src/common/models/`,
   messages in `src/common/protocol.ts`, and logic in `src/services/`.
4. For any `.ganttee` shape change, bump `CURRENT_DOCUMENT_VERSION` in the spec and
   describe the migration.
5. Write acceptance criteria for happy paths **and** error paths (cycle rejection,
   dangling dependencies, invalid dates). Ensure each is test-verifiable.
6. Sync status badge with front matter `Status`: place the mapped badge directly
   under `# Feature: <name>` and update it whenever `Status` changes.
7. Hand the finished spec to the **Test Planner** agent for a coverage plan and to
   the **Architecture Guard** agent for a boundary check.

## Reminders

- User-facing strings are localized (`vscode.l10n.t()` / `nls`).
- Branch coverage must stay ≥ 90%.
- Reason about UX in design terms (see the `design-philosophy` skill).
- Rank each item in _Risks & Open Questions_ with the shared severity scale in
  [reporting-standard.instructions.md](../../instructions/reporting-standard.instructions.md)
  (🟣 critical → 🔵 nice to have, in that order).
