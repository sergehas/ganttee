import {
  Dependency,
  Group,
  Milestone,
  ProjectSettings,
  ProjectStatus,
  ProjectView,
  Task,
} from "@common/documents";
import { EMPTY_LABEL_SNAPSHOT, labelSnapshotOf } from "@common/models";
import { ProjectPresentation } from "@common/presentation/project";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
  ProjectEditorSurface,
} from "@common/protocol";
import {
  draftLabelSnapshot,
  entityDraftFindings,
  exportFailedFinding,
  SettingsDraftState,
  settingsDraftFindings,
} from "@services/diagnostics/draftFindings";
import { SaveEntityOptions } from "@services/editing/projectItemSaveGuardService";
import "@webview/App.scss";
import { IconBaseUriProvider } from "@webview/components/Icon";
import { StatusNotice } from "@webview/components/StatusNotice";
import { ChartView } from "@webview/features/chart/components/ChartView";
import { EntityEditor } from "@webview/features/entity-editor/components/EntityEditor";
import { useEntityEditWorkflow } from "@webview/features/entity-editor/hooks/useEntityEditWorkflow";
import { SettingsEditor } from "@webview/features/settings/components/SettingsEditor";
import { FeedbackReporter } from "@webview/feedbackReporter";
import { translate, WebviewL10n, WebviewL10nContext } from "@webview/l10n";
import { createGanttViewState, GanttViewState } from "@webview/viewState";
import { onHostMessage, postToHost } from "@webview/vscodeApi";
import { useEffect, useMemo, useRef, useState } from "react";

/** Webview-only behavior retained until the host acknowledges an entity update. */
interface PendingEntityUpdate {
  /** Editor session that originated the update. */
  editorSessionVersion: number;
  /** Whether successful persistence should leave the editor open. */
  keepEditorOpen: boolean;
}

/** Settings proposal payloads that receive a host-generated request id and revision. */
type SettingsEditProposal =
  | { type: "updateSettings"; settings: ProjectSettings }
  | { type: "addProjectStatus"; status: Omit<ProjectStatus, "id"> }
  | { type: "updateProjectStatus"; status: ProjectStatus }
  | { type: "deleteProjectStatus"; statusId: string };

/** Root editor UI: the ECharts timeline and the entity edit panel. */
export function App(): React.JSX.Element {
  const [viewState, setViewState] = useState<GanttViewState | null>(null);
  const [surface, setSurface] = useState<ProjectEditorSurface | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsExplanations, setSettingsExplanations] = useState<readonly string[]>([]);
  const [entityRejection, setEntityRejection] = useState<readonly string[]>([]);
  const [l10n, setL10n] = useState<WebviewL10n | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableEntityRef | null>(null);
  const [closingEditingTarget, setClosingEditingTarget] = useState<ResolvedEditingEntity | null>(
    null,
  );
  const [pendingView, setPendingView] = useState<ProjectView | null>(null);
  const [iconBaseUri, setIconBaseUri] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const projectRef = useRef<ProjectPresentation | null>(null);
  const editingEntityRef = useRef<EditableEntityRef | null>(null);
  const editorSessionVersionRef = useRef(0);
  const nextUpdateRequestIdRef = useRef(0);
  const pendingEntityUpdatesRef = useRef(new Map<number, PendingEntityUpdate>());
  const nextSettingsRequestIdRef = useRef(0);
  const pendingSettingsRequestIdRef = useRef<number | null>(null);
  const reporterRef = useRef<FeedbackReporter | null>(null);
  reporterRef.current ??= new FeedbackReporter(postToHost);
  const currentRevisionRef = useRef(0);
  const sourceInvalidRef = useRef(false);
  const entityDraftRef = useRef<ResolvedEditingEntity | null>(null);
  const settingsDraftRef = useRef<SettingsDraftState>({
    invalidHolidayRange: false,
    blankStatusName: false,
  });

  /** Mirrors the open entity draft's local findings against the current revision. */
  function reportEntityDraft(): void {
    const draft = entityDraftRef.current;
    const project = projectRef.current;
    if (!draft || !project) {
      reporterRef.current?.reportDraft(
        "entityDraft",
        currentRevisionRef.current,
        [],
        EMPTY_LABEL_SNAPSHOT,
      );
      return;
    }
    reporterRef.current?.reportDraft(
      "entityDraft",
      currentRevisionRef.current,
      entityDraftFindings(draft.kind, draft.entity, project.dependencies),
      draftLabelSnapshot(project, draft.kind, draft.entity),
    );
  }

  /** Mirrors the settings form's blocking local findings against the current revision. */
  function reportSettingsDraft(): void {
    const project = projectRef.current;
    reporterRef.current?.reportDraft(
      "settingsDraft",
      currentRevisionRef.current,
      settingsDraftFindings(settingsDraftRef.current, project?.settings.holidays.length ?? 0),
      project ? labelSnapshotOf(project) : EMPTY_LABEL_SNAPSHOT,
    );
  }

  /** Records the latest entity draft shown by the open editor and mirrors its feedback. */
  function updateEntityDraft(
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
  ) {
    if (!editingEntityRef.current) {
      return;
    }
    entityDraftRef.current = { kind, entity };
    reportEntityDraft();
  }

  /** Records the settings form's blocking local conditions and mirrors them. */
  function updateSettingsDraft(state: SettingsDraftState): void {
    settingsDraftRef.current = state;
    reportSettingsDraft();
  }

  /** Shows an export outcome inline and mirrors a failure as an operation finding. */
  function reportExportError(message: string | null): void {
    setExportError(message);
    reporterRef.current?.reportOperation(
      "export",
      currentRevisionRef.current,
      message === null ? [] : [exportFailedFinding()],
      EMPTY_LABEL_SNAPSHOT,
    );
  }

  useEffect(() => {
    const unsubscribe = onHostMessage((message) => {
      switch (message.type) {
        case "l10nCatalog":
          setL10n({ locale: message.locale, strings: message.strings });
          break;
        case "init":
          setIconBaseUri(message.iconBaseUri);
          setSurface(message.surface);
          setDocumentError(null);
          setSettingsError(null);
          setSettingsExplanations([]);
          currentRevisionRef.current = message.revision;
          sourceInvalidRef.current = false;
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
          setDocumentError(null);
          currentRevisionRef.current = message.revision;
          sourceInvalidRef.current = false;
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
          reportSettingsDraft();
          break;
        case "documentError":
          // Keep the last valid model so an open form stays open; saves stay blocked until a
          // valid revision rebases it.
          currentRevisionRef.current = message.revision;
          sourceInvalidRef.current = true;
          setDocumentError(message.message);
          pendingSettingsRequestIdRef.current = null;
          setSettingsBusy(false);
          reportEntityDraft();
          reportSettingsDraft();
          break;
        case "settingsEditResult":
          if (message.requestId === pendingSettingsRequestIdRef.current) {
            pendingSettingsRequestIdRef.current = null;
            setSettingsBusy(false);
            setSettingsError(message.accepted ? null : (message.message ?? ""));
            setSettingsExplanations(message.accepted ? [] : (message.explanations ?? []));
          }
          break;
        case "editEntity":
          toggleEntityEditor(message.entity);
          break;
        case "updateEntityResult": {
          const pendingUpdate = pendingEntityUpdatesRef.current.get(message.requestId);
          pendingEntityUpdatesRef.current.delete(message.requestId);
          const isCurrentSession =
            pendingUpdate !== undefined &&
            pendingUpdate.editorSessionVersion === editorSessionVersionRef.current &&
            isSameEntity(editingEntityRef.current, message.entity);
          if (isCurrentSession) {
            setEntityRejection(message.updated ? [] : (message.explanations ?? []));
          }
          if (message.updated && isCurrentSession && !pendingUpdate.keepEditorOpen) {
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
    if (!viewState || sourceInvalidRef.current) {
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
    if (!viewState || sourceInvalidRef.current) {
      return;
    }
    postToHost({ type: "deleteEntity", entity, baseRevision: viewState.revision });
  };

  /** Sends one settings proposal and prevents another until its authoritative result arrives. */
  function updateSettingsToHost(proposal: SettingsEditProposal): void {
    if (!viewState || sourceInvalidRef.current || pendingSettingsRequestIdRef.current !== null) {
      return;
    }
    const requestId = nextSettingsRequestIdRef.current;
    nextSettingsRequestIdRef.current += 1;
    pendingSettingsRequestIdRef.current = requestId;
    setSettingsBusy(true);
    setSettingsError(null);
    setSettingsExplanations([]);
    postToHost({ ...proposal, requestId, baseRevision: viewState.revision });
  }

  /** Asks the host to route an entity edit command back through the shared toggle path. */
  const requestEditEntity = (entity: EditableEntityRef) => {
    postToHost({ type: "requestEditEntity", entity });
  };

  /** Toggles the requested entity editor against the current editor identity. */
  function toggleEntityEditor(entity: EditableEntityRef): void {
    const currentEntity = editingEntityRef.current;
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
    setEntityRejection([]);
    if (!entity) {
      entityDraftRef.current = null;
      reportEntityDraft();
    }
  }

  /** Sends a new dependency to the extension host. */
  const addDependency = (dependency: Dependency) => {
    if (!viewState || sourceInvalidRef.current) {
      return;
    }
    postToHost({ type: "addDependency", dependency, baseRevision: viewState.revision });
  };

  /** Sends a dependency deletion to the extension host. */
  const removeDependency = (dependencyId: string) => {
    if (!viewState || sourceInvalidRef.current) {
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

  const editingTarget = useMemo(
    () => resolveEntity(viewState?.project, editingEntity),
    [viewState, editingEntity],
  );

  if (!l10n) {
    return <div className="ganttee-app__empty" aria-busy="true" />;
  }

  if (documentError && !viewState) {
    return (
      <div className="ganttee-app__empty" role="alert">
        {documentError}
      </div>
    );
  }

  if (!viewState) {
    return (
      <div className="ganttee-app__empty" aria-busy="true">
        {translate(l10n, "Loading Gantt chart...")}
      </div>
    );
  }

  const displayedEditingTarget = editingTarget ?? closingEditingTarget;
  const chartView = pendingView ?? viewState.project.view;
  const sourceInvalid = documentError !== null;

  if (surface === "settings") {
    return (
      <WebviewL10nContext.Provider value={l10n}>
        {sourceInvalid && <StatusNotice severity="error">{documentError}</StatusNotice>}
        <SettingsEditor
          project={viewState.project}
          busy={settingsBusy || sourceInvalid}
          error={settingsError}
          explanations={settingsExplanations}
          onDraftFeedback={updateSettingsDraft}
          onUpdateSettings={(settings) =>
            updateSettingsToHost({ type: "updateSettings", settings })
          }
          onAddStatus={(status) => updateSettingsToHost({ type: "addProjectStatus", status })}
          onUpdateStatus={(status) => updateSettingsToHost({ type: "updateProjectStatus", status })}
          onDeleteStatus={(statusId) =>
            updateSettingsToHost({ type: "deleteProjectStatus", statusId })
          }
        />
      </WebviewL10nContext.Provider>
    );
  }

  /** Sends a complete chart view proposal through the revision-safe host path. */
  const updateView = (view: ProjectView) => {
    setPendingView(view);
    postToHost({
      type: "updateView",
      view,
      baseRevision: viewState.revision,
    });
  };

  return (
    <IconBaseUriProvider baseUri={iconBaseUri ?? ""}>
      <WebviewL10nContext.Provider value={l10n}>
        <div className="ganttee-app">
          <div className="ganttee-app__timeline">
            {sourceInvalid ? (
              <div className="ganttee-app__empty" role="alert">
                {documentError}
              </div>
            ) : (
              <ChartView
                project={viewState.project}
                view={chartView}
                isEmpty={
                  viewState.project.tasks.length === 0 && viewState.project.milestones.length === 0
                }
                emptyState={
                  <div className="ganttee-app__empty">
                    {translate(l10n, "No tasks yet. Use the Ganttee sidebar to add one.")}
                  </div>
                }
                toolbarFeedback={
                  exportError ? <StatusNotice severity="error">{exportError}</StatusNotice> : null
                }
                onViewChange={updateView}
                onEditEntity={toggleEntityEditor}
                onExportError={reportExportError}
                onOpenSettings={() => postToHost({ type: "openSettings" })}
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
                onDraftChange={updateEntityDraft}
                rejection={entityRejection}
                saveBlocked={sourceInvalid}
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
