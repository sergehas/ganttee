import * as vscode from "vscode";
import {
    createEmptyDocument,
    CyclicDependencyError,
    Dependency,
    GanttDocument,
    GanttModel,
    Group,
    Milestone,
    ParallelEdgeDependencyError,
    SelfLoopDependencyError,
    Task,
} from "../../common/models";
import {
    EditableEntityKind,
    EditableEntityRef,
    GroupDeleteStrategy,
    HostToWebviewMessage,
    WebviewToHostMessage,
} from "../../common/protocol";
import { wouldCreateCycle } from "../../services/dependencyGraphService";
import {
    sanitizeScheduleGraph,
    ScheduleGraphSanitization,
} from "../../services/documentSanitizationService";
import {
    findEntity,
    replaceEntity,
    upsertEntity,
} from "../../services/documentEntityService";
import { buildTaskOrMilestoneDeletionDocument } from "../../services/entityRemovalService";
import {
    buildGroupDeletionDocument,
    hasGroupContents,
} from "../../services/groupDeletionService";
import {
    blockingDiagnostics,
    evaluateScheduleGraph,
    ScheduleDiagnostic,
} from "../../services/scheduleGraphValidationService";
import { summarizeBlockingDiagnostics } from "../scheduleDiagnosticPresenter";
import {
    GanttParseError,
    parseDocument,
    serializeDocument,
} from "../../services/ganttDocumentService";
import { hydrateDocument } from "../../services/ganttModelService";

/**
 * Bridges a single `.ganttee` {@link vscode.TextDocument} with its webview and
 * the parsed model. The document text is the single source of truth: edits are
 * applied via {@link vscode.WorkspaceEdit} and re-parsed on change.
 */
export class GanttEditorController {
  private _document: GanttDocument = createEmptyDocument();
  private _model: GanttModel = hydrateDocument(this._document);
  private _diagnostics: readonly ScheduleDiagnostic[] = [];
  private _isDisposed = false;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeModel = new vscode.EventEmitter<void>();

  /** Fires whenever the parsed model changes. */
  readonly onDidChangeModel = this._onDidChangeModel.event;

  constructor(
    private readonly document: vscode.TextDocument,
    private readonly webviewPanel: vscode.WebviewPanel,
  ) {
    this.reparse();

    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === this.document.uri.toString()) {
          this.reparse();
          this.post({ type: "documentChanged", document: this._document });
        }
      }),
    );

    this._disposables.push(
      webviewPanel.webview.onDidReceiveMessage(
        (message: WebviewToHostMessage) => this.handleMessage(message),
      ),
    );
  }

  get uri(): vscode.Uri {
    return this.document.uri;
  }

  /** Returns the current plain document for host consumers and webview messages. */
  getGanttDocument(): GanttDocument {
    return this._document;
  }

  /**
   * The hydrated, `Date`-typed in-memory model derived from {@link model} on
   * every reparse. Host-only; never sent over the webview protocol.
   */
  get hydratedModel(): GanttModel {
    return this._model;
  }

  /**
   * The semantic validation result for the current model.
   * Updated on every successful reparse.
   */
  get validation(): readonly ScheduleDiagnostic[] {
    return this._diagnostics;
  }

  /** Reveals the editor panel and posts the initial model to the webview. */
  sendInit(): void {
    this.post({ type: "init", document: this._document });
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
    await this.applyModel(upsertEntity(this._document, "task", task));
  }

  /**
   * Deletes any entity kind (task, milestone, or group).
   * Handles type-specific deletion logic via mutation strategies and group strategies.
   */
  async deleteEntity(
    entity: EditableEntityRef,
    strategy?: GroupDeleteStrategy,
  ): Promise<void> {
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
    await this.applyModel({ ...this._document, dependencies });
    return true;
  }

  /**
   * Removes a dependency by id.
   */
  async removeDependency(dependencyId: string): Promise<void> {
    const dependencies = this._document.dependencies.filter(
      (dep) => dep.id !== dependencyId,
    );
    await this.applyModel({ ...this._document, dependencies });
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
        this.sendInit();
        break;
      case "updateEntity":
        await this.updateEntity(message.kind, message.entity);
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
  ): Promise<void> {
    const next = replaceEntity(this._document, kind, entity);
    if (!next) {
      this.showUnknownIdWarning(kind, entity.id);
      return;
    }
    await this.applyModel(next);
  }

  /**
   * Deletes one task or milestone and every edge connected to it. Groups go
   * through {@link deleteGroup} instead, because they need a strategy.
   */
  private async deleteTaskOrMilestone(
    kind: "task" | "milestone",
    entityId: string,
  ): Promise<void> {
    const nextModel = buildTaskOrMilestoneDeletionDocument(
      this._document,
      kind,
      entityId,
    );
    if (!nextModel) {
      this.showUnknownIdWarning(kind, entityId);
      return;
    }
    await this.applyModel(nextModel);
  }

  /**
   * Deletes a group using either cascade or reparent strategy.
   * Prompts the user to choose a strategy if the group has contents and no strategy is provided.
   */
  private async deleteGroup(
    groupId: string,
    strategy?: GroupDeleteStrategy,
  ): Promise<void> {
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
      (hasGroupContents(this._document, groupId)
        ? await this.askGroupDeleteStrategy()
        : "cascade");
    if (!resolvedStrategy) {
      return;
    }

    const next = buildGroupDeletionDocument(
      this._document,
      groupId,
      resolvedStrategy,
    );
    if (next) {
      await this.applyModel(next);
    }
  }

  /**
   * Shows the Option-C group delete confirmation and returns the chosen strategy.
   */
  private async askGroupDeleteStrategy(): Promise<
    GroupDeleteStrategy | undefined
  > {
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
      this._document = document;
      this._model = hydratedModel;
      this._diagnostics = evaluateScheduleGraph(document);
      this._onDidChangeModel.fire();
    } catch (error) {
      if (error instanceof GanttParseError) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t("Ganttee: {0}", error.message),
        );
        return;
      }
      if (
        error instanceof SelfLoopDependencyError ||
        error instanceof ParallelEdgeDependencyError ||
        error instanceof CyclicDependencyError
      ) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t(
            "Ganttee: invalid dependency graph. {0}",
            error.message,
          ),
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
  private warnAndApplySanitization(
    sanitization: ScheduleGraphSanitization,
  ): void {
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
      vscode.l10n.t("Ganttee: invalid scheduling structures removed. {0}",
        details.join("; ")),
    );
    void this.applyDocumentText(sanitization.document);
  }

  /** Applies a document replacement without running semantic save validation. */
  private async applyDocumentText(next: GanttDocument): Promise<void> {
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
  private async applyModel(next: GanttDocument): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      const parsed = parseDocument(serializeDocument(next));
      const blocking = blockingDiagnostics(evaluateScheduleGraph(parsed));
      if (blocking.length > 0) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t(
            "Cannot apply update: {0}",
            summarizeBlockingDiagnostics(blocking),
          ),
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

  /**
   * Shows a localized warning for update/delete requests targeting unknown ids.
   */
  private showUnknownIdWarning(kind: EditableEntityKind, id: string): void {
    if (this._isDisposed) {
      return;
    }
    void vscode.window.showWarningMessage(
      vscode.l10n.t("No {0} found for id '{1}'.", kind, id),
    );
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
