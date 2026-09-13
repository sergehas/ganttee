---
Status: Draft
Owner: <you>
Last updated: <date>
Related ADRs: <none yet>
---

# Feature: <name>

![Status: Draft](https://img.shields.io/badge/status-Draft-6C757D?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

<One paragraph: the problem, the user, and the outcome.>

## 2. Goals / Non-goals

### Goals

- <goal>

### Non-goals

- <explicitly out of scope>

## 3. Epic

<One paragraph: the capability this spec delivers, in outcome terms. One spec is usually one epic.>

## 4. User Stories & Acceptance Criteria

For each story, nest its own Given/When/Then directly beneath it. Include edge and error paths.

- As a <role>, I want <capability>, so that <benefit>.
  - Given <context> When <action> Then <observable outcome>
  - Given <edge/error context> When <action> Then <rejection/validation outcome>

## 5. Business Rules

Declarative, unambiguous statements the system enforces, independent of any single story. Lean
prose: every sentence carries load-bearing content.

- <rule>

## 6. Domain & Data Model Impact

- New/changed types in `src/common/models/`:
- `.ganttee` schema change? (bump `CURRENT_DOCUMENT_VERSION` + migration):

## 7. Protocol Impact

- New/changed `HostToWebview` / `WebviewToHost` messages in `src/common/protocol.ts`:

## 8. UX

- Timeline (ECharts): <behavior>
- Sidebar tree: <behavior>
- Edit form: <behavior>

Reason in design terms (values → principles → moves), not pixels.

## 9. Test Strategy

- Unit (models/services):
- Integration (commands/editor/tree):
- Webview interaction:
- Coverage: branch coverage stays ≥ 90%.

## 10. Risks

Severity-tagged only (no "nice to have" — a risk is real or it is not tracked here).

- 🟡 Medium — <risk> — <mitigation or acceptance>

## 11. Open Questions

ID each item per the [open-question ID convention](./open-question-ids.md), grouped by severity.

- **H-01** — <question> Status: Open
