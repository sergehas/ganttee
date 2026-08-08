import * as vscode from "vscode";
import {
  createEmptyDocument,
  CyclicDependencyError,
  Dependency,
  GanttDocument,
  GanttModel,
  Milestone,
  ParallelEdgeDependencyError,
  SelfLoopDependencyError,
  Task,
} from "../../common/models";
import {
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "../../common/protocol";
import { wouldCreateCycle } from "../../services/dependencyGraphService";
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

  /** Reveals the editor panel and posts the initial model to the webview. */
  sendInit(): void {
    this.post({ type: "init", document: this._model });
  }

  focus(): void {
    this.webviewPanel.reveal(this.webviewPanel.viewColumn);
  }

  revealTask(taskId: string): void {
    this.focus();
    this.post({ type: "selectTask", taskId });
  }

  editTask(taskId: string): void {
    this.focus();
    this.post({ type: "editTask", taskId });
  }

  async upsertTask(task: Task): Promise<void> {
    const tasks = replaceById(this._model.tasks, task);
    await this.applyModel({ ...this._model, tasks });
  }

  async deleteTask(taskId: string): Promise<void> {
    const tasks = this._model.tasks.filter((task) => task.id !== taskId);
    const dependencies = this._model.dependencies.filter(
      (dep) => dep.sourceId !== taskId && dep.targetId !== taskId,
    );
    await this.applyModel({ ...this._model, tasks, dependencies });
  }

  async upsertMilestone(milestone: Milestone): Promise<void> {
    const milestones = replaceById(this._model.milestones, milestone);
    await this.applyModel({ ...this._model, milestones });
  }

  async addDependency(dependency: Dependency): Promise<boolean> {
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

  async removeDependency(dependencyId: string): Promise<void> {
    const dependencies = this._model.dependencies.filter(
      (dep) => dep.id !== dependencyId,
    );
    await this.applyModel({ ...this._model, dependencies });
  }

  dispose(): void {
    this._onDidChangeModel.dispose();
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }

  private async handleMessage(message: WebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.sendInit();
        break;
      case "updateTask":
        await this.upsertTask(message.task);
        break;
      case "updateMilestone":
        await this.upsertMilestone(message.milestone);
        break;
      case "addDependency":
        await this.addDependency(message.dependency);
        break;
      case "removeDependency":
        await this.removeDependency(message.dependencyId);
        break;
      case "deleteTask":
        await this.deleteTask(message.taskId);
        break;
      case "requestEditTask":
        this.editTask(message.taskId);
        break;
    }
  }

  private reparse(): void {
    try {
      const model = parseDocument(this.document.getText());
      const graph = hydrateDocument(model);
      this._model = model;
      this._graph = graph;
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

  private async applyModel(next: GanttDocument): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      this.document.positionAt(0),
      this.document.positionAt(this.document.getText().length),
    );
    edit.replace(this.document.uri, fullRange, serializeDocument(next));
    await vscode.workspace.applyEdit(edit);
  }

  private post(message: HostToWebviewMessage): void {
    void this.webviewPanel.webview.postMessage(message);
  }
}

function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }
  const copy = items.slice();
  copy[index] = next;
  return copy;
}
