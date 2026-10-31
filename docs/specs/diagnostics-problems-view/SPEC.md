---
Status: Reviewed
Owner: Copilot
Last updated: 2026-10-31
Related ADRs: []
---

# Feature: Diagnostics and Problems View

![Status: Reviewed](https://img.shields.io/badge/status-Reviewed-0D6EFD?style=for-the-badge)

## 1. Summary

Give planners a complete, localized repair surface in the native VS Code Problems panel for
document-associated Ganttee errors and warnings, rather than requiring them to discover failures
through notifications, sidebar tooltips, or individual forms. Every user-facing error or warning
describes affected items by their labels, never by exposing internal identifiers. Existing inline
feedback remains and may duplicate Problems. Only operational errors and warnings with no associated
`.ganttee` TextDocument are excluded from Problems; their existing localized, label-based
notifications remain. This specification supersedes the historical [intent](./INTENT.md), and Q-01
records the resolved exclusion.

## 2. Goals / Non-goals

### Goals

- Publish all independently detectable document errors and warnings to native Problems, including
  parsing, structure, graph validation, scheduling, and warning-producing normalization.
- Mirror unsaved form feedback, rejected-edit explanations, and document-associated operational
  errors and warnings in Problems without claiming they exist in document text.
- Use item labels consistently in Problems, notifications, sidebar tooltips, form feedback, and
  visible error summaries.
- Provide accurate source ranges where available and honest document-level fallback navigation.
- Maintain independent diagnostics for every open `.ganttee` TextDocument, including inactive
  documents and documents opened only in the text or settings editor.
- Preserve existing validation, edit acceptance, automatic-cleanup, and scheduling failure policies.
- Preserve localized, label-based notifications for documentless operational errors and warnings.

### Non-goals

- A new activity-bar view, custom Problems panel, or Ganttee-specific filtering interface.
- Guaranteed native Problems activation that selects a chart item, opens its form, or reveals a
  dependency in the custom editor.
- A workspace-wide scan of closed files, automatic repairs beyond existing cleanup, or new
  scheduling rules.
- Persisted diagnostics, schema changes, or replacing the timeline, sidebar, or inline feedback.
- Publishing documentless operational errors and warnings to Problems or creating a synthetic
  Problems resource for them. This exclusion does not apply to document-associated operations,
  draft/rejected-edit feedback, or document findings without an item reference or precise range.
- Mirroring confirmation dialogs, informational messages, debug output, or other extensions'
  diagnostics. An error or warning is not excluded merely because it currently appears in a log.

## 3. Epic

**Understand and repair every document-associated Ganttee problem through native VS Code tooling.**
Planners can inspect errors and warnings across open schedules, understand the affected items
without decoding IDs, follow source locations, and trust that findings reflect the current document
or an explicitly identified transient editing or operational context.

## 4. User Stories & Acceptance Criteria

- As a planner, I want all document problems in native Problems, so that I can assess schedule
  health without opening each form.
  - Given an empty or whitespace-only document When it is evaluated Then it has no diagnostics
    solely because it is empty.
  - Given malformed JSON When evaluation runs Then a localized Error appears with a supported source
    location or document-start fallback, and no invented model is published.
  - Given readable JSON with independent invalid dates, duplicate records, and missing group
    references When validation runs Then each independently detectable issue appears; validation
    does not stop reporting solely because the first issue blocks model construction.
  - Given a self-loop, parallel dependency edges, a dependency cycle, or a group-parent cycle When
    its prerequisites can be safely evaluated Then its structural Error appears and the existing
    structural failure policy remains unchanged.
  - Given semantic diagnostics When evaluation runs Then every occurrence of `underConstrained`,
    `overConstrained`, `danglingDependency`, `groupDependency`, `unanchoredComponent`, and
    `invalidWorkingCalendar` is represented, including diagnostics with no item reference.
  - Given blocking and advisory semantic findings When they are published Then blocking findings use
    Error and advisory findings use Warning; publishing does not change edit acceptance.
  - Given a caught scheduling failure not present in snapshot diagnostics, including a zero-duration
    task rejected by scheduling When evaluation runs Then its localized Error also appears.
  - Given invalid view values or unknown status references that trigger fallback When evaluation
    runs Then each warning appears even if rendering uses a normalized value.
  - Given successful existing automatic cleanup When its replacement TextDocument is observed Then
    obsolete source findings are removed and a document-associated cleanup Warning explains the
    removed items by their pre-cleanup labels.
  - Given cleanup is rejected When the operation completes Then its Error appears and findings for
    the unchanged source remain.

- As a planner, I want readable labels in all error and warning messages, so that I know what to
  repair without interpreting internal IDs.
  - Given a task, milestone, group, or status with a nonblank name When any user-facing error or
    warning refers to it Then it uses that name and the correct item kind.
  - Given a dependency without its own name When a message refers to it Then it identifies the
    source and target by their labels and the localized dependency type, not the dependency ID.
  - Given a missing endpoint, blank name, or malformed item When no valid label is available Then a
    localized missing/unnamed item descriptor is used, never an ID fallback.
  - Given duplicate names or duplicate IDs When a diagnostic identifies affected occurrences Then
    kind, group context, related source locations, or a human-readable occurrence number
    disambiguates them without exposing IDs.
  - Given a removed item When the cleanup warning is presented Then it uses the label captured from
    the source revision that caused cleanup, without looking up an unrelated new item.
  - Given an unsent draft renames an item or introduces a new labeled item When draft feedback is
    published Then it uses that draft's label, not the backing document's previous name or an
    unnamed fallback caused by a failed document lookup.
  - Given an underlying parse, graph, or scheduling exception contains IDs When it reaches a visible
    error surface Then structured, localized wording replaces the raw exception text.
  - Given a label equals an internal identifier as authored by the user When it is displayed Then
    the authored label is retained; the prohibition is on identifier substitution, not label text.

- As a planner, I want nearby form feedback and Problems together, so that I can repair a draft
  without mistaking it for a saved document error.
  - Given an unsaved task or milestone draft with determinacy warnings or errors When feedback
    changes Then inline feedback remains and Problems shows the same findings marked as draft
    feedback for that editor session.
  - Given an invalid date ordering, duration, group self-parent choice, holiday range, or blank
    status name When form validation prevents submission Then its error is mirrored in Problems even
    when no proposal is sent to the host.
  - Given browser-native form validation rejects an input When that validation is exposed to the
    user Then Problems receives an equivalent localized explanation rather than browser wording.
  - Given a host-rejected proposal with several blocking findings When its result arrives Then all
    explanatory findings appear as rejected-edit feedback, the form remains open, and no proposed
    model replaces the authoritative document.
  - Given a draft is repaired, canceled, closed, or successfully applied When its owning session
    updates Then its obsolete transient findings disappear without clearing document findings.
  - Given a result from an old revision or an ended form session When it arrives Then it cannot
    resurrect stale feedback or change another session's findings.
  - Given an open form receives a newer valid document revision When its feedback is refreshed Then
    old-revision draft and rejected-edit findings are cleared and draft-local feedback is recomputed
    against the current revision without applying the draft.
  - Given an open form is based on a valid document When that TextDocument changes and becomes
    invalid Then the parse error includes the current document revision, document findings are
    replaced, stale draft and rejected-edit findings are cleared, and the form stays open.
  - Given an open form remains based on an older valid model while its TextDocument is invalid When
    the form's local fields are revalidated Then draft-local feedback is recomputed against the
    current revision, but save and apply actions remain blocked until a valid document is available
    and the form is rebased; the stale model cannot replace the invalid source.
  - Given an open form is rebased to a newer valid document revision When its feedback is recomputed
    Then it reflects the rebased draft and current revision, and findings from prior revisions
    cannot return.
  - Given image export fails or a document-associated command cannot complete When its error is
    shown Then Problems also contains an explicitly operational finding with the same explanation.
  - Given an operational error or warning has no associated `.ganttee` TextDocument, such as project
    creation without an open workspace When it is reported Then its existing localized notification
    remains, uses labels for any item references, and creates no Problems entry or synthetic
    resource.

- As a planner, I want useful native navigation, so that I can locate the actual source to repair.
  - Given a diagnostic with a known authored field span When native navigation uses that diagnostic
    Then its URI and range identify the current TextDocument field, not normalized array positions.
  - Given a dependency error When its source record is identifiable Then the primary range targets
    that dependency or invalid endpoint field and related information identifies available endpoint
    locations by label.
  - Given a duplicate ID or cycle When all implicated locations are known Then related information
    identifies the additional occurrences or cycle participants without displaying their IDs.
  - Given malformed input, migrated fields, or an ambiguous source mapping When a precise range
    cannot be established Then a valid zero-width document-start range is used without claiming
    precision.
  - Given a draft or document-associated operational finding When it has no offending source span
    Then its message identifies that context and its range is a current related item span or
    document-start fallback.
  - Given activation in native Problems When VS Code chooses its editor Then standard resource
    navigation is supported; chart selection or form opening is not an acceptance requirement.

- As a planner, I want correct ownership and refresh, so that stale findings never mislead me.
  - Given two open schedules When either changes Then only that URI's document findings are replaced
    and both schedules remain available in native Problems.
  - Given a schedule open only as text or settings When it changes Then diagnostics refresh without
    requiring an active chart controller.
  - Given two chart/settings panels for one URI When either opens or closes Then document findings
    are not duplicated and closing one panel does not clear the still-open document's findings.
  - Given a panel with draft feedback and an export failure When that panel closes but its
    TextDocument remains open Then its draft feedback clears and the URI-owned export finding
    remains until an operational expiration condition occurs.
  - Given two attempts of the same operation complete out of order When their results are published
    Then only the newest attempt may replace or clear that operation's finding.
  - Given the user dismisses an operation finding When an older attempt later fails Then the
    dismissed finding stays cleared; a newer attempt may publish a new finding.
  - Given URI-owned operation findings exist When any non-cleanup TextDocument change occurs,
    including direct edits, undo, redo, accepted controller edits, or a change that leaves the
    source invalid Then those operation findings expire; the cleanup operation's own replacement is
    exempt.
  - Given focus switches between schedules When the active controller changes Then existing Problems
    entries persist; VS Code's native filters govern which entries are visible.
  - Given a valid document becomes invalid When parsing fails Then previous document findings are
    replaced with current source findings, even if a host controller retains its last valid model.
  - Given an older evaluation finishes after a newer document revision When publication is attempted
    Then only findings for the current revision are published.
  - Given undo, redo, label renaming, or a successful repair When the TextDocument changes Then
    ranges and messages refresh and resolved source findings disappear.
  - Given the last TextDocument for a URI closes or the extension deactivates When resources are
    disposed Then owned findings and subscriptions are removed; findings of other extensions are
    untouched.

## 5. Business Rules

- Native Problems is the complete error/warning surface for document-associated Ganttee findings;
  inline feedback and existing notifications may duplicate it.
- Only operational errors and warnings without an associated `.ganttee` TextDocument are excluded
  from Problems. Their existing notifications remain localized and label-based; no synthetic
  Problems resource is created. Missing item references or precise source ranges do not qualify a
  document-associated finding for this exclusion.
- The `.ganttee` TextDocument, including unsaved text changes, is the single source of truth.
  Diagnostics never become another persisted or editable project state.
- All independent issues whose prerequisites are valid are reported. Dependent checks are skipped
  when their inputs are unsafe; skipped checks do not fabricate cascading failures or valid models.
- Diagnostic severity and blocking policy are separate. Existing semantic blocking checks still
  prevent persistence; advisory warnings do not. Structural failure and scheduling-unavailable
  behavior remain unchanged. Diagnostics publication itself never writes document text.
- Existing automatic cleanup remains a controller-owned WorkspaceEdit operation. Reporting captures
  the original issues before cleanup and reevaluates only the observed replacement TextDocument.
- Each finding declares whether it describes document text, draft feedback, a rejected edit, or an
  operation. Transient findings do not affect graph validation or edit acceptance.
- Every document revision invalidates draft and rejected-edit feedback based on an older revision.
  An open form recomputes only draft-local feedback against the current revision without applying
  its draft. If the source is invalid, the form stays open but cannot save until a valid source is
  available and the form is rebased.
- An operation has a stable internal key scoped to its URI. Each retry has a strictly increasing
  attempt generation; only the newest attempt may replace or clear that operation's finding.
  Independent operations have independent keys. A successful newest retry clears that operation's
  finding, and an explicit localized dismiss action clears only its current finding; late results
  from older attempts cannot restore it. A later retry may publish a new finding.
- URI-owned operational findings expire on any observed non-cleanup TextDocument change, including
  typing, undo, redo, accepted controller edits, and changes that leave the document invalid.
  Automatic cleanup identifies its own replacement change, which does not expire its cleanup
  finding. Document close also clears URI-owned operational findings.
- One logical occurrence per origin/context is published; distinct affected occurrences are not
  collapsed by label. Duplicate inline and Problems presentation is allowed. Independent sessions
  remain independent even if their draft labels match.
- All visible diagnostic messages, summaries, source descriptions, related-information messages,
  notifications, tooltips, and inline errors/warnings use localized templates. Raw exception text,
  dependency IDs, status IDs, entity IDs, request IDs, and ID chains are not substituted into them.
- Document findings use labels from the evaluated source revision. Draft findings use labels from
  that draft generation; rejected-edit findings use labels from the rejected proposal. Cleanup
  findings use pre-cleanup source labels. These presentation contexts never replace project state.
- Named references use their origin's nonblank authored label. Unnamed items use localized kind
  descriptors; missing references use localized missing-item descriptors. Blank whitespace is
  treated as unnamed for presentation without changing the authored value.
- IDs remain available internally for identity, routing, deduplication, and source lookup. No schema
  name field is added to dependencies; their display identity is labels of both endpoints plus type.
- Native diagnostic codes identify categories, not document-local IDs. Every published range is
  valid for the current owning resource; related locations are omitted when unavailable.
- Problems is not forcibly opened for every validation refresh. Consent dialogs are not findings.

## 6. Domain & Data Model Impact

### Existing foundations

- [ScheduleDiagnostic](../../../src/common/models/project/scheduleDiagnostic.ts) is the current
  semantic union; the intent's proposed `GraphValidationResult` is not the current contract.
- [Document parsing](../../../src/services/document/documentService.ts),
  [shape validation](../../../src/services/document/documentShapeValidationService.ts), and
  [relation validation](../../../src/services/document/documentRelationValidationService.ts)
  currently throw on the first failure and do not expose authored source ranges.
- [Graph validation](../../../src/services/schedule/scheduleGraphValidationService.ts),
  [constraint evaluation](../../../src/services/schedule/scheduleConstraintService.ts), and
  [graph sanitization](../../../src/services/schedule/scheduleGraphSanitizationService.ts) supply
  existing semantic and cleanup rules.
- [Snapshot creation](../../../src/services/model/projectSnapshotService.ts) returns scheduling
  errors separately from snapshot diagnostics;
  [scheduling](../../../src/services/schedule/schedulingService.ts) supplies those errors.

### Changed contracts and ownership

Introduce an additive, pure diagnostic description contract in `src/common/models/`, shared by
document validation, semantic evaluation, and presentation. Preserve the semantic union and valid
model contracts. Collecting validation descriptions does not require hydrating an invalid project.
Parser, relation, graph, and scheduling failures expose structured descriptions rather than relying
on English exception text for visible messages. Warning-producing normalization exposes findings
without changing its existing defaults or repair policy.

| Field             | Type                  | Description                                                  |
| ----------------- | --------------------- | ------------------------------------------------------------ |
| Category          | Stable category       | Diagnostic kind, never a document-local ID                   |
| Severity          | Error or warning      | Presentation severity; blocking policy remains separate      |
| Message arguments | Structured values     | Counts, field descriptors, and typed subject references      |
| Subjects          | Typed references      | Internal identity plus occurrence/path when duplicates exist |
| Source location   | Optional offsets/path | Authored location, not normalized model coordinates          |
| Related locations | Optional locations    | Additional affected authored occurrences                     |

Pure services own validation and source-location descriptions; they import neither VS Code, Node,
nor DOM APIs. Offsets refer to the untrimmed original text. Migration/normalization cannot silently
turn a derived path into a claimed authored span. Services do not localize via host APIs.

A host adapter in `src/views/` owns the native DiagnosticCollection, URI/revision tracking, native
ranges, localization, and transient contexts. It derives one replaceable document projection per
open URI, independently of the focused controller in [GanttStore](../../../src/ganttStore.ts).
Activation in [extension.ts](../../../src/extension.ts) owns its lifetime. Panel sessions own
draft/rejected-edit feedback only, not document diagnostics or URI-owned operational findings.

The [controller](../../../src/views/editor/ganttEditorController.ts) retains edit/cleanup authority;
the [provider](../../../src/views/editor/ganttEditorProvider.ts) supplies panel lifecycle and
document association. Session disposal clears only session-owned draft/rejected-edit findings.
Operational findings are URI-owned by the host adapter and survive panel disposal while the document
remains open; they follow the operational expiration rules in section 5. Label presentation extends
[the existing presenter](../../../src/views/scheduleDiagnosticPresenter.ts) and equivalent browser
presentation through the same label contract, not duplicated validation rules. Current references
that fall back to IDs and direct forwarding of service exception messages must be replaced.

No persisted document shape changes. `CURRENT_DOCUMENT_VERSION` is unchanged; no migration is
required. Diagnostic projections, captured cleanup labels, and transient contexts are disposable
derived presentation state.

## 7. Protocol Impact

Native document diagnostics are host-owned and do not require webview round-trips. The intent's
blanket “no protocol change” is superseded because browser-only feedback, including failed export
and unsent invalid drafts, otherwise cannot reach Problems.

Extend [the shared protocol](../../../src/common/protocol.ts) with a browser-to-host feedback
replacement/clear contract. Its fields describe the owning editor session, feedback context,
monotonic feedback generation, base document revision, origin, structured diagnostic descriptions,
and origin-specific label/occurrence context for referenced draft or proposed items. Operation
feedback also carries a stable logical operation key and a strictly increasing attempt generation.
This context is presentation data, not a replacement model; it supports unsent renamed and newly
introduced items. URI ownership is supplied by the receiving controller, not trusted from the
browser. Empty feedback clears only that context. Old or duplicate generations, invalid categories,
disposed sessions, and incompatible revisions are ignored without producing recursive diagnostics.
Browser-originated operational feedback transfers to the URI-owned operation context; subsequent
panel disposal does not clear it. Host rejection findings capture proposal labels before the
proposal is discarded.

- Browser UI reports its existing feedback; shared services remain the owner of multi-surface edit
  rules. The host does not apply draft edits or treat feedback as a new project snapshot.
- `documentChanged` and `documentError` identify the current document revision; `documentError`
  remains localized visible feedback and does not transport document ownership. On either message,
  the host clears old-revision transient feedback. An open form recomputes draft-local feedback and
  remains open; it cannot submit against a stale model while the source is invalid.
- Preserve `documentChanged`, revision checks, and the independent ordering of edit acknowledgments.
  Host-side rejection findings are published directly, not duplicated through a browser echo.
- Existing `settingsEditResult` and `updateEntityResult` continue to govern authoritative
  acceptance. Add structured rejection explanations where required to display the same complete,
  localized feedback inline; keep request correlation and successful acknowledgments unchanged.
- Use the existing `l10nCatalog` bridge and browser localization for new label fallbacks, origin
  descriptors, category explanations, and feedback strings. No VS Code imports enter the webview.
- No chart-selection/navigation message or documentless operational resource contract is required.
  Documentless operational errors and warnings retain their existing notification path only.

## 8. UX

- **Native Problems:** use native resource grouping, severity icons, keyboard navigation, and
  severity/text filters. No custom grouping or empty state is added. Ganttee identifies its source
  and uses concise labels; complete occurrences remain separate rather than hidden in summaries.
- **Timeline:** retain existing rendering and scheduling-unavailable/error behavior. Problems
  navigation does not promise chart reveal or a custom selection.
- **Sidebar:** retain proximity badges and tooltips in
  [GanttExplorerProvider](../../../src/views/sidebar/ganttExplorerProvider.ts). Their messages
  follow the same label and localization contract; Problems also includes project-level findings
  that cannot be represented on an item node.
- **Edit form:** retain inline notices, native input constraints, rejected-save feedback, and form
  retention on rejection. Mirror visible errors/warnings in Problems with a draft or rejected-edit
  descriptor; do not mark valid source text as if it contains an unsaved invalid value. Keep an open
  form when its source becomes invalid, recompute draft-local feedback, and block saves until valid
  source is rebased.
- **Notifications and operations:** keep existing actionable notifications, with label-safe
  explanations, and mirror document-associated warnings/errors rather than consent prompts.
  Documentless operational errors and warnings retain notifications but are not mirrored in
  Problems. Offer a localized operation-specific dismiss action from the native diagnostic; it
  clears only that operation's current finding.

Design rationale: **Focused** → **one thing leads, the rest supports** → keep the chart primary,
Problems the complete secondary repair surface, and form/sidebar signals near the edit. **Calm** →
**quiet at rest** → no new panel chrome, forced panel opening, or repeated notification per
diagnostic refresh. **Consistent** → native severity and navigation conventions rather than
unsupported custom-editor behavior.

## 9. Test Strategy

### Unit coverage

- Extend document-service, shape/relation-validation, migration, graph-validation, constraint,
  sanitization, scheduling, and snapshot tests under `src/test/unit/services/`.
- Exercise every semantic category and both over-constraint severities; include project-only
  calendar findings, zero duration, invalid dates, cycles, dangling/group endpoints, duplicate IDs,
  and several independent structural faults with safe dependent-check suppression.
- Test original-text location mapping with whitespace, Unicode, duplicate keys/records, malformed
  JSON, legacy fields, migrated sequences, missing fields, empty input, and fallback ranges.
- Extend [presenter tests](../../../src/test/unit/views/scheduleDiagnosticPresenter.test.ts) for all
  categories, correct task/milestone/group/status kinds, dependency endpoint labels, missing and
  blank names, duplicate-label disambiguation, and captured pre-cleanup labels.
- Use distinctive sentinel IDs absent from labels and assert their absence from all rendered
  messages, summaries, related information, and codes; separately test an authored label equal to
  its ID. Test English/French localization and fallback catalog behavior.
- Test feedback ownership, replace/clear, rejection details, stale generations/revisions, accepted
  edits, operation retry/dismissal, and disposal independently of browser or VS Code APIs where
  possible.
- Test that parse failures carry the current revision, clear stale transient findings, retain open
  forms, recompute draft-local feedback, and block saves until a valid document is rebased.
- Test operational expiration on direct text changes, undo, redo, accepted controller edits, and
  invalid resulting text; verify cleanup's own replacement does not expire its warning.
- Test stable operation keys, increasing attempt generations, independent operation findings,
  out-of-order retry completion, latest-attempt success/failure, explicit dismissal, and late
  failures after dismissal.
- Table-drive old, equal, and new feedback generations, incompatible revisions, malformed
  categories, two sessions with identical labels, and ended sessions. Verify ignored input cannot
  create recursive findings or clear another origin/context.
- Include normalization warnings alongside structural failures, deferred cleanup observation, and
  repeated errors from independent operations. Assert exact finding sets, not only counts.
- Test draft-renamed/new item label context and URI-owned export errors surviving panel close.
- Test documentless operational errors and warnings retain localized, label-based notifications
  without publishing Problems entries or creating a synthetic resource. Verify document-associated
  operations, project-level findings without item references, and fallback-range findings remain
  included.

### Integration coverage

- Extend document-load/migration/model-hydration integration fixtures without changing existing
  acceptance or cleanup expectations.
- Keep pure multi-service integration tests in the existing Node Mocha runner, with no VS Code
  imports. Put coverage-bearing host behavior in unit-tested logic with injected events, collection,
  revision, edit, and localization callbacks.
- Use Extension Host unit tests for native API behavior, including
  `vscode.languages.getDiagnostics(uri)` after opening and editing documents; verify severity,
  source, categories, current ranges, related information, and absence after repair/close.
- Cover two URIs, text-only documents, settings-only documents, multiple panels for one URI, focus
  changes, dirty text, undo/redo, malformed-to-valid recovery, and old evaluation completion.
- Cover valid-to-invalid changes with open forms, revision-bearing parse errors, blocked stale
  submissions, rebase after recovery, and transient feedback replacement.
- Verify cleanup publication before rewriting, retained cleanup explanation after its own rewrite,
  cleanup failure, cleanup-change exemption, expiration on every non-cleanup text change, and
  captured removed labels.
- Verify parse failures refresh Problems despite the retained host snapshot, rejected WorkspaceEdit
  never publishes the proposed model, and warnings do not become blocking.
- Verify collection disposal and close clear only Ganttee-owned entries. Test native resource/range
  navigation without requiring automatic chart reveal.
- Use bounded event/condition waits instead of fixed delays. Restore documents, panels, and
  collections in teardown. Smoke tests cover new activation wiring only.

### Webview interaction coverage

- Extend entity-editor presentation and localization tests; exercise draft feedback while typing,
  invalid submit with no host proposal, native constraint explanations, settings feedback, cancel,
  success, rejection, and independent acknowledgment/document-change arrival orders.
- Verify Problems mirroring leaves inline messages and editing workflows intact, failed export is
  reported to the host, and stale sessions cannot clear or overwrite another form's findings.
- Unit-test existing browser `.ts` presentation/interaction helpers with injectable feedback and
  proposal sinks; do not add a DOM renderer, global stubs, or a new test runner. Verify invalid
  submission emits feedback while leaving the proposal callback uncalled.
- Manually check native Problems keyboard/accessibility behavior, inline notice readability, and
  native editor-choice presentation; URI/range and localized message contracts are automated.

### Coverage gate

Branch and function coverage stay at least 90% per `.ts` file under `src/` imported by unit tests,
including changed/new service, presenter, lifecycle, protocol-feedback, and browser helper logic.
`.tsx` files are exempt under the existing no-DOM test setup. Unit tests supply coverage;
integration and smoke tests do not substitute for it. Inventory uncovered branches and add targeted
fixtures before completion. Use the existing Mocha TDD runners and `npm run test:coverage-check`;
host and webview type checks, lint, focused unit/integration suites, and supported activation smoke
tests are implementation gates. This specification does not claim that production test coverage has
been measured. Q-01 is resolved; its documentless notification-only behavior is covered by the test
cases above.

## 10. Risks

### Medium risks

- 🟡 **M-01** — Dependency diagnostics do not have a single tree node to select.
  - Status: **Resolved** — The intent's source-node navigation and endpoint-ID details are
    superseded by native dependency source ranges and related endpoint locations labeled by name; no
    custom-editor reveal is promised.
- 🟡 **R-01** — First-failure parsing and load-time cleanup can hide additional source issues.
  - Status: **Resolved** — Collect independent findings before cleanup, suppress unsafe dependent
    checks, retain current validation policies, and reevaluate observed TextDocument replacements.
- 🟡 **R-02** — Migrated data and duplicate identifiers can produce misleading locations or labels.
  - Status: **Resolved** — Map authored occurrences, retain revision-specific label context, and use
    document-start fallback rather than guessing a span or substituting an ID.
- 🟡 **R-03** — Multiple panels and transient feedback can overwrite another document or session.
  - Status: **Resolved** — A URI-owned host collection publishes revision-bound document findings;
    session/context ownership and feedback generations isolate transient findings.

Legacy M-01 is retained unchanged as an ID. New risks use R identifiers under the
[shared convention](../../../.github/skills/feature-spec/assets/open-question-ids.md).

## 11. Open Questions

### High questions

- 🔴 **Q-01** — Which native Problems resource owns operational errors/warnings with no associated
  `.ganttee` TextDocument, such as creating a project without an open workspace?
  - Status: **Resolved** — User decision: exclude only documentless operational errors and warnings
    from Problems and keep their existing localized, label-based notifications. No synthetic
    resource is introduced; all document-associated findings remain in scope.

### Medium questions

- 🟡 **M-02** — Should diagnostics use an activity-bar view, adjacent panel, or sidebar adaptation?
  - Status: **Resolved** — The approved goal explicitly chooses native VS Code Problems; no
    dedicated Ganttee diagnostics view is introduced.

### Low questions

- 🟢 **L-01** — Should semantic warnings be filterable by category or severity in the first release?
  - Status: **Resolved** — Use native severity and text filtering, with stable diagnostic
    categories; additional Ganttee-specific category controls are out of scope.

Legacy M-02 and L-01 are retained unchanged as IDs. New questions use Q identifiers under the shared
convention. No ADR is required for the approved native presentation choice or label-only wording.
