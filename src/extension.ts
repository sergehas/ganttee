import { createEmptyDocument, Group, Milestone, Task } from "@common/documents";
import { EditableEntityRef } from "@common/protocol";
import { serializeDocument } from "@services/document/documentService";
import { GanttEditorProvider } from "@views/editor/ganttEditorProvider";
import { entityRefOf, GanttExplorerProvider } from "@views/sidebar/ganttExplorerProvider";
import * as vscode from "vscode";
import { GanttStore } from "./ganttStore";

export function activate(context: vscode.ExtensionContext) {
  const store = new GanttStore();
  context.subscriptions.push(store);

  context.subscriptions.push(GanttEditorProvider.register(context, store));

  const explorer = new GanttExplorerProvider(store, context.extensionUri);
  context.subscriptions.push(vscode.window.onDidChangeActiveColorTheme(() => explorer.refresh()));
  context.subscriptions.push(
    vscode.window.createTreeView(GanttExplorerProvider.viewId, {
      treeDataProvider: explorer,
      dragAndDropController: explorer,
      canSelectMany: true,
    }),
  );

  registerCommands(context, store, explorer);
}

export function deactivate() {
  /* noop */
}

function registerCommands(
  context: vscode.ExtensionContext,
  store: GanttStore,
  explorer: GanttExplorerProvider,
): void {
  const register = (command: string, handler: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));

  register("ganttee.refreshExplorer", () => explorer.refresh());

  register("ganttee.revealEntity", (entity) => {
    if (isEntityRef(entity)) {
      store.active?.revealEntity(entity);
    }
  });

  register("ganttee.newTask", async () => {
    const controller = store.active;
    if (!controller) {
      void vscode.window.showInformationMessage(vscode.l10n.t("Open a Gantt chart to add a task."));
      return;
    }
    const task = createDefaultTask(vscode.l10n.t("New Task"));
    await controller.upsertTask(task);
    controller.editEntity({ kind: "task", id: task.id });
  });

  register("ganttee.newGroup", async () => {
    const controller = store.active;
    if (!controller) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t("Open a Gantt chart to add a group."),
      );
      return;
    }
    const group = createDefaultGroup(vscode.l10n.t("New Group"));
    await controller.upsertGroup(group);
    controller.editEntity({ kind: "group", id: group.id });
  });

  register("ganttee.newMilestone", async () => {
    const controller = store.active;
    if (!controller) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t("Open a Gantt chart to add a milestone."),
      );
      return;
    }
    const milestone = createDefaultMilestone(vscode.l10n.t("New Milestone"));
    await controller.upsertMilestone(milestone);
    controller.editEntity({ kind: "milestone", id: milestone.id });
  });

  register("ganttee.newProject", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t("Open a workspace folder before creating a Gantt project."),
      );
      return;
    }
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.joinPath(workspaceFolder.uri, "untitled.ganttee"),
      filters: { [vscode.l10n.t("Gantt project")]: ["ganttee"] },
    });
    if (uri === undefined) {
      return;
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(emptyDocumentText, "utf8"));
    await vscode.commands.executeCommand("vscode.openWith", uri, "ganttee.chartEditor");
  });

  register("ganttee.search", async () => {
    const term = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Search project items"),
      value: explorer.currentSearchTerm,
    });
    if (term !== undefined) {
      explorer.setSearchTerm(term);
    }
  });

  register("ganttee.moveUp", async (node) => {
    const entity = entityRefOf(node);
    if (entity) {
      await store.active?.moveEntity(entity, "up");
    }
  });

  register("ganttee.moveDown", async (node) => {
    const entity = entityRefOf(node);
    if (entity) {
      await store.active?.moveEntity(entity, "down");
    }
  });

  register("ganttee.sort", async () => {
    const direction = await vscode.window.showQuickPick(
      [
        { label: vscode.l10n.t("Ascending"), value: "ascending" as const },
        { label: vscode.l10n.t("Descending"), value: "descending" as const },
      ],
      { placeHolder: vscode.l10n.t("Sort project items") },
    );
    if (direction) {
      await store.active?.sortItems(direction.value);
    }
  });

  register("ganttee.editTask", (node) => {
    const entity = entityRefOf(node);
    if (entity?.kind === "task") {
      store.active?.editEntity(entity);
    }
  });

  register("ganttee.editMilestone", (node) => {
    const entity = entityRefOf(node);
    if (entity?.kind === "milestone") {
      store.active?.editEntity(entity);
    }
  });

  register("ganttee.editGroup", (node) => {
    const entity = entityRefOf(node);
    if (entity?.kind === "group") {
      store.active?.editEntity(entity);
    }
  });

  register("ganttee.deleteTask", async (node) => {
    const entity = entityRefOf(node);
    if (entity?.kind !== "task") {
      return;
    }
    const deleteLabel = vscode.l10n.t("Delete");
    const confirmation = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete this task?"),
      { modal: true },
      deleteLabel,
    );
    if (confirmation === deleteLabel) {
      await store.active?.deleteEntity(entity);
    }
  });

  register("ganttee.deleteMilestone", async (node) => {
    const entity = entityRefOf(node);
    if (entity?.kind !== "milestone") {
      return;
    }
    const deleteLabel = vscode.l10n.t("Delete");
    const confirmation = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete this milestone?"),
      { modal: true },
      deleteLabel,
    );
    if (confirmation === deleteLabel) {
      await store.active?.deleteEntity(entity);
    }
  });

  register("ganttee.deleteGroup", async (node) => {
    const entity = entityRefOf(node);
    if (entity?.kind !== "group") {
      return;
    }
    await store.active?.deleteEntity(entity);
  });

  register("ganttee.deleteSelection", async (...args) => {
    const entities = args
      .flatMap((arg) => (Array.isArray(arg) ? arg.map(entityRefOf) : [entityRefOf(arg)]))
      .filter(isEntityRef);
    if (entities.length === 0) {
      return;
    }
    const confirmation = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete these items?"),
      { modal: true },
      vscode.l10n.t("Delete"),
    );
    if (confirmation !== vscode.l10n.t("Delete")) {
      return;
    }
    for (const entity of entities) {
      await store.active?.deleteEntity(entity, entity.kind === "group" ? "cascade" : undefined);
    }
  });

  register("ganttee.requestEditEntity", (entity) => {
    if (isEntityRef(entity)) {
      store.active?.editEntity(entity);
    }
  });
}

/**
 * Creates a new task template with a localized default name.
 */
function createDefaultTask(name: string): Task {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 3);
  return {
    id: generateId("task"),
    name,
    start: toIsoDate(today),
    end: toIsoDate(end),
    progress: 0,
    status: "todo",
  };
}

/** Creates a new group template with a localized default name. */
function createDefaultGroup(name: string): Group {
  return { id: generateId("group"), name };
}

/** Creates a new milestone template with today's date. */
function createDefaultMilestone(name: string): Milestone {
  return { id: generateId("milestone"), name, date: toIsoDate(new Date()) };
}

/**
 * Returns whether a value is an {@link EditableEntityRef}.
 */
function isEntityRef(value: unknown): value is EditableEntityRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { kind?: unknown; id?: unknown };
  return (
    (candidate.kind === "task" || candidate.kind === "milestone" || candidate.kind === "group") &&
    typeof candidate.id === "string"
  );
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Serialized template used when creating a blank `.ganttee` document. */
export const emptyDocumentText = serializeDocument(createEmptyDocument());
