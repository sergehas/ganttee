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
import { buildTaskOrMilestoneDeletionDocument } from "../../services/entityEditWorkflowService";
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
  private _validation: GraphValidationResult = {
    ok: true,
    cycle: [],
    danglingDependencyIds: [],
    underConstrainedIds: [],
    overConstrainedIds: [],
    duplicateEndpointIds: [],
    constraintCounts: {},
    groupDependencyIds: [],
    unanchoredComponentIds: [],
  };
  private _isDisposed = false;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeModel = new vscode.EventEmitter<void>();

  /**
   * Entity-specific mutation strategies using DRY principle.
   *
   * **Purpose & Benefits:**
   * - Eliminates duplicate update/delete code for tasks, milestones, and groups
   * - Each entity kind maps to get/set functions that abstract array access
   * - Single source of truth for "how to mutate this entity type"
   * - Adding a new entity type requires only one entry here, not multiple methods
   * - Easier testing: mutations are standardized and testable in isolation
   *
   * **Single Responsibility (SOLID):** Each strategy is responsible only for
   * accessing the correct entity array and reconstructing the model.
   *
   * **DRY (Don't Repeat Yourself):** Replaces three `updateExistingX` methods
   * and three `deleteX` methods with generic handlers that use these strategies.
   */
  private readonly entityMutationStrategies: Record<
    EditableEntityKind,
    {
      /** Get the current entity array from the model. */
      get: () => (Task | Milestone | Group)[];
      /** Reconstruct a new model with the updated entity array. */
      set: (items: (Task | Milestone | Group)[]) => GanttDocument;
    }
  > = {
    task: {
      get: () => this._document.tasks,
      set: (items) => ({ ...this._document, tasks: items as Task[] }),
    },
    milestone: {
      get: () => this._document.milestones,
      set: (items) => ({ ...this._document, milestones: items as Milestone[] }),
    },
    group: {
      get: () => this._document.groups,
      set: (items) => ({ ...this._document, groups: items as Group[] }),
    },
  };

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
  get validation(): GraphValidationResult {
    return this._validation;
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
    const tasks = replaceById(this._document.tasks, task);
    await this.applyModel({ ...this._document, tasks });
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
    if (wouldCreateCycle(this._document.dependencies, dependency)) {
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
   * Updates one existing entity using the mutation strategy for its kind.
   * Shows a warning and no-ops if the entity id is not found.
   *
   * Uses {@link entityMutationStrategies} to eliminate duplication across
   * task/milestone/group updates. This single method replaces three
   * task-specific methods, reducing maintenance burden and risk of divergence.
   */
  private async updateEntity(
    kind: EditableEntityKind,
    entity: Task | Milestone | Group,
  ): Promise<void> {
    const strategy = this.entityMutationStrategies[kind];
    const updated = findAndReplaceExistingById(strategy.get(), entity);
    if (!updated) {
      this.showUnknownIdWarning(kind, entity.id);
      return;
    }
    await this.applyModel(strategy.set(updated));
  }

  /**
   * Deletes one entity (task or milestone) and all edges connected to it.
   * Shows a warning and no-ops if the entity id is not found.
   *
   * Uses {@link entityMutationStrategies} to consolidate task and milestone
   * deletion. Groups are handled separately by {@link deleteGroup} due to
   * their reparenting and cascade logic.
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
    const group = this._document.groups.find(
      (current) => current.id === groupId,
    );
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

    const nextModel = await this.buildGroupDeleteModel(
      groupId,
      group.groupId,
      resolvedStrategy,
    );
    if (nextModel) {
      await this.applyModel(nextModel);
    }
  }

  /**
   * Builds the next model state after deleting a group via cascade or reparent.
   * Extracted for testability and to separate model construction from application.
   */
  private async buildGroupDeleteModel(
    groupId: string,
    parentGroupId: string | undefined,
    strategy: GroupDeleteStrategy,
  ): Promise<GanttDocument | null> {
    if (strategy === "cascade") {
      return this.buildGroupDeleteCascadeModel(groupId);
    }
    return this.buildGroupDeleteReparentModel(groupId, parentGroupId);
  }

  /**
   * Constructs the model state for cascade delete: removes the group subtree
   * and all connected edges.
   */
  private buildGroupDeleteCascadeModel(groupId: string): GanttDocument {
    const groupIds = collectGroupSubtreeIds(this._document.groups, groupId);
    const groupIdSet = new Set(groupIds);
    const deletedEntityIds = new Set<string>();

    const groups = this._document.groups.filter(
      (group) => !groupIdSet.has(group.id),
    );
    const tasks = this._document.tasks.filter((task) => {
      const inSubtree =
        task.groupId !== undefined && groupIdSet.has(task.groupId);
      if (inSubtree) {
        deletedEntityIds.add(task.id);
      }
      return !inSubtree;
    });
    const milestones = this._document.milestones.filter((milestone) => {
      const inSubtree =
        milestone.groupId !== undefined && groupIdSet.has(milestone.groupId);
      if (inSubtree) {
        deletedEntityIds.add(milestone.id);
      }
      return !inSubtree;
    });

    const dependencies = this._document.dependencies.filter(
      (dep) =>
        !deletedEntityIds.has(dep.sourceId) &&
        !deletedEntityIds.has(dep.targetId),
    );

    return { ...this._document, groups, tasks, milestones, dependencies };
  }

  /**
   * Constructs the model state for reparent delete: removes the group and
   * reassigns its direct descendants to the parent group.
   */
  private buildGroupDeleteReparentModel(
    groupId: string,
    parentGroupId: string | undefined,
  ): GanttDocument {
    const groups = this._document.groups
      .filter((group) => group.id !== groupId)
      .map((group) =>
        group.groupId === groupId
          ? { ...group, groupId: parentGroupId }
          : group,
      );
    const tasks = this._document.tasks.map((task) =>
      task.groupId === groupId ? { ...task, groupId: parentGroupId } : task,
    );
    const milestones = this._document.milestones.map((milestone) =>
      milestone.groupId === groupId
        ? { ...milestone, groupId: parentGroupId }
        : milestone,
    );

    return { ...this._document, groups, tasks, milestones };
  }

  /**
   * Returns true when a group contains members or child groups.
   */
  private hasGroupContents(groupId: string): boolean {
    return (
      this._document.tasks.some((task) => task.groupId === groupId) ||
      this._document.milestones.some(
        (milestone) => milestone.groupId === groupId,
      ) ||
      this._document.groups.some((group) => group.groupId === groupId)
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
   * Re-parses the underlying text document and updates cached models.
   */
  private reparse(): void {
    if (this._isDisposed) {
      return;
    }
    try {
      const document = parseDocument(this.document.getText());
      const hydratedModel = hydrateDocument(document);
      this._document = document;
      this._model = hydratedModel;
      this._validation = validateSemanticGraph(hydratedModel);
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
      const parsed = parseDocument(serializeDocument(next));
      const validation = validateSemanticGraph(hydrateDocument(parsed));
      const blockingViolations = [
        ...validation.underConstrainedIds,
        ...validation.overConstrainedIds.filter(
          (id) => !validation.duplicateEndpointIds.includes(id),
        ),
      ];
      if (blockingViolations.length > 0) {
        const violations = [
          validation.underConstrainedIds.length > 0
            ? vscode.l10n.t("under-constrained items: {0}",
                validation.underConstrainedIds.join(", "))
            : undefined,
          validation.overConstrainedIds.some(
            (id) => !validation.duplicateEndpointIds.includes(id),
          )
            ? vscode.l10n.t("over-constrained items: {0}",
                validation.overConstrainedIds
                  .filter((id) => !validation.duplicateEndpointIds.includes(id))
                  .join(", "))
            : undefined,
          validation.danglingDependencyIds.length > 0
            ? vscode.l10n.t("dangling dependencies: {0}",
                validation.danglingDependencyIds.join(", "))
            : undefined,
          validation.groupDependencyIds.length > 0
            ? vscode.l10n.t("group dependencies: {0}",
                validation.groupDependencyIds.join(", "))
            : undefined,
          validation.unanchoredComponentIds.length > 0
            ? vscode.l10n.t("unanchored components: {0}",
                validation.unanchoredComponentIds.join(", "))
            : undefined,
        ].filter((message): message is string => message !== undefined);
        void vscode.window.showErrorMessage(
          vscode.l10n.t("Cannot apply update: {0}", violations.join("; ")),
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

/**
 * Replaces an entity by id, appending it when not found.
 * Generic utility unifying array mutation logic for all entity types.
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
 * Finds and replaces an entity by id, returning undefined when the id is missing.
 * Used by {@link GanttEditorController.updateEntity} to consolidate update logic
 * across task, milestone, and group types.
 */
function findAndReplaceExistingById<T extends { id: string }>(
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
