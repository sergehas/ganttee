import * as vscode from "vscode";
import { createEmptyDocument, Task } from "./common/models";
import { GanttStore } from "./ganttStore";
import { serializeDocument } from "./services/ganttDocumentService";
import { GanttEditorProvider } from "./views/editor/ganttEditorProvider";
import {
  GanttExplorerProvider,
  taskIdOf,
} from "./views/sidebar/ganttExplorerProvider";

export function activate(context: vscode.ExtensionContext) {
  const store = new GanttStore();
  context.subscriptions.push(store);

  context.subscriptions.push(GanttEditorProvider.register(context, store));

  const explorer = new GanttExplorerProvider(store);
  context.subscriptions.push(
    vscode.window.createTreeView(GanttExplorerProvider.viewId, {
      treeDataProvider: explorer,
    }),
  );

  registerCommands(context, store, explorer);
}

export function deactivate() {}

function registerCommands(
  context: vscode.ExtensionContext,
  store: GanttStore,
  explorer: GanttExplorerProvider,
): void {
  const register = (
    command: string,
    handler: (...args: unknown[]) => unknown,
  ) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(command, handler),
    );

  register("ganttee.refreshExplorer", () => explorer.refresh());

  register("ganttee.revealTask", (taskId) => {
    if (typeof taskId === "string") {
      store.active?.revealTask(taskId);
    }
  });

  register("ganttee.newTask", async () => {
    const controller = store.active;
    if (!controller) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t("Open a Gantt chart to add a task."),
      );
      return;
    }
    const task = createDefaultTask();
    await controller.upsertTask(task);
    controller.editTask(task.id);
  });

  register("ganttee.editTask", (node) => {
    const taskId = taskIdOf(node);
    if (taskId) {
      store.active?.editTask(taskId);
    }
  });

  register("ganttee.deleteTask", async (node) => {
    const taskId = taskIdOf(node);
    if (!taskId) {
      return;
    }
    const deleteLabel = vscode.l10n.t("Delete");
    const confirmation = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete this task?"),
      { modal: true },
      deleteLabel,
    );
    if (confirmation === deleteLabel) {
      await store.active?.deleteTask(taskId);
    }
  });
}

function createDefaultTask(): Task {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 3);
  return {
    id: generateId("task"),
    name: "New Task",
    start: toIsoDate(today),
    end: toIsoDate(end),
    progress: 0,
    status: "todo",
  };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Serialized template used when creating a blank `.ganttee` document. */
export const emptyDocumentText = serializeDocument(createEmptyDocument());
