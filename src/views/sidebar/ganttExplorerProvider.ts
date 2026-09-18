import { formatShortDate } from "@common/dates";
import { Group, Milestone, ProjectDocument, Task } from "@common/documents";
import { ProjectSchedule } from "@common/models";
import { EditableEntityRef } from "@common/protocol";
import {
  diagnosticsFor,
  ScheduleDiagnostic,
} from "@services/schedule/scheduleGraphValidationService";
import { filterProjectItemIds } from "@services/sidebar/treeItemFilterService";
import { GanttStore } from "@src/ganttStore";
import { describeDiagnostic } from "@views/scheduleDiagnosticPresenter";
import * as vscode from "vscode";

type GanttNode =
  | { kind: "group"; group: Group }
  | { kind: "task"; task: Task }
  | { kind: "milestone"; milestone: Milestone };

/** Sidebar tree of groups, tasks, and milestones for the active Gantt editor. */
export class GanttExplorerProvider
  implements vscode.TreeDataProvider<GanttNode>, vscode.TreeDragAndDropController<GanttNode>
{
  static readonly viewId = "ganttee.explorer";
  readonly dropMimeTypes = ["application/vnd.code.tree.ganttee"];
  readonly dragMimeTypes = ["application/vnd.code.tree.ganttee"];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private searchTerm = "";

  constructor(
    private readonly store: GanttStore,
    private readonly extensionUri: vscode.Uri,
  ) {
    store.onDidChangeActive(() => this._onDidChangeTreeData.fire());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /** Sets the transient literal name filter used by the tree. */
  setSearchTerm(term: string): void {
    this.searchTerm = term;
    this.refresh();
  }

  /** Returns the active transient search term. */
  get currentSearchTerm(): string {
    return this.searchTerm;
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
    const model = this.store.active?.getProjectDocument();
    if (!model) {
      return [];
    }

    if (!element) {
      const rootGroups = model.groups.filter((group) => !group.groupId);
      const ungroupedTasks = model.tasks.filter((task) => !task.groupId);
      const ungroupedMilestones = model.milestones.filter((milestone) => !milestone.groupId);
      return this.filterNodes(
        [
          ...rootGroups.map((group): GanttNode => ({ kind: "group", group })),
          ...ungroupedTasks.map((task): GanttNode => ({ kind: "task", task })),
          ...ungroupedMilestones.map((milestone): GanttNode => ({
            kind: "milestone",
            milestone,
          })),
        ],
        model,
      );
    }

    if (element.kind === "group") {
      const groupId = element.group.id;
      const childGroups = model.groups.filter((group) => group.groupId === groupId);
      const tasks = model.tasks.filter((task) => task.groupId === groupId);
      const milestones = model.milestones.filter((milestone) => milestone.groupId === groupId);
      return this.filterNodes(
        [
          ...childGroups.map((group): GanttNode => ({ kind: "group", group })),
          ...tasks.map((task): GanttNode => ({ kind: "task", task })),
          ...milestones.map((milestone): GanttNode => ({
            kind: "milestone",
            milestone,
          })),
        ],
        model,
      );
    }

    return [];
  }

  /** Serializes selected tree nodes for a grouping drop. */
  handleDrag(
    source: readonly GanttNode[],
    dataTransfer: vscode.DataTransfer,
  ): void | Thenable<void> {
    const entities = source.map(entityRefOf).filter(isEntityRef);
    dataTransfer.set("application/vnd.code.tree.ganttee", new vscode.DataTransferItem(entities));
  }

  /** Applies valid grouping drops while silently ignoring invalid targets. */
  async handleDrop(
    target: GanttNode | undefined,
    dataTransfer: vscode.DataTransfer,
  ): Promise<void> {
    const item = dataTransfer.get("application/vnd.code.tree.ganttee");
    const entities = item?.value as unknown;
    if (!Array.isArray(entities) || !entities.every(isEntityRef)) {
      return;
    }
    if (target !== undefined && target.kind !== "group") {
      return;
    }
    await this.store.active?.assignEntitiesToGroup(
      entities,
      target?.kind === "group" ? target.group.id : undefined,
    );
  }

  private groupItem(group: Group): vscode.TreeItem {
    const item = new vscode.TreeItem(group.name, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = "ganttee.group";
    item.id = `group:${group.id}`;
    this.applyDiagnosticPresentation(item, group.id, "folder");
    const scheduledGroup = this.scheduledModel?.groups.find(
      (candidate) => candidate.id === group.id,
    );
    if (scheduledGroup) {
      item.description = vscode.l10n.t(
        "{0} ({1}d)",
        this.formatDateRange(scheduledGroup.effectiveStart, scheduledGroup.effectiveEnd),
        scheduledGroup.effectiveDuration,
      );
    }
    return item;
  }

  private taskItem(task: Task): vscode.TreeItem {
    const item = new vscode.TreeItem(task.name, vscode.TreeItemCollapsibleState.None);
    const scheduledTask = this.scheduledModel?.tasks.find((candidate) => candidate.id === task.id);
    if (scheduledTask) {
      item.description = vscode.l10n.t(
        "{0} ({1}d)",
        this.formatDateRange(scheduledTask.effectiveStart(), scheduledTask.effectiveEnd()),
        scheduledTask.effectiveDuration(),
      );
    }
    item.contextValue = "ganttee.task";
    item.id = `task:${task.id}`;
    item.command = {
      command: "ganttee.editTask",
      title: vscode.l10n.t("Edit Task"),
      arguments: [{ kind: "task", id: task.id }],
    };

    this.applyDiagnosticPresentation(item, task.id, "checklist");

    return item;
  }

  private milestoneItem(milestone: Milestone): vscode.TreeItem {
    const item = new vscode.TreeItem(milestone.name, vscode.TreeItemCollapsibleState.None);
    const scheduledMilestone = this.scheduledModel?.milestones.find(
      (candidate) => candidate.id === milestone.id,
    );
    if (scheduledMilestone) {
      item.description = formatShortDate(scheduledMilestone.effectiveStart(), vscode.env.language);
    }
    item.contextValue = "ganttee.milestone";
    item.id = `milestone:${milestone.id}`;
    item.command = {
      command: "ganttee.editMilestone",
      title: vscode.l10n.t("Edit Milestone"),
      arguments: [{ kind: "milestone", id: milestone.id }],
    };

    this.applyDiagnosticPresentation(item, milestone.id, "milestone");

    return item;
  }

  /** Returns the current host-computed schedule. */
  private get scheduledModel(): ProjectSchedule | undefined {
    return this.store.active?.scheduledModel;
  }

  /** Formats a pair of effective dates for a tree item description. */
  private formatDateRange(start: Date, end: Date): string {
    return vscode.l10n.t(
      "{0} → {1}",
      formatShortDate(start, vscode.env.language),
      formatShortDate(end, vscode.env.language),
    );
  }

  /** Colors the item-type icon by diagnostic severity and sets the tooltip; the icon identity is never replaced. */
  private applyDiagnosticPresentation(
    item: vscode.TreeItem,
    entityId: string,
    iconId: string,
  ): void {
    const diagnostics = diagnosticsFor(this.getDiagnostics(), entityId);
    if (diagnostics.length === 0) {
      item.iconPath = new vscode.ThemeIcon(iconId, new vscode.ThemeColor("charts.blue"));
      return;
    }
    item.tooltip = diagnostics
      .map((diagnostic) => describeDiagnostic(diagnostic, entityId))
      .join("\n");
    const hasBlockingDiagnostic = diagnostics.some(
      (diagnostic) => diagnostic.severity === "blocking",
    );
    item.iconPath = new vscode.ThemeIcon(
      iconId,
      new vscode.ThemeColor(
        hasBlockingDiagnostic ? "list.errorForeground" : "list.warningForeground",
      ),
    );
  }

  /** Filters nodes while retaining groups needed to reach matching descendants. */
  private filterNodes(nodes: readonly GanttNode[], model: ProjectDocument): GanttNode[] {
    if (this.searchTerm.length === 0) {
      return [...nodes];
    }
    const matchingIds = filterProjectItemIds(model, this.searchTerm);
    return nodes.filter((node) => {
      const entityId = entityRefOf(node)?.id;
      if (entityId !== undefined && matchingIds.has(entityId)) {
        return true;
      }
      return node.kind === "group" && hasMatchingDescendant(model, node.group.id, matchingIds);
    });
  }
}

function hasMatchingDescendant(
  model: ProjectDocument,
  groupId: string,
  matchingIds: ReadonlySet<string>,
): boolean {
  return (
    model.tasks.some((task) => task.groupId === groupId && matchingIds.has(task.id)) ||
    model.milestones.some(
      (milestone) => milestone.groupId === groupId && matchingIds.has(milestone.id),
    ) ||
    model.groups.some(
      (group) =>
        group.groupId === groupId &&
        (matchingIds.has(group.id) || hasMatchingDescendant(model, group.id, matchingIds)),
    )
  );
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
