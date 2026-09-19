import {
  createEmptyDocument,
  Dependency,
  Group,
  Milestone,
  ProjectDocument,
  ProjectItemType,
  ProjectView,
  Task,
} from "@common/documents";
import {
  CyclicDependencyError,
  ParallelEdgeDependencyError,
  ProjectSnapshot,
  SelfLoopDependencyError,
} from "@common/models";
import { ProjectPresentation } from "@common/presentation/project";
import {
  EditableEntityKind,
  EditableEntityRef,
  GroupDeleteStrategy,
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "@common/protocol";
import { wouldCreateCycle } from "@services/dependency-graph/dependencyGraphService";
import {
  GanttParseError,
  parseDocument,
  serializeDocument,
} from "@services/document/documentService";
import { findEntity, replaceEntity, upsertEntity } from "@services/document/projectItemService";
import { buildTaskOrMilestoneDeletionDocument } from "@services/editing/projectItemRemovalService";
import {
  buildGroupDeletionDocument,
  hasGroupContents,
} from "@services/groups/groupDeletionService";
import { hydrateDocument } from "@services/model/projectModelService";
import { toProjectPresentation } from "@services/model/projectPresentationService";
import { createProjectSnapshot } from "@services/model/projectSnapshotService";
import {
  sanitizeScheduleGraph,
  ScheduleGraphSanitization,
} from "@services/schedule/scheduleGraphSanitizationService";
import {
  blockingDiagnostics,
  evaluateScheduleConstraints,
  evaluateScheduleDiagnostics,
} from "@services/schedule/scheduleGraphValidationService";
import {
  assignEntitiesToGroup,
  EffectiveDateMap,
  MoveDirection,
  moveEntity as moveSidebarEntity,
  SortDirection,
  sortProjectItems,
} from "@services/sidebar/treeItemOperations";
import { createWebviewL10nCatalog } from "@views/editor/webviewL10n";
import { summarizeBlockingDiagnostics } from "@views/scheduleDiagnosticPresenter";
import * as vscode from "vscode";

/**
 * Bridges a single `.ganttee` {@link vscode.TextDocument} with its webview and
 * the parsed model. The document text is the single source of truth: edits are
 * applied via {@link vscode.WorkspaceEdit} and re-parsed on change.
 */
export class GanttEditorController {
  private _document: ProjectDocument = createEmptyDocument();
  private _snapshot = createProjectSnapshot(hydrateDocument(this._document), []).snapshot;
  private _isDisposed = false;
  private _hasInitializedWebview = false;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeModel = new vscode.EventEmitter<void>();

  /** Fires whenever the parsed model changes. */
  readonly onDidChangeModel = this._onDidChangeModel.event;

  constructor(
    private readonly document: vscode.TextDocument,
    private readonly webviewPanel: vscode.WebviewPanel,
    private readonly iconBaseUri: string,
  ) {
    this.reparse();

    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === this.document.uri.toString()) {
          this.reparse();
          this.post({
            type: "documentChanged",
            project: this.projectPresentation(),
            revision: this.document.version,
          });
        }
      }),
    );

    this._disposables.push(
      webviewPanel.webview.onDidReceiveMessage((message: WebviewToHostMessage) =>
        this.handleMessage(message),
      ),
    );
  }

  get uri(): vscode.Uri {
    return this.document.uri;
  }

  /** Returns the current immutable hydrated, scheduled, and diagnostic state. */
  get snapshot(): ProjectSnapshot {
    return this._snapshot;
  }

  /** Reveals the editor panel and posts the initial document to the webview. */
  sendInit(): void {
    this.post({
      type: "init",
      project: this.projectPresentation(),
      revision: this.document.version,
      iconBaseUri: this.iconBaseUri,
    });
  }

  /** Reveals the owning webview panel. */
  focus(): void {
    this.webviewPanel.reveal(this.webviewPanel.viewColumn);
  }

  /** Reveals and selects an entity in the webview. */
  revealEntity(entity: EditableEntityRef): void {
    this.focus();
    this.post({ type: "selectEntity", entity });
  }

  /** Reveals and opens edit mode for an entity in the webview. */
  editEntity(entity: EditableEntityRef): void {
    this.focus();
    this.post({ type: "editEntity", entity });
  }

  /** Adds or replaces a task. Used by host-side creation flows. */
  async upsertTask(task: Task): Promise<void> {
    await this.applyDocument(upsertEntity(this._document, "task", task));
  }

  /** Adds or replaces a milestone through the document edit boundary. */
  async upsertMilestone(milestone: Milestone): Promise<void> {
    await this.applyDocument(upsertEntity(this._document, "milestone", milestone));
  }

  /** Adds or replaces a group through the document edit boundary. */
  async upsertGroup(group: Group): Promise<void> {
    await this.applyDocument(upsertEntity(this._document, "group", group));
  }

  /** Assigns selected entities to a group or project root. */
  async assignEntitiesToGroup(
    entities: readonly EditableEntityRef[],
    targetGroupId: string | undefined,
  ): Promise<void> {
    await this.applyDocument(assignEntitiesToGroup(this._document, entities, targetGroupId));
  }

  /** Moves one entity within its current owner scope. */
  async moveEntity(entity: EditableEntityRef, direction: MoveDirection): Promise<void> {
    await this.applyDocument(moveSidebarEntity(this._document, entity, direction));
  }

  /** Sorts authored sidebar order using current effective schedule dates. */
  async sortItems(direction: SortDirection): Promise<boolean> {
    if (this._snapshot.schedule === undefined) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t("Sort is unavailable without a schedule."),
      );
      return false;
    }
    await this.applyDocument(sortProjectItems(this._document, direction, this.effectiveDateMap()));
    return true;
  }

  /**
   * Deletes any entity kind (task, milestone, or group).
   * Handles type-specific deletion logic via mutation strategies and group strategies.
   */
  async deleteEntity(entity: EditableEntityRef, strategy?: GroupDeleteStrategy): Promise<void> {
    if (entity.kind === "group") {
      await this.deleteGroup(entity.id, strategy);
    } else {
      await this.deleteTaskOrMilestone(entity.kind, entity.id);
    }
  }

  /**
   * Adds a dependency after cycle validation.
   */
  async addDependency(dependency: Dependency): Promise<boolean> {
    if (this._isDisposed) {
      return false;
    }
    if (wouldCreateCycle(this._document, dependency)) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t("Cannot add dependency: it would create a cycle."),
      );
      return false;
    }
    const dependencies = replaceById(this._document.dependencies, dependency);
    await this.applyDocument({ ...this._document, dependencies });
    return true;
  }

  /**
   * Removes a dependency by id.
   */
  async removeDependency(dependencyId: string): Promise<void> {
    const dependencies = this._document.dependencies.filter((dep) => dep.id !== dependencyId);
    await this.applyDocument({ ...this._document, dependencies });
  }

  /** Disposes event subscriptions owned by this controller. */
  dispose(): void {
    this._isDisposed = true;
    this._onDidChangeModel.dispose();
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }

  /**
   * Handles inbound webview messages and routes them to host operations.
   */
  private async handleMessage(message: WebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.sendL10nCatalogAndInit();
        break;
      case "updateEntity":
        await this.updateEntity(message.kind, message.entity, message.baseRevision);
        break;
      case "updateView":
        await this.updateView(message.view, message.baseRevision);
        break;
      case "addDependency":
        await this.addDependency(message.dependency);
        break;
      case "removeDependency":
        await this.removeDependency(message.dependencyId);
        break;
      case "deleteEntity":
        await this.deleteEntity(message.entity, message.strategy);
        break;
      case "requestEditEntity":
        this.editEntity(message.entity);
        break;
    }
  }

  /**
   * Updates one existing entity. Shows a warning and no-ops when the id is
   * not found.
   */
  private async updateEntity(
    kind: EditableEntityKind,
    entity: Task | Milestone | Group,
    baseRevision: number,
  ): Promise<void> {
    if (baseRevision !== this.document.version) {
      this.postCurrentProject();
      return;
    }
    const next = replaceEntity(this._document, kind, entity);
    if (!next) {
      this.showUnknownIdWarning(kind, entity.id);
      return;
    }
    await this.applyDocument(next);
  }

  /** Applies a persisted view proposal through the same revision-safe edit path. */
  private async updateView(view: ProjectView, baseRevision: number): Promise<void> {
    if (baseRevision !== this.document.version) {
      this.postCurrentProject();
      return;
    }
    await this.applyDocument({ ...this._document, view });
  }

  /**
   * Deletes one task or milestone and every edge connected to it. Groups go
   * through {@link deleteGroup} instead, because they need a strategy.
   */
  private async deleteTaskOrMilestone(
    kind: Exclude<ProjectItemType, "group">,
    entityId: string,
  ): Promise<void> {
    const nextDocument = buildTaskOrMilestoneDeletionDocument(this._document, kind, entityId);
    if (!nextDocument) {
      this.showUnknownIdWarning(kind, entityId);
      return;
    }
    await this.applyDocument(nextDocument);
  }

  /**
   * Deletes a group using either cascade or reparent strategy.
   * Prompts the user to choose a strategy if the group has contents and no strategy is provided.
   */
  private async deleteGroup(groupId: string, strategy?: GroupDeleteStrategy): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    if (!findEntity(this._document, "group", groupId)) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t("Cannot delete group '{0}': no matching id.", groupId),
      );
      return;
    }

    const resolvedStrategy =
      strategy ??
      (hasGroupContents(this._document, groupId) ? await this.askGroupDeleteStrategy() : "cascade");
    if (!resolvedStrategy) {
      return;
    }

    const next = buildGroupDeletionDocument(this._document, groupId, resolvedStrategy);
    if (next) {
      await this.applyDocument(next);
    }
  }

  /**
   * Shows the Option-C group delete confirmation and returns the chosen strategy.
   */
  private async askGroupDeleteStrategy(): Promise<GroupDeleteStrategy | undefined> {
    const cascadeLabel = vscode.l10n.t("Delete Group And Contents");
    const reparentLabel = vscode.l10n.t("Ungroup/Reparent Contents");
    const choice = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete this group?"),
      { modal: true },
      cascadeLabel,
      reparentLabel,
    );
    if (choice === cascadeLabel) {
      return "cascade";
    }
    if (choice === reparentLabel) {
      return "reparent";
    }
    return undefined;
  }

  /** Builds the schedule-derived effective-date map consumed by sidebar sorting. */
  private effectiveDateMap(): EffectiveDateMap {
    const dates = new Map<string, { start: Date; end: Date }>();
    for (const snapshot of [
      ...this._snapshot.tasks,
      ...this._snapshot.milestones,
      ...this._snapshot.groups,
    ]) {
      if (snapshot.effective !== undefined) {
        dates.set(snapshot.item.id, {
          start: snapshot.effective.start,
          end: snapshot.effective.end,
        });
      }
    }
    return dates;
  }

  /**
   * Re-parses the underlying text document and updates cached models.
   */
  private reparse(): void {
    if (this._isDisposed) {
      return;
    }
    try {
      const parsedDocument = parseDocument(this.document.getText());
      const sanitization = sanitizeScheduleGraph(parsedDocument);
      if (
        sanitization.removedDependencyIds.length > 0 ||
        sanitization.removedEntityIds.length > 0
      ) {
        this.warnAndApplySanitization(sanitization);
        return;
      }
      const document = sanitization.document;
      const hydratedModel = hydrateDocument(document);
      const diagnostics = evaluateScheduleConstraints(document);
      const { snapshot, schedulingError } = createProjectSnapshot(hydratedModel, diagnostics);
      this._document = document;
      this._snapshot = snapshot;
      this._onDidChangeModel.fire();
      if (schedulingError !== undefined) {
        void vscode.window.showErrorMessage(vscode.l10n.t("Ganttee: {0}", schedulingError.message));
      }
    } catch (error) {
      if (error instanceof GanttParseError) {
        void vscode.window.showErrorMessage(vscode.l10n.t("Ganttee: {0}", error.message));
        return;
      }
      if (
        error instanceof SelfLoopDependencyError ||
        error instanceof ParallelEdgeDependencyError ||
        error instanceof CyclicDependencyError
      ) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t("Ganttee: invalid dependency graph. {0}", error.message),
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Warns about invalid scheduling structures and rewrites the source document
   * with their sanitized replacement.
   */
  private warnAndApplySanitization(sanitization: ScheduleGraphSanitization): void {
    const removedDependencies = sanitization.removedDependencyIds.join(", ");
    const removedEntities = sanitization.removedEntityIds.join(", ");
    const details = [
      removedDependencies.length > 0
        ? vscode.l10n.t("removed dependencies: {0}", removedDependencies)
        : undefined,
      removedEntities.length > 0
        ? vscode.l10n.t("removed entities: {0}", removedEntities)
        : undefined,
    ].filter((message): message is string => message !== undefined);
    void vscode.window.showWarningMessage(
      vscode.l10n.t("Ganttee: invalid scheduling structures removed. {0}", details.join("; ")),
    );
    void this.applyDocumentText(sanitization.document);
  }

  /** Applies a document replacement without running semantic save validation. */
  private async applyDocumentText(next: ProjectDocument): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      this.document.positionAt(0),
      this.document.positionAt(this.document.getText().length),
    );
    edit.replace(this.document.uri, fullRange, serializeDocument(next));
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t("Cannot apply automatic scheduling cleanup."),
      );
    }
  }

  /**
   * Validates and applies a full-document replacement through WorkspaceEdit.
   */
  private async applyDocument(next: ProjectDocument): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      const parsed = parseDocument(serializeDocument(next));
      const blocking = blockingDiagnostics(evaluateScheduleDiagnostics(parsed));
      if (blocking.length > 0) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t("Cannot apply update: {0}", summarizeBlockingDiagnostics(blocking)),
        );
        return;
      }
    } catch (error) {
      if (error instanceof GanttParseError) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t("Cannot apply update: {0}", error.message),
        );
        return;
      }
      throw error;
    }

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      this.document.positionAt(0),
      this.document.positionAt(this.document.getText().length),
    );
    edit.replace(this.document.uri, fullRange, serializeDocument(next));
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Posts a typed message to the webview.
   */
  private post(message: HostToWebviewMessage): void {
    if (this._isDisposed) {
      return;
    }
    void this.webviewPanel.webview.postMessage(message);
  }

  /** Sends the localized catalog and initial document once for this webview session. */
  private sendL10nCatalogAndInit(): void {
    if (this._hasInitializedWebview) {
      return;
    }
    this._hasInitializedWebview = true;
    this.post({
      type: "l10nCatalog",
      locale: vscode.env.language,
      strings: createWebviewL10nCatalog((source) => vscode.l10n.t(source)),
    });
    this.sendInit();
  }

  /** Creates the versionless UI projection for the current snapshot. */
  private projectPresentation(): ProjectPresentation {
    return toProjectPresentation(this._snapshot);
  }

  /** Sends the current project after rejecting a stale webview mutation. */
  private postCurrentProject(): void {
    this.post({
      type: "documentChanged",
      project: this.projectPresentation(),
      revision: this.document.version,
    });
  }

  /**
   * Shows a localized warning for update/delete requests targeting unknown ids.
   */
  private showUnknownIdWarning(kind: EditableEntityKind, id: string): void {
    if (this._isDisposed) {
      return;
    }
    void vscode.window.showWarningMessage(vscode.l10n.t("No {0} found for id '{1}'.", kind, id));
  }
}

/** Replaces a dependency by id, appending it when the id is new. */
function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }
  const copy = items.slice();
  copy[index] = next;
  return copy;
}
