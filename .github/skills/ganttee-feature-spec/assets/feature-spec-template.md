---
Status: Draft
Owner: <you>
Last updated: <date>
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

## 3. User Stories

- As a <role>, I want <capability>, so that <benefit>.

## 4. Acceptance Criteria

Given/When/Then, one testable scenario per bullet. Include edge and error paths.

- Given <context>
  When <action>
  Then <observable outcome>

## 5. Domain & Data Model Impact

- New/changed types in `src/common/models/`:
- `.ganttee` schema change? (bump `CURRENT_DOCUMENT_VERSION` + migration):

## 6. Protocol Impact

- New/changed `HostToWebview` / `WebviewToHost` messages in
  `src/common/protocol.ts`:

## 7. UX

- Timeline (ECharts): <behavior>
- Sidebar tree: <behavior>
- Edit form: <behavior>

Reason in design terms (values → principles → moves), not pixels.

## 8. Test Strategy

- Unit (models/services):
- Integration (commands/editor/tree):
- Webview interaction:
- Coverage: branch coverage stays ≥ 90%.

## 9. Risks & Open Questions

- <risk / question>
