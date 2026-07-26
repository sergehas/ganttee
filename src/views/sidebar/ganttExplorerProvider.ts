import * as vscode from "vscode";
import {
  effectiveEnd,
  effectiveStart,
  Group,
  Milestone,
  Task,
} from "../../common/models";
import { GanttStore } from "../../ganttStore";

type GanttNode =
  | { kind: "group"; group: Group }
  | { kind: "task"; task: Task }
  | { kind: "milestone"; milestone: Milestone };

/** Sidebar tree of groups, tasks, and milestones for the active Gantt editor. */
export class GanttExplorerProvider implements vscode.TreeDataProvider<GanttNode> {
  static readonly viewId = "ganttee.explorer";

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly store: GanttStore) {
    store.onDidChangeActive(() => this._onDidChangeTreeData.fire());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node: GanttNode): vscode.TreeItem {
    switch (node.kind) {
      case "group":
        return this.groupItem(node.group);
      case "task":
        return this.taskItem(node.task);
      case "milestone":
        return this.milestoneItem(node.milestone);
    }
  }

  getChildren(element?: GanttNode): GanttNode[] {
    const model = this.store.active?.model;
    if (!model) {
      return [];
    }

    if (!element) {
      const rootGroups = model.groups.filter((group) => !group.groupId);
      const ungroupedTasks = model.tasks.filter((task) => !task.groupId);
      const ungroupedMilestones = model.milestones.filter(
        (milestone) => !milestone.groupId,
      );
      return [
        ...rootGroups.map((group): GanttNode => ({ kind: "group", group })),
        ...ungroupedTasks.map((task): GanttNode => ({ kind: "task", task })),
        ...ungroupedMilestones.map(
          (milestone): GanttNode => ({ kind: "milestone", milestone }),
        ),
      ];
    }

    if (element.kind === "group") {
      const groupId = element.group.id;
      const childGroups = model.groups.filter(
        (group) => group.groupId === groupId,
      );
      const tasks = model.tasks.filter((task) => task.groupId === groupId);
      const milestones = model.milestones.filter(
        (milestone) => milestone.groupId === groupId,
      );
      return [
        ...childGroups.map((group): GanttNode => ({ kind: "group", group })),
        ...tasks.map((task): GanttNode => ({ kind: "task", task })),
        ...milestones.map(
          (milestone): GanttNode => ({ kind: "milestone", milestone }),
        ),
      ];
    }

    return [];
  }

  private groupItem(group: Group): vscode.TreeItem {
    const item = new vscode.TreeItem(
      group.name,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    item.contextValue = "ganttee.group";
    item.iconPath = new vscode.ThemeIcon("folder");
    item.id = `group:${group.id}`;
    return item;
  }

  private taskItem(task: Task): vscode.TreeItem {
    const item = new vscode.TreeItem(
      task.name,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = `${effectiveStart(task) ?? "—"} → ${effectiveEnd(task) ?? "—"}`;
    item.contextValue = "ganttee.task";
    item.iconPath = new vscode.ThemeIcon("checklist");
    item.id = `task:${task.id}`;
    item.command = {
      command: "ganttee.revealTask",
      title: "Reveal Task",
      arguments: [task.id],
    };
    return item;
  }

  private milestoneItem(milestone: Milestone): vscode.TreeItem {
    const item = new vscode.TreeItem(
      milestone.name,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = milestone.date;
    item.contextValue = "ganttee.milestone";
    item.iconPath = new vscode.ThemeIcon("milestone");
    item.id = `milestone:${milestone.id}`;
    return item;
  }
}

/** Extracts the task id from a tree node, if it is a task. */
export function taskIdOf(node: unknown): string | undefined {
  if (
    typeof node === "object" &&
    node !== null &&
    (node as GanttNode).kind === "task"
  ) {
    return (node as { task: Task }).task.id;
  }
  return undefined;
}
