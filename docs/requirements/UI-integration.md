# UI Integration — Entity Edit Forms

> Status: Refined · Owner: Copilot · Last updated: 2026-07-26

## 1. Purpose and context

Ganttee will introduce several new domain entities (Task, Milestone, Group,
and later Resource). Each entity needs an **edit form** so users can create and
modify it from the UI. This document is the **cross-cutting UI-integration
requirement** for those forms: where they live, how they are localized, how
they validate input, and which technical approach is chosen.

Entity-by-entity behavior and acceptance criteria are owned by the feature
spec [Editable Work Item Kinds](../specs/editable-all-task-kinds.md) (this need
strong refinement). This
document does not duplicate them; it defines the shared UI-integration surface
those specs build on.

## 2. Glossary

- **Entity** — A domain object the user can edit (Task, Milestone, Group,
  future Resource).
- **Edit form** — The set of input fields used to create or modify one entity.
- **Field type** — A reusable input control (see the catalog in
  [Section 4](#4-functional-requirements)).
- **Host** — The extension process (Node). Owns the `.ganttee` TextDocument,
  `vscode.l10n`, and validation services that need the in-memory model.
- **Webview** — The single browser-context React UI in the editor area,
  hosting the chart and every edit form. Cannot import `vscode` or Node APIs;
  talks to the host via `postMessage`.
- **Navigation tree** — The native tree views in a dedicated Ganttee side-bar
  view container that list and navigate work items and settings. They select,
  but do not edit.
- **Setting** — A configuration record in the same document that also needs an
  edit form (for example working calendar, working-day hours, holiday periods,
  status definitions).
- **l10n bridge** — The mechanism by which localized strings resolved on the
  host are made available to the webview.
- **Host model / webview model** — Two `GanttModel` instances hydrated from
  the same plain document: the authoritative one on the host and a single
  read-only mirror in the webview used for pre-flight validation.

## 3. Constraints and assumptions

- The `.ganttee` TextDocument is the single source of truth; every edit flows
  host-side through a `WorkspaceEdit`, then reparse and rebroadcast.
- `vscode.l10n` is a **host-only** API; the webview cannot call it directly.
- Pure services (parse/validate, dependency graph, task constraints) contain no
  `vscode` imports and are importable by the webview.
- Some validation requires the in-memory model and therefore must run on the
  host (for example task date ordering, group-ancestry cycles, cross-entity
  references).
- A hydrated `GanttModel` instance cannot cross `postMessage` (class methods
  are stripped and `Date` fields become strings), so the webview builds its
  own model from the plain document rather than receiving the host's instance.
- Each webview is an isolated realm; using a **single** webview means exactly
  one webview-side model, shared by all forms — no cross-realm duplication.
- Webviews receive `--vscode-*` theme color variables; design-system size
  tokens are not injected and must be used only with a px fallback.

## 4. Functional requirements

- **FR-1 — Entity-aware forms.** The UI shall provide an edit form for each
  editable entity kind (Task, Milestone, Group; Resource later), presented as a
  single consistent editing surface parameterized by entity kind.
- **FR-2 — Field-type catalog.** The forms shall support the following reusable
  input controls:

  | Field type          | Purpose                                    |
  | ------------------- | ------------------------------------------ |
  | Date-range selector | Pick a start/end pair (for example Task)   |
  | Date selector       | Pick a single date (for example Milestone) |
  | Color picker        | Choose an entity color                     |
  | Text area           | Multi-line text (for example Description)  |
  | Dropdown list       | Select one value from a set                |
  | Number              | Numeric input (for example Duration)       |
  | Text                | Single-line text (for example Name)        |

- **FR-3 — Create and edit.** Each form shall support both creating a new
  entity and editing an existing one, prefilled with the current values.
- **FR-4 — Delete.** The UI shall support deleting an entity, with the
  host enforcing referential integrity (for example dangling dependencies).
- **FR-5 — Single-webview placement.** Work-item edit forms shall live in the
  single chart editor webview, alongside the timeline, so one webview realm
  holds the one webview-side model shared by every form. (Whether settings
  forms reuse this webview or get a dedicated one is an open question in
  [Section 9](#9-open-questions).)
- **FR-6 — Segregated navigation views.** A dedicated Ganttee side-bar view
  container shall host two native tree views: a **Plan** view listing the
  editable work-item entities (groups, tasks, milestones; resources later) and
  a **Configuration** view listing the editable settings (working calendar,
  working-day hours, holiday periods, status definitions). Each view selects an
  item and opens its form; neither view hosts forms.
- **FR-7 — Entry points.** A form shall be openable from both the timeline
  (double-click / context action, for work items) and the relevant navigation
  view, for the selected item.
- **FR-8 — Submit flow.** On save, the form shall send a single typed message
  to the host; the host applies a `WorkspaceEdit`, reparses, and rebroadcasts
  the updated document that re-renders the form and chart.

## 5. Non-functional requirements

- **NFR-1 — Localization (single source).** All user-facing form strings shall
  be localizable from a single source resolved on the host via `vscode.l10n`.
  The webview shall render only localized strings delivered through the l10n
  bridge; it shall contain no hardcoded user-facing English. The bridge is
  specified at the mechanism level only (the host resolves strings and delivers
  a localized string map to the webview); concrete message shapes are defined
  by the implementing feature spec.
- **NFR-2 — Validation split (host authority, webview mirror).** Validation
  shall be layered. The single webview model runs cheap, self-contained checks
  (required fields, value format, pre-flight cycle checks) for instant inline
  feedback via the pure services. The host model remains authoritative and
  re-validates every change before the `WorkspaceEdit`, because non-webview
  write paths exist (manual text edits, host commands). Host rejections shall
  return localized messages.
- **NFR-3 — Accessibility.** Forms shall be keyboard-navigable, expose labels
  and validation messages to assistive technology, and respect the user's
  reduced-motion and contrast preferences.
- **NFR-4 — Theming.** Forms shall use `--vscode-*` theme color variables so
  they match the active color theme; size tokens are used only with px
  fallbacks.
- **NFR-5 — Security.** The webview shall keep the existing CSP with a
  per-render nonce and load scripts and styles only from `dist/`.
- **NFR-6 — Performance.** Opening or switching a form and applying an edit
  shall feel immediate for typical documents and shall not re-request the full
  string catalog on every open.

## 6. Options considered

Three approaches were evaluated against the priority of **UX consistency and
rich inputs**. All three can be localized (Option A and C via the l10n bridge,
Option B natively), so localization is not the deciding factor.

| Option                   | Rich-input UX     | One model | Cost   |
| ------------------------ | ----------------- | --------- | ------ |
| A. Webview + l10n bridge | Strong            | Yes       | Medium |
| B. Native VS Code UI     | Weak (fragmented) | N/A       | Low    |
| C. Hybrid                | Mixed             | Yes       | Medium |

### Option A — Webview forms with an l10n bridge

Reuse the existing React form pattern, generalized across entity kinds, and
host it in the single chart editor webview alongside the timeline. The host
resolves localized strings and delivers them to the webview.

- Strong, consistent UX for date ranges, color pickers, dropdowns, and inline
  validation.
- Reuses the current form and the existing edit flow.
- Requires building the l10n bridge and generalizing the message protocol.

### Option B — Native VS Code UI

Drive editing through `showInputBox`, `showQuickPick`, and similar native
inputs.

- Localization and accessibility come for free.
- Fragmented, multi-modal UX that is poor for date ranges, multi-field
  validation, and dependency-list editing; conflicts with the priority.

### Option C — Hybrid

Keep webview forms for input but route validation failures to native dialogs.

- Best-case error surfacing, but errors move out of the form into modal
  dialogs, worsening the editing loop and adding round-trips.

## 7. Decision and rationale

**Chosen: Option A — webview forms with an l10n bridge, hosted in the single
chart editor webview, with a native navigation tree in the side bar.**

Rationale:

- It best serves the stated priority (**UX consistency and rich inputs**): a
  single custom panel delivers date-range selectors, color pickers, dropdowns,
  and inline validation that native inputs cannot match.
- **One webview realm means one webview-side model.** Keeping every form in the
  single editor webview yields exactly two `GanttModel` instances total — the
  authoritative host model plus one shared webview mirror — avoiding the
  cross-realm duplication that separate form webviews would create.
- Editing and the timeline stay **co-located**, so a save re-renders both the
  form and the chart from one broadcast; the native tree stays a cheap,
  accessible navigator that opens forms without hosting them.
- It **reuses** the current React form and the established one-way edit flow
  (message → `WorkspaceEdit` → reparse → rebroadcast), limiting new surface
  area to the l10n bridge and a generalized message protocol.

**Option B is rejected** because its fragmented, multi-modal experience is a
poor fit for rich, multi-field entity editing and does not meet the priority.
**Option C is rejected** because moving validation feedback into native dialogs
degrades the editing loop that Option A keeps inline.

### Trade-off accepted

Hosting the forms in the editor webview means they are **not dockable** to the
primary/secondary side bar; the side bar carries the native navigation tree
instead. This is accepted in exchange for a single shared webview model and
co-located chart-and-form rendering.

## 8. Consequences and follow-up work

Adopting Option A implies the following implementation work, to be detailed in
the relevant feature spec:

- **l10n bridge (mechanism-only here).** Add a host mechanism that resolves
  form strings via `vscode.l10n` and delivers a localized string map to the
  webview, cached to avoid re-requesting on every open.
- **Protocol generalization.** Extend the host↔webview protocol from
  task-specific messages toward entity-generic ones (open, update, delete by
  entity kind), per
  [Editable Work Item Kinds](../specs/editable-all-task-kinds.md) (this need
  strong refinement).
- **Validation split.** Wire webview pre-flight checks to the pure services and
  keep host-only rules authoritative, returning localized rejection messages.
- **Navigation views.** Add a dedicated Ganttee side-bar view container with a
  **Plan** tree view (work items) and a **Configuration** tree view (settings);
  selecting an item opens the corresponding form. Each view carries its own
  title and context-menu actions.
- **Field components.** Build the reusable field-type controls from
  [Section 4](#4-functional-requirements), themed with `--vscode-*` variables.

## 9. Open questions

- Should settings have a **dedicated webview** for hosting their edit forms, or
  should they reuse the single editor webview like work items? (To be refined.)
- How should the single editor webview present the form beside the timeline
  (inline side panel, overlay, or resizable split) for the best editing focus?
- What is the minimum set of localized strings to bundle at first render versus
  loading lazily per entity kind?
- Is markdown preview in the description text area required later, and if so in
  which feature spec is it scheduled? (Out of scope for this iteration.)
