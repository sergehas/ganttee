# Ganttee Context

## Purpose

Ganttee is a VS Code extension for planning and editing project schedules in a Gantt-chart view. It
lets a user manage a project as a set of scheduled work items, group related work together, and
define dependency rules that keep the plan internally consistent.

The project is centered on `.ganttee` documents, which are the source of truth for the schedule. The
editor reads the document, validates it, schedules derived dates, and sends the resulting model to a
React + ECharts webview for interactive editing.

## Product domain

Ganttee models a project plan as a hierarchy of work items and constraints.

### Core business vocabulary

- **Task**: a planned unit of work with a schedule defined by up to two of start, duration, and end.
- **Milestone**: a zero-duration point in time used to mark a significant moment or deadline.
- **Group**: a container for related tasks, milestones, or other groups; groups roll up their
  descendants.
- **Dependency**: a relationship between scheduled items that constrains their temporal order.
- **StartAfter**: a dependency where the source item starts after the target item is complete.
- **StartWith**: a dependency where the source item starts at the same time as the target item.
- **EndWith**: a dependency where the source item ends at the same time as the target item.
- **Schedule**: the calendar-based arrangement of planned work, including derived dates and
  durations.
- **Constraint**: a static schedule input such as start, duration, or end.
- **Working day**: a day on which project work can occur; calendar rules can exclude non-working
  days.
- **Day off**: a non-working day in the project calendar.
- **Holiday**: a non-working period or specific day that should be treated as excluded from
  scheduling.
- **Effective start** / **effective end** / **effective duration**: the computed schedule values
  after dependency and calendar rules are applied.
- **Graph validation**: structural and semantic checks that detect cycles, dangling references,
  invalid endpoints, and under-constrained or over-constrained items.
- **DAG backbone**: the dependency graph structure that is validated as a directed acyclic graph.
- **Hydration**: converting the serialized `.ganttee` document into the in-memory project model.
- **Document version / migration**: compatibility handling for existing `.ganttee` files as the
  schema evolves.

## Scope of the project

Ganttee is a project planning editor, not a generic issue tracker or full project portfolio system.
It focuses on:

- placing work on a timeline,
- grouping and organizing related work,
- applying temporal dependency rules,
- validating schedule integrity,
- computing effective dates from constraints and calendar rules,
- editing the plan directly from a VS Code custom editor and sidebar tree.

The project intentionally keeps the persisted `.ganttee` document as the single source of truth,
with the UI acting as a view/edit layer over that document.

## User-facing workflow

A planner typically:

1. Opens or creates a `.ganttee` project document.
2. Adds tasks, milestones, and groups.
3. Organizes work into a hierarchy.
4. Adds dependencies between items.
5. Reviews validation diagnostics when the graph or schedule is inconsistent.
6. Uses the calendar and schedule rules to compute and adjust effective dates.
7. Saves the document, which is then re-parsed and rehydrated.

## Key tech stack

- **[TypeScript](https://www.typescriptlang.org/)**: primary implementation language for the
  extension and webview.
- **[VS Code Extension API](https://code.visualstudio.com/api/extension-guides/overview)**:
  host-side integration for the custom editor, tree view, and document updates.
- **[Node.js](https://nodejs.org/)**: extension host runtime.
- **[React](https://react.dev/)**: UI layer for the editor/webview experience.
- **[Apache ECharts](https://echarts.apache.org/)**: charting library used for the Gantt timeline
  rendering.
- **[Graphology](https://graphology.github.io/)**: graph library used to model and validate the
  dependency graph used for scheduling and structural checks.
- **`.ganttee` TextDocument**: on-disk project file format and source of truth.
- **Custom editor**: the interactive timeline editor contributed by the extension.
- **Sidebar tree view**: structural navigation and editing surface for project items.
- **WorkspaceEdit**: mechanism for applying document changes from the UI into the open text
  document.
- **Localization**: VS Code l10n strings for user-visible text.

## Architecture vocabulary

- **Host**: the VS Code-side extension logic that owns the document, validation, and edit workflow.
- **Webview**: the browser-side React layer that renders the chart and form interactions.
- **Model hydration**: turning the serialized document into the runtime data model.
- **Dependency graph**: the graph used for validation and scheduling.
- **Schedule engine**: logic that resolves effective dates from constraints and dependency ordering.
- **Validation layer**: the rules that reject cycles, dangling endpoints, invalid task definitions,
  and structural graph problems.

## Glossary boundaries

This glossary intentionally keeps only terms that are specific to Ganttee's scheduling domain and
editor workflow. It excludes general-purpose software terms that do not carry project meaning, such
as broad platform, framework, or generic product phrases unless they are directly relevant to the
extension's behavior.

## Terms to prefer in project communication

Use these terms consistently when discussing the project:

- task
- milestone
- group
- dependency
- schedule
- constraint
- working day
- day off
- holiday
- effective start
- effective end
- effective duration
- dependency graph
- validation
- project calendar
- `.ganttee` document
- Gantt model

Avoid drifting to vague synonyms when a project-specific term already exists.
