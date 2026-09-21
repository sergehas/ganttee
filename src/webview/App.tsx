import { Dependency, Group, Milestone, ProjectView, Task } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import { EditableEntityKind, EditableEntityMap, EditableEntityRef } from "@common/protocol";
import { SaveEntityOptions } from "@services/editing/projectItemSaveGuardService";
import { buildShiftByDaysPatch } from "@services/editing/projectItemSchedulePatchService";
import "@webview/App.scss";
import { IconBaseUriProvider } from "@webview/components/Icon";
import { ChartMenuBar } from "@webview/features/chart/components/ChartMenuBar";
import { GanttChart } from "@webview/features/chart/components/GanttChart";
import { EntityEditor } from "@webview/features/entity-editor/components/EntityEditor";
import { useEntityEditWorkflow } from "@webview/features/entity-editor/hooks/useEntityEditWorkflow";
import { translate, WebviewL10n, WebviewL10nContext } from "@webview/l10n";
import { createGanttViewState, GanttViewState } from "@webview/viewState";
import { onHostMessage, postToHost } from "@webview/vscodeApi";
import { useEffect, useRef, useState } from "react";

/** Webview-only behavior retained until the host acknowledges an entity update. */
interface PendingEntityUpdate {
  /** Editor session that originated the update. */
  editorSessionVersion: number;
  /** Whether successful persistence should leave the editor open. */
  keepEditorOpen: boolean;
}

/** Root editor UI: the ECharts timeline and the entity edit panel. */
export function App(): React.JSX.Element {
  const [viewState, setViewState] = useState<GanttViewState | null>(null);
  const [l10n, setL10n] = useState<WebviewL10n | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EditableEntityRef | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableEntityRef | null>(null);
  const [closingEditingTarget, setClosingEditingTarget] = useState<ResolvedEditingEntity | null>(
    null,
  );
  const [pendingView, setPendingView] = useState<ProjectView | null>(null);
  const [fitVersion, setFitVersion] = useState(0);
  const [iconBaseUri, setIconBaseUri] = useState<string | null>(null);
  const projectRef = useRef<ProjectPresentation | null>(null);
  const editingEntityRef = useRef<EditableEntityRef | null>(null);
  const editorSessionVersionRef = useRef(0);
  const nextUpdateRequestIdRef = useRef(0);
  const pendingEntityUpdatesRef = useRef(new Map<number, PendingEntityUpdate>());

  useEffect(() => {
    const unsubscribe = onHostMessage((message) => {
      switch (message.type) {
        case "l10nCatalog":
          setL10n({ locale: message.locale, strings: message.strings });
          break;
        case "init":
          setIconBaseUri(message.iconBaseUri);
          try {
            const nextViewState = createGanttViewState(message.project, message.revision);
            setPendingView(null);
            projectRef.current = nextViewState.project;
            setViewState(nextViewState);
          } catch {
            setViewState(null);
          }
          break;
        case "documentChanged":
          try {
            const nextViewState = createGanttViewState(message.project, message.revision);
            const currentEditingEntity = editingEntityRef.current;
            setPendingView(null);
            if (
              currentEditingEntity &&
              !resolveEntity(nextViewState.project, currentEditingEntity)
            ) {
              setClosingEditingTarget(
                resolveEntity(projectRef.current ?? undefined, currentEditingEntity),
              );
              updateEditingEntity(null);
            }
            projectRef.current = nextViewState.project;
            setViewState(nextViewState);
          } catch {
            setViewState(null);
          }
          break;
        case "selectEntity":
          setSelectedEntity(message.entity);
          break;
        case "editEntity":
          toggleEntityEditor(message.entity);
          break;
        case "updateEntityResult": {
          const pendingUpdate = pendingEntityUpdatesRef.current.get(message.requestId);
          pendingEntityUpdatesRef.current.delete(message.requestId);
          if (
            message.updated &&
            pendingUpdate &&
            !pendingUpdate.keepEditorOpen &&
            pendingUpdate.editorSessionVersion === editorSessionVersionRef.current &&
            isSameEntity(editingEntityRef.current, message.entity)
          ) {
            closeEntityEditor();
          }
          break;
        }
        case "deleteEntityResult":
          if (message.deleted && isSameEntity(editingEntityRef.current, message.entity)) {
            closeEntityEditor();
          }
          break;
      }
    });
    postToHost({ type: "ready" });
    return unsubscribe;
  }, []);

  /**
   * Sends a revision-bound entity proposal and records its editor behavior by request id.
   * The current UI remains mounted until the host reports whether persistence succeeded.
   */
  const saveEntityToHost = (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: SaveEntityOptions,
  ) => {
    if (!viewState) {
      return;
    }
    const requestId = nextUpdateRequestIdRef.current;
    nextUpdateRequestIdRef.current += 1;
    pendingEntityUpdatesRef.current.set(requestId, {
      editorSessionVersion: editorSessionVersionRef.current,
      keepEditorOpen: options?.keepEditorOpen === true,
    });
    postToHost({
      type: "updateEntity",
      requestId,
      kind,
      entity,
      baseRevision: viewState.revision,
    });
  };

  /** Requests deletion; a successful host result closes the matching editor session. */
  const deleteEntityToHost = (entity: EditableEntityRef) => {
    if (!viewState) {
      return;
    }
    postToHost({ type: "deleteEntity", entity, baseRevision: viewState.revision });
  };

  /** Asks the host to route an entity edit command back through the shared toggle path. */
  const requestEditEntity = (entity: EditableEntityRef) => {
    postToHost({ type: "requestEditEntity", entity });
  };

  /** Toggles the requested entity editor against the current editor identity. */
  function toggleEntityEditor(entity: EditableEntityRef): void {
    const currentEntity = editingEntityRef.current;
    setSelectedEntity(entity);
    if (currentEntity?.kind === entity.kind && currentEntity.id === entity.id) {
      closeEntityEditor();
      return;
    }
    setClosingEditingTarget(null);
    updateEditingEntity(entity);
  }

  /** Closes the entity editor after preserving its content for the exit animation. */
  function closeEntityEditor(): void {
    setClosingEditingTarget(
      resolveEntity(projectRef.current ?? undefined, editingEntityRef.current),
    );
    updateEditingEntity(null);
  }

  /**
   * Updates the rendered editor identity and advances the session used to reject late save results.
   */
  function updateEditingEntity(entity: EditableEntityRef | null): void {
    editorSessionVersionRef.current += 1;
    editingEntityRef.current = entity;
    setEditingEntity(entity);
  }

  /** Sends a new dependency to the extension host. */
  const addDependency = (dependency: Dependency) => {
    if (!viewState) {
      return;
    }
    postToHost({ type: "addDependency", dependency, baseRevision: viewState.revision });
  };

  /** Sends a dependency deletion to the extension host. */
  const removeDependency = (dependencyId: string) => {
    if (!viewState) {
      return;
    }
    postToHost({ type: "removeDependency", dependencyId, baseRevision: viewState.revision });
  };

  const workflow = useEntityEditWorkflow({
    onSave: saveEntityToHost,
    onDelete: deleteEntityToHost,
    onAddDependency: addDependency,
    onRemoveDependency: removeDependency,
  });

  if (!l10n) {
    return <div className="ganttee-app__empty" aria-busy="true" />;
  }

  if (!viewState) {
    return (
      <div className="ganttee-app__empty" aria-busy="true">
        {translate(l10n, "Loading Gantt chart...")}
      </div>
    );
  }

  const editingTarget = resolveEntity(viewState.project, editingEntity);
  const displayedEditingTarget = editingTarget ?? closingEditingTarget;
  const chartView = pendingView ?? viewState.project.view;

  /** Sends a complete chart view proposal through the revision-safe host path. */
  const updateView = (view: ProjectView) => {
    setPendingView(view);
    postToHost({
      type: "updateView",
      view,
      baseRevision: viewState.revision,
    });
  };

  /** Requests a temporary chart viewport fit without changing persisted view data. */
  const fitToWindow = () => {
    setFitVersion((version) => version + 1);
  };

  /** Applies a chart date shift without closing an editor that is already showing the entity. */
  const nudgeEntityByDays = (entity: EditableEntityRef, days: number) => {
    const patch = buildShiftByDaysPatch(viewState.project, entity, days);
    if (!patch) {
      return;
    }
    workflow.patchEntityDatesFromChart(viewState.project, entity, patch, {
      keepEditorOpen: true,
    });
  };

  return (
    <IconBaseUriProvider baseUri={iconBaseUri ?? ""}>
      <WebviewL10nContext.Provider value={l10n}>
        <div className="ganttee-app">
          <div className="ganttee-app__timeline">
            <ChartMenuBar view={chartView} onViewChange={updateView} onFitToWindow={fitToWindow} />
            {viewState.project.tasks.length === 0 && viewState.project.milestones.length === 0 ? (
              <div className="ganttee-app__empty">
                {translate(l10n, "No tasks yet. Use the Ganttee sidebar to add one.")}
              </div>
            ) : (
              <GanttChart
                project={viewState.project}
                view={chartView}
                fitVersion={fitVersion}
                selectedEntity={selectedEntity}
                onEditEntity={toggleEntityEditor}
                onNudgeEntityByDays={nudgeEntityByDays}
              />
            )}
          </div>
          {displayedEditingTarget && (
            <aside
              className={`ganttee-app__panel ${editingTarget ? "is-open" : "is-closing"}`}
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget && !editingTarget) {
                  setClosingEditingTarget(null);
                }
              }}
            >
              <EntityEditor
                editingEntity={displayedEditingTarget}
                document={viewState.project}
                onSave={workflow.saveEntity}
                onDelete={workflow.deleteEntity}
                onClose={closeEntityEditor}
                onAddDependency={workflow.addDependency}
                onRemoveDependency={workflow.removeDependency}
                onUngroupEntity={(entity, options) =>
                  workflow.ungroupEntity(viewState.project, entity, options)
                }
                onRequestEditEntity={requestEditEntity}
              />
            </aside>
          )}
        </div>
      </WebviewL10nContext.Provider>
    </IconBaseUriProvider>
  );
}

interface ResolvedEditingEntity {
  /** Entity kind used to select the form section. */
  kind: EditableEntityKind;
  /** Current entity data resolved from the document. */
  entity: EditableEntityMap[EditableEntityKind];
}

/** Returns whether two entity references identify the same project item. */
function isSameEntity(left: EditableEntityRef | null, right: EditableEntityRef): boolean {
  return left?.kind === right.kind && left.id === right.id;
}

/** Resolves an editable entity reference against the current document. */
function resolveEntity(
  project: ProjectPresentation | undefined,
  ref: EditableEntityRef | null,
): ResolvedEditingEntity | null {
  if (!project || !ref) {
    return null;
  }
  switch (ref.kind) {
    case "task": {
      const entity = project.tasks.find((task) => task.id === ref.id);
      return entity ? { kind: "task", entity: authoredTask(entity) } : null;
    }
    case "milestone": {
      const entity = project.milestones.find((milestone) => milestone.id === ref.id);
      return entity ? { kind: "milestone", entity: authoredMilestone(entity) } : null;
    }
    case "group": {
      const entity = project.groups.find((group) => group.id === ref.id);
      return entity ? { kind: "group", entity: authoredGroup(entity) } : null;
    }
  }
}

/** Removes computed fields before a task enters the authoring workflow. */
function authoredTask(task: ProjectPresentation["tasks"][number]): Task {
  const { effectiveStart, effectiveEnd, effectiveDuration, ...authored } = task;
  return authored;
}

/** Removes computed fields before a milestone enters the authoring workflow. */
function authoredMilestone(milestone: ProjectPresentation["milestones"][number]): Milestone {
  const { effectiveStart, effectiveEnd, effectiveDuration, ...authored } = milestone;
  return authored;
}

/** Removes computed fields before a group enters the authoring workflow. */
function authoredGroup(group: ProjectPresentation["groups"][number]): Group {
  const { effectiveStart, effectiveEnd, effectiveDuration, ...authored } = group;
  return authored;
}
