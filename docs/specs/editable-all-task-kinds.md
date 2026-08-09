---
Status: Implementing
Owner: Developer
Last updated: 2026-08-09
---

# Feature: Editable Work Item Kinds (Tasks, Milestones, Groups)

![Status: Implementing](https://img.shields.io/badge/status-Implementing-F59F00?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

Today only Task entities are fully editable end-to-end from the timeline and sidebar, while Milestone edits are only partially wired and Group edits are not exposed. This feature enables users managing mixed plans to edit all work item kinds (Task, Milestone, Group) from consistent entry points in the timeline, sidebar, and form panel, with all edits persisted through the .ganttee TextDocument source of truth.

## 2. Goals / Non-goals

### Goals

- Make Task, Milestone, and Group entities editable from both the timeline (double-click / context action) and sidebar actions.
- Enable dependency editing for milestones with the same functional behavior and UI as task dependency editing.
- Reuse one editing surface pattern in the webview panel while preserving kind-specific fields and validation.
- Ensure all edits are applied via host-side WorkspaceEdit and document reparse in the existing unidirectional flow.
- Add predictable error feedback for invalid edits (invalid dates, dependency cycles for tasks and milestones, dangling references when deleting or re-parenting).
- Preserve strict layer boundaries between common models, services, extension host, and webview.
- Keep branch coverage at or above 90% for changed modules.

### Non-goals

- Resource assignment and resource-leveling behavior.
- Drag-and-drop group reordering in the sidebar.
- New dependency kinds or dependencies involving groups.
- Visual redesign of the chart beyond interaction affordances required for editing.
- Bulk-edit workflows.

## 3. User Stories

- As a planner, I want to edit a milestone from the timeline and sidebar so that I can correct date/title quickly without creating replacement items.
- As a planner, I want to edit a group name and parent so that I can maintain a clean hierarchy as plans evolve.
- As a planner, I want task editing to remain unchanged in power while becoming consistent with milestone/group editing entry points, so that I can edit any item from a single, consistent workflow.
- As a planner, I want invalid changes to be rejected with clear messaging so that document integrity is not silently broken.

## 4. Acceptance Criteria

Given an existing milestone on the chart
When I double-click the milestone marker in the timeline
Then the edit panel opens in milestone mode with the current title/date/group prefilled

Given an existing milestone in the sidebar
When I invoke Edit on that milestone node
Then the webview focuses and opens the milestone edit panel for that id

Given an existing group in the sidebar
When I invoke Edit on that group node
Then the webview focuses and opens the group edit panel with name/parent/collapsed fields

Given an open milestone edit panel
When I save a valid title and valid ISO date
Then the host receives an updateMilestone message, applies a WorkspaceEdit to the .ganttee TextDocument, reparses, and broadcasts documentChanged with the full updated document

Given an open group edit panel
When I save a valid new group name and valid parentId
Then the host receives an updateGroup message, applies a WorkspaceEdit to the .ganttee TextDocument, reparses, and broadcasts documentChanged with the full updated document

Given a group edit where parentId equals the group id
When I try to save
Then the save is rejected and an inline validation message explains a group cannot be its own parent

Given a group edit where parent assignment would create an ancestor cycle
When I try to save
Then the save is rejected and no document update is applied

Given a milestone edit with an invalid date string
When I try to save
Then the save is rejected in the webview and no host message is posted

Given a task edit where start is after end
When I try to save
Then the save is rejected with field-level validation and no updateTask message is posted

Given a task dependency edit that would create a cycle
When I add the dependency
Then the host rejects it and shows a localized error message as currently done for cycle detection

Given an open milestone edit panel
When I add a dependency on another task or milestone
Then the host receives an updateMilestone message with the updated dependencies, applies a WorkspaceEdit to the .ganttee TextDocument, reparses, and broadcasts documentChanged

Given a milestone dependency edit that would create a cycle
When I add the dependency
Then the host rejects it and shows a localized error message identical to task cycle detection behavior

Given deletion of a group that still contains tasks, milestones, or child groups
When I confirm delete
Then a confirmation dialog asks whether to cascade-delete the subtree or ungroup/re-parent its contents; the chosen operation updates all affected entities atomically and is reflected in the next documentChanged payload

Given an open group edit panel with an owned-entity row (task, milestone, or child group) directly associated to the group
When I click Remove on that row
Then the host receives an updateEntity message for that entity with groupId unset, the entity is removed from the group, the document is updated accordingly, and the current group edit panel remains open

Given deletion of a milestone referenced only by its own id (no dependency edges)
When I confirm delete
Then milestone removal is applied and no unrelated tasks/groups change

Given no matching id exists for an update or delete request for task, milestone, or group
When the host receives the request
Then the host no-ops safely, surfaces a localized warning, and does not apply WorkspaceEdit

Given malformed or invalid update payloads reach the host (including invalid task date order, invalid milestone date, or invalid group hierarchy)
When the host handles the update message
Then the host rejects the update, surfaces a localized error, and keeps the current document model unchanged

Given user-visible validation and confirmation text added by this feature
When the feature ships
Then all new strings are localized through vscode.l10n.t() or nls, with placeholders where needed

## 5. Domain & Data Model Impact

- New/changed types in src/common/models/:
  - Task, Milestone, Group interfaces remain the canonical entity types.
  - Keep routing-only discriminants (for example EditableEntityRef with kind + id) in protocol/shared transport types, not persisted domain model types.
  - If needed for hierarchy validation clarity, introduce a small helper type for group ancestry checks in services.

- .ganttee schema change? (bump CURRENT_DOCUMENT_VERSION + migration):
  - Preferred path: no schema shape change, version remains 1, because all required fields for Task/Group/Milestone already exist.
  - Only if persisted domain shape changes are introduced, bump CURRENT_DOCUMENT_VERSION and add deterministic migration logic in parse/migrate behavior.
  - Do not persist UI/session edit state in .ganttee.

- Service impact:
  - Extend src/services/ganttDocumentService.ts validation for:
    - group parent self-reference and ancestry cycles,
    - task date integrity (start <= end),
    - milestone date validity,
    - dangling group references for task.groupId, milestone.groupId, group.parentId.
  - Expand dependency cycle checks in src/services/dependencyGraphService.ts to include milestones; groups remain outside the dependency graph.

## 6. Protocol Impact

- New/changed HostToWebview / WebviewToHost messages in src/common/protocol.ts:
  - Protocol decision for this feature: adopt one discriminated entity contract and avoid parallel per-kind message families.
  - Add generic message variants:
    - HostToWebview: selectEntity { kind, id }, editEntity { kind, id }
    - WebviewToHost: requestEditEntity { kind, id }, updateEntity { kind, entity }, deleteEntity { kind, id, strategy? }
  - Dependency operations (add/remove) apply to both tasks and milestones; extend dependency-related protocol messages to accept task or milestone as the dependent entity rather than keeping them task-specific.
  - Require exhaustive switch handling for all discriminants in both host and webview.

- Host controller impact (src/views/editor/ganttEditorController.ts):
  - Add upsertGroup, deleteMilestone, deleteGroup operations.
  - Add editMilestone/editGroup reveal helpers.
  - Extend handleMessage switch to new messages while maintaining exhaustive typing.

## 7. UX

- Timeline (ECharts):
  - Preserve current interaction model where double-click initiates edit.
  - Extend hit-testing so milestone markers support edit invocation, not only task bars.
  - Keep chart reading rhythm stable: selection highlights first, editing opens panel second (clarity over surprise).

- Sidebar tree:
  - Provide Edit and Delete commands for group and milestone nodes, symmetric with task affordances.
  - Maintain clear icon/labelling distinctions by kind to support quick scanning in large plans.

- Edit form:
  - Replace task-only panel with entity-aware panel architecture.
  - Common fields: name, description, group
  - Kind-specific fields:
    - Task: start/end, status, progress, duration, dependencies.
    - Milestone: date, dependencies.
    - Group: collapsed state; readonly effective start/end/duration fields;
      owned-entities table with Name, type, and Remove columns, where Name links
      to the related task/milestone/group edit form and Remove unsets that
      entity's groupId (removes it from the group) without closing the current
      group form.
  - Validation philosophy:
    - Prevent invalid save actions at field level when possible.
    - Surface host-side rejections as localized global messages when needed.
  - Localized labels and errors for all newly added controls.

Design rationale (values → principles → moves):

- Value: Clarity. Principle: Similar actions should feel the same across entity kinds. Move: unify edit entry points and panel shell.
- Value: Trust. Principle: invalid operations must be blocked before persistence. Move: layered validation (webview pre-check + host canonical check).
- Value: Flow. Principle: preserve spatial context while editing. Move: keep inline panel editing rather than modal detours.

## 8. Test Strategy

- Unit (models/services):
  - ganttDocumentService validations for group parent cycles, dangling references, and date constraints.
  - dependencyGraphService tests to ensure existing task cycle logic is unchanged and to verify milestone dependency cycle detection.

- Integration (commands/editor/tree):
  - Command wiring tests for ganttee.editTask plus new edit/delete commands for milestone and group.
  - Controller message handling tests for new protocol variants, including unknown-id no-op behavior.
  - Ensure all mutations still pass through WorkspaceEdit and trigger reparse + documentChanged.
  - Add explicit tests for unknown-id update/delete no-op with localized warnings.

- Webview interaction:
  - App message handling for edit/select across all kinds.
  - Timeline double-click milestone opens milestone editor.
  - Entity form save/delete emits expected WebviewToHost message with correct payload.
  - Group owned-entity Remove unsets groupId and keeps the current group edit panel open.
  - Validation tests: invalid input blocks postToHost calls.
  - Milestone dependency add/remove emits correct updateMilestone message; cycle input triggers a localized rejection.

- Coverage:
  - Add branch-focused tests for each new discriminated message path and each validation rejection path.
  - Add host-side validation rejection tests for malformed/invalid update payloads per entity kind.
  - If persisted schema changes occur, add migration tests for prior-version parse, upgraded model, and round-trip serialize/parse stability.
  - Maintain branch coverage at or above 90% repository threshold.

## 9. Risks & Open Questions

- 🔴 High — Risk: Group delete semantics can surprise users; **Decision: Option C** — present a confirmation dialog asking the user to choose between cascade-delete and ungroup/re-parent; no silent default.
- 🟡 Medium — Risk: protocol migration churn while moving existing task-only edit/select messages to generic entity-discriminated messages; mitigation is exhaustive switch tests on both host and webview.
- 🟡 Medium — Risk: Validation duplication between webview and host can diverge; mitigation is host as canonical validator plus minimal client-side checks for UX.
- 🟡 Medium — Risk: Existing users may rely on current sidebar command set; confirm contribution points and context keys remain backward compatible.
- 🟢 Low — **Resolved:** Milestone dependency editing is supported with the same functional behavior and UI as task dependency editing. Groups are explicitly excluded from dependency editing in this phase.
- 🔵 Nice to have — Open question: Should timeline support direct group editing affordance, or remain sidebar-only for group edits in this phase?

## 10. Review Outcome

- Spec is implementation-ready.
- Status is `Reviewed`.
- Group delete strategy is explicit: Option C (user-confirmation dialog).
- Milestone dependency editing is scoped in: same behavior and UI as tasks; groups excluded.
- Duplicate unknown-id acceptance criterion removed; group-delete criterion updated to reflect Option C.
- All user stories have complete As/Want/So-that form.
- Typo in §7 edit-form bullet corrected.
