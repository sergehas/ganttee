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
import {
  GraphValidationResult,
  validateSemanticGraph,
  wouldCreateCycle,
} from "../../services/dependencyGraphService";
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
  private _model: GanttDocument = createEmptyDocument();
  private _graph: GanttModel = hydrateDocument(this._model);
  private _validation: GraphValidationResult = {
    ok: true,
    cycle: [],
    danglingDependencyIds: [],
    underConstrainedIds: [],
    overConstrainedIds: [],
    milestoneReverseOwnerIds: [],
    groupDependencyIds: [],
    unanchoredComponentIds: [],
  };
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
          this.post({ type: "documentChanged", document: this._model });
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

  get model(): GanttDocument {
    return this._model;
  }

  /**
   * The hydrated, `Date`-typed in-memory model derived from {@link model} on
   * every reparse. Host-only; never sent over the webview protocol.
   */
  get graph(): GanttModel {
    return this._graph;
  }

  /**
   * The semantic validation result for the current model.
   * Updated on every successful reparse.
   */
  get validation(): GraphValidationResult {
    return this._validation;
  }

  /** Reveals the editor panel and posts the initial model to the webview. */
  sendInit(): void {
    this.post({ type: "init", document: this._model });
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
    const tasks = replaceById(this._model.tasks, task);
    await this.applyModel({ ...this._model, tasks });
  }

  /**
   * Deletes any entity kind.
   */
  async deleteEntity(
    entity: EditableEntityRef,
    strategy?: GroupDeleteStrategy,
  ): Promise<void> {
    switch (entity.kind) {
      case "task":
        await this.deleteTask(entity.id);
        break;
      case "milestone":
        await this.deleteMilestone(entity.id);
        break;
      case "group":
        await this.deleteGroup(entity.id, strategy);
        break;
    }
  }

  /**
   * Adds a dependency after cycle validation.
   */
  async addDependency(dependency: Dependency): Promise<boolean> {
    if (this._isDisposed) {
      return false;
    }
    if (wouldCreateCycle(this._model.dependencies, dependency)) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t("Cannot add dependency: it would create a cycle."),
      );
      return false;
    }
    const dependencies = replaceById(this._model.dependencies, dependency);
    await this.applyModel({ ...this._model, dependencies });
    return true;
  }

  /**
   * Removes a dependency by id.
   */
  async removeDependency(dependencyId: string): Promise<void> {
    const dependencies = this._model.dependencies.filter(
      (dep) => dep.id !== dependencyId,
    );
    await this.applyModel({ ...this._model, dependencies });
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
   * Updates one existing entity and no-ops with a warning when the id is missing.
   */
  private async updateEntity(
    kind: EditableEntityKind,
    entity: Task | Milestone | Group,
  ): Promise<void> {
    switch (kind) {
      case "task":
        await this.updateExistingTask(entity as Task);
        break;
      case "milestone":
        await this.updateExistingMilestone(entity as Milestone);
        break;
      case "group":
        await this.updateExistingGroup(entity as Group);
        break;
    }
  }

  /**
   * Replaces an existing task by id.
   */
  private async updateExistingTask(task: Task): Promise<void> {
    const tasks = replaceExistingById(this._model.tasks, task);
    if (!tasks) {
      this.showUnknownIdWarning("task", task.id);
      return;
    }
    await this.applyModel({ ...this._model, tasks });
  }

  /**
   * Replaces an existing milestone by id.
   */
  private async updateExistingMilestone(milestone: Milestone): Promise<void> {
    const milestones = replaceExistingById(this._model.milestones, milestone);
    if (!milestones) {
      this.showUnknownIdWarning("milestone", milestone.id);
      return;
    }
    await this.applyModel({ ...this._model, milestones });
  }

  /**
   * Replaces an existing group by id.
   */
  private async updateExistingGroup(group: Group): Promise<void> {
    const groups = replaceExistingById(this._model.groups, group);
    if (!groups) {
      this.showUnknownIdWarning("group", group.id);
      return;
    }
    await this.applyModel({ ...this._model, groups });
  }

  /**
   * Deletes one task and all edges connected to it.
   */
  private async deleteTask(taskId: string): Promise<void> {
    if (!this._model.tasks.some((task) => task.id === taskId)) {
      this.showUnknownIdWarning("task", taskId);
      return;
    }
    const tasks = this._model.tasks.filter((task) => task.id !== taskId);
    const dependencies = this._model.dependencies.filter(
      (dep) => dep.sourceId !== taskId && dep.targetId !== taskId,
    );
    await this.applyModel({ ...this._model, tasks, dependencies });
  }

  /**
   * Deletes one milestone and all edges connected to it.
   */
  private async deleteMilestone(milestoneId: string): Promise<void> {
    if (
      !this._model.milestones.some((milestone) => milestone.id === milestoneId)
    ) {
      this.showUnknownIdWarning("milestone", milestoneId);
      return;
    }
    const milestones = this._model.milestones.filter(
      (milestone) => milestone.id !== milestoneId,
    );
    const dependencies = this._model.dependencies.filter(
      (dep) => dep.sourceId !== milestoneId && dep.targetId !== milestoneId,
    );
    await this.applyModel({ ...this._model, milestones, dependencies });
  }

  /**
   * Deletes a group using either cascade or reparent strategy.
   */
  private async deleteGroup(
    groupId: string,
    strategy?: GroupDeleteStrategy,
  ): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    const group = this._model.groups.find((current) => current.id === groupId);
    if (!group) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t("Cannot delete group '{0}': no matching id.", groupId),
      );
      return;
    }

    const hasContents = this.hasGroupContents(groupId);
    const resolvedStrategy =
      hasContents && !strategy
        ? await this.askGroupDeleteStrategy()
        : (strategy ?? "cascade");
    if (!resolvedStrategy) {
      return;
    }

    if (resolvedStrategy === "cascade") {
      await this.deleteGroupCascade(groupId);
      return;
    }

    await this.deleteGroupReparent(groupId, group.groupId);
  }

  /**
   * Returns true when a group contains members or child groups.
   */
  private hasGroupContents(groupId: string): boolean {
    return (
      this._model.tasks.some((task) => task.groupId === groupId) ||
      this._model.milestones.some(
        (milestone) => milestone.groupId === groupId,
      ) ||
      this._model.groups.some((group) => group.groupId === groupId)
    );
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
   * Cascades a group deletion to its full subtree.
   */
  private async deleteGroupCascade(groupId: string): Promise<void> {
    const groupIds = collectGroupSubtreeIds(this._model.groups, groupId);
    const groupIdSet = new Set(groupIds);
    const deletedEntityIds = new Set<string>();

    const groups = this._model.groups.filter(
      (group) => !groupIdSet.has(group.id),
    );
    const tasks = this._model.tasks.filter((task) => {
      const inSubtree =
        task.groupId !== undefined && groupIdSet.has(task.groupId);
      if (inSubtree) {
        deletedEntityIds.add(task.id);
      }
      return !inSubtree;
    });
    const milestones = this._model.milestones.filter((milestone) => {
      const inSubtree =
        milestone.groupId !== undefined && groupIdSet.has(milestone.groupId);
      if (inSubtree) {
        deletedEntityIds.add(milestone.id);
      }
      return !inSubtree;
    });

    const dependencies = this._model.dependencies.filter(
      (dep) =>
        !deletedEntityIds.has(dep.sourceId) &&
        !deletedEntityIds.has(dep.targetId),
    );

    await this.applyModel({
      ...this._model,
      groups,
      tasks,
      milestones,
      dependencies,
    });
  }

  /**
   * Deletes a group and reparents its direct descendants to the parent group.
   */
  private async deleteGroupReparent(
    groupId: string,
    parentGroupId: string | undefined,
  ): Promise<void> {
    const groups = this._model.groups
      .filter((group) => group.id !== groupId)
      .map((group) =>
        group.groupId === groupId
          ? { ...group, groupId: parentGroupId }
          : group,
      );
    const tasks = this._model.tasks.map((task) =>
      task.groupId === groupId ? { ...task, groupId: parentGroupId } : task,
    );
    const milestones = this._model.milestones.map((milestone) =>
      milestone.groupId === groupId
        ? { ...milestone, groupId: parentGroupId }
        : milestone,
    );

    await this.applyModel({ ...this._model, groups, tasks, milestones });
  }

  /**
   * Re-parses the underlying text document and updates cached models.
   */
  private reparse(): void {
    if (this._isDisposed) {
      return;
    }
    try {
      const model = parseDocument(this.document.getText());
      const graph = hydrateDocument(model);
      this._model = model;
      this._graph = graph;
      this._validation = validateSemanticGraph(graph);
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
   * Validates and applies a full-document replacement through WorkspaceEdit.
   */
  private async applyModel(next: GanttDocument): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      parseDocument(serializeDocument(next));
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

/**
 * Replaces an entity by id, appending it when not found.
 */
function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }
  const copy = items.slice();
  copy[index] = next;
  return copy;
}

/**
 * Replaces an existing entity by id and returns undefined when the id is missing.
 */
function replaceExistingById<T extends { id: string }>(
  items: T[],
  next: T,
): T[] | undefined {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return undefined;
  }
  const copy = items.slice();
  copy[index] = next;
  return copy;
}

/**
 * Collects all group ids in a subtree, including the root group id.
 */
function collectGroupSubtreeIds(
  groups: Group[],
  rootGroupId: string,
): string[] {
  const collected = new Set<string>([rootGroupId]);
  let frontier = [rootGroupId];
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const parentId of frontier) {
      for (const group of groups) {
        if (group.groupId === parentId && !collected.has(group.id)) {
          collected.add(group.id);
          nextFrontier.push(group.id);
        }
      }
    }
    frontier = nextFrontier;
  }
  return [...collected];
}
