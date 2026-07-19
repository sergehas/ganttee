# Feature: Dependency Type Rename & Migration

> Status: Draft · Owner: Copilot · Last updated: 2026-07-19

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
  Then it is flagged as an invalid dependency (per existing behavior) and a
  localized warning is surfaced; the document is not silently corrupted.

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

## 9. Risks & Open Questions

- Risk: other branches/PRs still using old names — coordinate the rename.
- Risk: the `sourceId`/`targetId` swap silently inverts meaning if any consumer
  still assumes source=predecessor — audit all dependency readers as part of this
  spec.
- Open question: keep accepting legacy type strings indefinitely, or migrate only
  from the immediately previous version?
