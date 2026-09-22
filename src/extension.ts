import {
  createDefaultGroup,
  createDefaultMilestone,
  createDefaultTask,
  createEmptyDocument,
} from "@common/documents";
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
  const treeView = vscode.window.createTreeView(GanttExplorerProvider.viewId, {
    treeDataProvider: explorer,
    dragAndDropController: explorer,
    canSelectMany: true,
  });
  context.subscriptions.push(treeView);

  registerCommands(context, store, explorer, treeView);
}

export function deactivate() {
  /* noop */
}

function registerCommands(
  context: vscode.ExtensionContext,
  store: GanttStore,
  explorer: GanttExplorerProvider,
  treeView: vscode.TreeView<unknown>,
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
    await controller.upsertTask(task, currentSelection(treeView));
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
    await controller.upsertGroup(group, currentSelection(treeView));
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
    await controller.upsertMilestone(milestone, currentSelection(treeView));
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
    const entity = resolveEntity(node);
    if (entity) {
      await store.active?.moveEntity(entity, "up");
    }
  });

  register("ganttee.moveDown", async (node) => {
    const entity = resolveEntity(node);
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

  register("ganttee.editProjectItem", (node) => {
    const entity = resolveEntity(node);
    if (!entity) {
      return;
    }
    store.active?.editEntity(entity);
  });

  register("ganttee.deleteProjectItem", async (node) => {
    const entity = resolveEntity(node);
    if (!entity) {
      return;
    }
    const deleteLabel = vscode.l10n.t("Delete");
    const confirmation = await vscode.window.showWarningMessage(
      entity.kind === "group"
        ? vscode.l10n.t("Delete this group?")
        : entity.kind === "task"
          ? vscode.l10n.t("Delete this task?")
          : vscode.l10n.t("Delete this milestone?"),
      { modal: true },
      deleteLabel,
    );
    if (confirmation === deleteLabel) {
      await store.active?.deleteEntity(entity, entity.kind === "group" ? "cascade" : undefined);
    }
  });

  register("ganttee.deleteSelection", async (...args) => {
    const entities = args
      .flatMap((arg) => (Array.isArray(arg) ? arg.map(resolveEntity) : [resolveEntity(arg)]))
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

/** Resolves a row command argument that may be a raw entity ref or a tree node. */
function resolveEntity(value: unknown): EditableEntityRef | undefined {
  return isEntityRef(value) ? value : entityRefOf(value);
}

/** Reads the sidebar's currently selected entity, if any, at invocation time. */
function currentSelection(treeView: vscode.TreeView<unknown>): EditableEntityRef | undefined {
  return entityRefOf(treeView.selection[0]);
}

/** Serialized template used when creating a blank `.ganttee` document. */
export const emptyDocumentText = serializeDocument(createEmptyDocument());
