---
Status: Reviewed
Owner: Copilot
Last updated: 2026-07-19
---

# Feature: Dependency Type Rename & Migration

![Status: Reviewed](https://img.shields.io/badge/status-Reviewed-0D6EFD?style=for-the-badge)

<!-- AGENT NOTE: Keep this badge synced with front matter Status.
Canonical status-to-badge mapping is defined in
.github/instructions/feature-spec.instructions.md (Rules section). -->

## 1. Summary

The scheduling model renames two dependency types to match the graph requirement
([in-memory-graph.md](../requirements/in-memory-graph.md)): `finishWith` →
`endWith` and `finishAfter` → `endBefore`, and adopts a single owner convention
where the **owner (dependent entity) is always the `source`** and the anchor is
always the `target`. Because today's documents store the predecessor as `source`,
the migration must both rename the types **and swap `sourceId` ⇄ `targetId`** so the
real-world meaning is preserved. As the type string and the ids are persisted in
`.ganttee`, this requires a schema version bump and a deterministic migration so
existing documents keep working.

## 2. Goals / Non-goals

### Goals

- Rename `DependencyType` members `finishWith`→`endWith`, `finishAfter`→`endBefore`.
- Adopt the owner=`source` / anchor=`target` convention for all four types.
- Bump `CURRENT_DOCUMENT_VERSION` and migrate legacy documents on parse: rename
  types **and** swap `sourceId` ⇄ `targetId` so the dependent entity is the source.
- Update protocol, webview, sidebar, and tests to the new names.
- Document corrected temporal semantics for all four dependency types.

### Non-goals

- Any scheduling computation or effective-date logic (see scheduling-engine spec).
- New constraint model / duration field (see scheduling-data-model spec).
- New validation rules beyond existing cycle/dangling checks (see graph-validation
  spec).

## 3. User Stories

- As a planner with existing `.ganttee` files, I want old dependency types to load
  unchanged, so that a rename doesn't corrupt my plans.
- As a developer, I want one canonical set of dependency-type names, so that host
  and webview stay consistent.

## 4. Acceptance Criteria

- Given a v1 document containing `finishWith`/`finishAfter`
  When it is parsed
  Then each dependency is migrated to `endWith`/`endBefore`, its `sourceId` and
  `targetId` are swapped, and the document re-serializes at the new
  `CURRENT_DOCUMENT_VERSION`.

- Given a v1 document with `startAfter`/`startWith` dependencies
  When it is migrated
  Then their `sourceId`/`targetId` are also swapped so the dependent (successor)
  becomes the source, preserving the original real-world constraint.

- Given a document already at the new version
  When it is parsed
  Then no migration runs and the dependency types and ids are preserved verbatim.

- Given a dependency with an unknown/legacy type string
  When it is parsed
  Then parsing fails with `GanttParseError` (existing behavior), and the host
  surfaces the failure to the user without mutating the document.

- Given a v1 document whose dependencies are rendered in the timeline
  When it is migrated and opened in the webview
  Then dependency links preserve the same real-world relationship semantics as
  before migration (no visual meaning inversion after `sourceId`/`targetId`
  swap).

- Given the webview and sidebar reference dependency types
  When the project builds
  Then only `endWith`/`endBefore` are referenced (no `finishWith`/`finishAfter`).

## 5. Domain & Data Model Impact

- `src/common/models/dependency.ts`: `DependencyType` renamed; JSDoc corrected to
  the owner=`source` / anchor=`target` table (`endBefore` = `source.end ≤
target.start`).
- `.ganttee` schema: bump `CURRENT_DOCUMENT_VERSION` in
  `src/common/models/document.ts`; add a migration in the parse path of
  `src/services/ganttDocumentService.ts` that, for every dependency, maps the old
  type to the new one and swaps `sourceId` ⇄ `targetId`, then sets the version.

## 6. Protocol Impact

- `src/common/protocol.ts`: messages carrying `Dependency` inherit the renamed
  type automatically; verify `addDependency`/`removeDependency` payload types.

## 7. UX

- Timeline (ECharts): dependency rendering labels/tooltips use new names via
  localized strings; no visual redesign.
- Sidebar tree: no structural change.
- Edit form: the dependency-type selector option keys use the new identifiers;
  labels localized.

Design rationale (values → principles → moves): Value Trust · Principle: a rename
must never lose user data · Move: version bump plus deterministic migration with
round-trip stability.

## 8. Test Strategy

- Unit: migration maps `finishWith`→`endWith`, `finishAfter`→`endBefore`, swaps
  `sourceId` ⇄ `targetId` for every dependency (including `startAfter`/`startWith`);
  version bumped; round-trip parse→serialize→parse is stable; no-op on current
  version; unknown type flagged.
- Integration (commands/editor): controller add/remove dependency functions with
  new names.
- Webview interaction: dependency-type selector emits new keys.
- Coverage: branch coverage ≥ 90% across migration branches (legacy, current,
  unknown type).

## 9. Risks & Decisions

### Risk Decisions

- 🟡 Medium — Risk: other branches/PRs still using old names
  (`finishWith`, `finishAfter`).
  Decision: accept with mitigation.
  Mitigation: land the rename as one atomic change across model types, parser
  migration, protocol/webview call sites, and tests. Add a repo-wide grep check
  in CI to prevent reintroduction of old identifiers.

- 🟡 Medium — Risk: `sourceId`/`targetId` swap could invert meaning if any
  consumer still assumes source=predecessor.
  Decision: reduce before implementation completes.
  Mitigation: mandatory audit of all dependency readers/writers
  (`ganttDocumentService`, `dependencyGraphService`, editor controller,
  `TaskForm`, `GanttChart`) and regression tests that assert real-world
  dependency meaning is preserved after migration.

### Open Question Resolution

- 🟢 Low — Question: keep accepting legacy type strings indefinitely, or
  migrate only from the immediately previous version?
  Resolution: migrate from the immediately previous schema version only
  (one-version migration window). For this change, support deterministic
  migration from v1 to v2.
  Rationale: keeps migration logic explicit and testable while limiting
  long-term compatibility maintenance.

### Residual Risk

- 🔵 Nice to have — Future dependency-type renames must repeat the same
  schema-discipline pattern: version bump, deterministic migration, and
  round-trip stability tests.

## 10. Validation Outcome

- Spec is implementation-ready.
- Status is `Validated`.
- Risk treatment and migration-window policy are explicit.
- Acceptance criteria now match parser architecture and include timeline
  semantic stability after migration.
