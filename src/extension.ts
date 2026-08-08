import * as vscode from "vscode";
import { createEmptyDocument, Task } from "./common/models";
import { EditableEntityRef } from "./common/protocol";
import { GanttStore } from "./ganttStore";
import { serializeDocument } from "./services/ganttDocumentService";
import { GanttEditorProvider } from "./views/editor/ganttEditorProvider";
import {
  entityRefOf,
  GanttExplorerProvider,
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

  register("ganttee.revealEntity", (entity) => {
    if (isEntityRef(entity)) {
      store.active?.revealEntity(entity);
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
    const task = createDefaultTask(vscode.l10n.t("New Task"));
    await controller.upsertTask(task);
    controller.editEntity({ kind: "task", id: task.id });
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

/**
 * Returns whether a value is an {@link EditableEntityRef}.
 */
function isEntityRef(value: unknown): value is EditableEntityRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { kind?: unknown; id?: unknown };
  return (
    (candidate.kind === "task" ||
      candidate.kind === "milestone" ||
      candidate.kind === "group") &&
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
