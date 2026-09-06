import * as vscode from "vscode";
import { Group, Milestone, ScheduledModel, Task } from "../../common/models";
import { EditableEntityRef } from "../../common/protocol";
import { GanttStore } from "../../ganttStore";
import {
  diagnosticsFor,
  ScheduleDiagnostic,
} from "../../services/scheduleGraphValidationService";
import { describeDiagnostic } from "../scheduleDiagnosticPresenter";

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

  /**
   * Returns the diagnostics from the active editor, if any.
   */
  private getDiagnostics(): readonly ScheduleDiagnostic[] {
    return this.store.active?.validation ?? [];
  }

  getChildren(element?: GanttNode): GanttNode[] {
    const model = this.store.active?.getGanttDocument();
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
        ...ungroupedMilestones.map((milestone): GanttNode => ({
          kind: "milestone",
          milestone,
        })),
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
        ...milestones.map((milestone): GanttNode => ({
          kind: "milestone",
          milestone,
        })),
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
    this.applyDiagnosticPresentation(item, group.id);
    const scheduledGroup = this.scheduledModel?.groups.find(
      (candidate) => candidate.id === group.id,
    );
    if (scheduledGroup) {
      item.description =
        this.formatDateRange(
          scheduledGroup.effectiveStart,
          scheduledGroup.effectiveEnd,
        ) + ` (${scheduledGroup.effectiveDuration}d)`;
    }
    return item;
  }

  private taskItem(task: Task): vscode.TreeItem {
    const item = new vscode.TreeItem(
      task.name,
      vscode.TreeItemCollapsibleState.None,
    );
    const scheduledTask = this.scheduledModel?.tasks.find(
      (candidate) => candidate.id === task.id,
    );
    if (scheduledTask) {
      item.description = `${this.formatDateRange(
        scheduledTask.effectiveStart(),
        scheduledTask.effectiveEnd(),
      )} (${scheduledTask.effectiveDuration()}d)`;
    }
    item.contextValue = "ganttee.task";
    item.iconPath = new vscode.ThemeIcon("checklist");
    item.id = `task:${task.id}`;
    item.command = {
      command: "ganttee.revealEntity",
      title: "Reveal Task",
      arguments: [{ kind: "task", id: task.id }],
    };

    this.applyDiagnosticPresentation(item, task.id);

    return item;
  }

  private milestoneItem(milestone: Milestone): vscode.TreeItem {
    const item = new vscode.TreeItem(
      milestone.name,
      vscode.TreeItemCollapsibleState.None,
    );
    const scheduledMilestone = this.scheduledModel?.milestones.find(
      (candidate) => candidate.id === milestone.id,
    );
    if (scheduledMilestone) {
      item.description = this.formatShortDate(
        scheduledMilestone.effectiveStart(),
      );
    }
    item.contextValue = "ganttee.milestone";
    item.iconPath = new vscode.ThemeIcon("milestone");
    item.id = `milestone:${milestone.id}`;
    item.command = {
      command: "ganttee.revealEntity",
      title: "Reveal Milestone",
      arguments: [{ kind: "milestone", id: milestone.id }],
    };

    this.applyDiagnosticPresentation(item, milestone.id);

    return item;
  }

  /** Returns the current host-computed schedule. */
  private get scheduledModel(): ScheduledModel | undefined {
    return this.store.active?.scheduledModel;
  }

  /** Formats a pair of effective dates for a tree item description. */
  private formatDateRange(start: Date, end: Date): string {
    return `${this.formatShortDate(start)} → ${this.formatShortDate(end)}`;
  }

  /** Formats a UTC effective date using the user's locale and short date style. */
  private formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }

  /** Applies the detailed tooltip and severity indicator for an entity. */
  private applyDiagnosticPresentation(
    item: vscode.TreeItem,
    entityId: string,
  ): void {
    const diagnostics = diagnosticsFor(this.getDiagnostics(), entityId);
    if (diagnostics.length === 0) {
      return;
    }
    item.tooltip = diagnostics
      .map((diagnostic) => describeDiagnostic(diagnostic, entityId))
      .join("\n");
    const hasBlockingDiagnostic = diagnostics.some(
      (diagnostic) => diagnostic.severity === "blocking",
    );
    item.iconPath = new vscode.ThemeIcon(
      hasBlockingDiagnostic ? "error" : "warning",
      new vscode.ThemeColor(
        hasBlockingDiagnostic
          ? "list.errorForeground"
          : "list.warningForeground",
      ),
    );
  }
}

/**
 * Extracts the editable entity identity from a tree node.
 */
export function entityRefOf(node: unknown): EditableEntityRef | undefined {
  if (typeof node !== "object" || node === null) {
    return undefined;
  }
  const candidate = node as GanttNode;
  switch (candidate.kind) {
    case "task":
      return { kind: "task", id: candidate.task.id };
    case "milestone":
      return { kind: "milestone", id: candidate.milestone.id };
    case "group":
      return { kind: "group", id: candidate.group.id };
  }
}
