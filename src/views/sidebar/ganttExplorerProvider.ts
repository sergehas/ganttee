import { formatShortDate } from "@common/dates";
import {
  ProjectGroupSnapshot,
  ProjectMilestoneSnapshot,
  ProjectModel,
  ProjectSnapshot,
  ProjectTaskSnapshot,
} from "@common/models";
import { EditableEntityRef } from "@common/protocol";
import {
  diagnosticsFor,
  ScheduleDiagnostic,
} from "@services/schedule/scheduleGraphValidationService";
import { filterProjectItemIds } from "@services/sidebar/treeItemFilterService";
import { GanttStore } from "@src/ganttStore";
import { describeDiagnostic } from "@views/scheduleDiagnosticPresenter";
import * as vscode from "vscode";

type GanttNode = ProjectGroupSnapshot | ProjectTaskSnapshot | ProjectMilestoneSnapshot;

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
        return this.groupItem(node);
      case "task":
        return this.taskItem(node);
      case "milestone":
        return this.milestoneItem(node);
    }
  }

  /**
   * Returns the diagnostics from the active editor, if any.
   */
  private getDiagnostics(): readonly ScheduleDiagnostic[] {
    return this.store.active?.snapshot.diagnostics ?? [];
  }

  getChildren(element?: GanttNode): GanttNode[] {
    const snapshot = this.store.active?.snapshot;
    if (!snapshot) {
      return [];
    }

    if (!element) {
      return this.filterNodes(this.childNodes(snapshot), snapshot.model);
    }

    if (element.kind === "group") {
      return this.filterNodes(this.childNodes(snapshot, element.item.id), snapshot.model);
    }

    return [];
  }

  /** Collects the direct children of a group, or the root-level items when no group is provided. */
  private childNodes(snapshot: ProjectSnapshot, groupId?: string): GanttNode[] {
    const childGroups = snapshot.groups.filter(({ item }) =>
      groupId === undefined ? !item.groupId : item.groupId === groupId,
    );
    const tasks = snapshot.tasks.filter(({ item }) =>
      groupId === undefined ? !item.groupId : item.groupId === groupId,
    );
    const milestones = snapshot.milestones.filter(({ item }) =>
      groupId === undefined ? !item.groupId : item.groupId === groupId,
    );

    return [...childGroups, ...tasks, ...milestones];
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
      target?.kind === "group" ? target.item.id : undefined,
    );
  }

  private groupItem(snapshot: ProjectGroupSnapshot): vscode.TreeItem {
    const group = snapshot.item;
    const item = new vscode.TreeItem(group.name, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = "ganttee.group";
    item.id = `group:${group.id}`;
    item.command = {
      command: "ganttee.editProjectItem",
      title: vscode.l10n.t("Edit Item"),
      arguments: [{ kind: "group", id: group.id }],
    };
    if (snapshot.effective) {
      item.description = vscode.l10n.t(
        "{0} ({1}d)",
        this.formatDateRange(snapshot.effective.start, snapshot.effective.end),
        snapshot.effective.duration,
      );
    }
    this.applyDiagnosticPresentation(item, group.id, "folder");
    return item;
  }

  private taskItem(snapshot: ProjectTaskSnapshot): vscode.TreeItem {
    const task = snapshot.item;
    const item = new vscode.TreeItem(task.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "ganttee.task";
    item.id = `task:${task.id}`;
    item.command = {
      command: "ganttee.editProjectItem",
      title: vscode.l10n.t("Edit Item"),
      arguments: [{ kind: "task", id: task.id }],
    };
    if (snapshot.effective) {
      item.description = vscode.l10n.t(
        "{0} ({1}d)",
        this.formatDateRange(snapshot.effective.start, snapshot.effective.end),
        snapshot.effective.duration,
      );
    }
    this.applyDiagnosticPresentation(item, task.id, "checklist");
    return item;
  }

  private milestoneItem(snapshot: ProjectMilestoneSnapshot): vscode.TreeItem {
    const milestone = snapshot.item;
    const item = new vscode.TreeItem(milestone.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "ganttee.milestone";
    item.id = `milestone:${milestone.id}`;
    item.command = {
      command: "ganttee.editProjectItem",
      title: vscode.l10n.t("Edit Item"),
      arguments: [{ kind: "milestone", id: milestone.id }],
    };
    if (snapshot.effective) {
      item.description = formatShortDate(snapshot.effective.start, vscode.env.language);
    }
    this.applyDiagnosticPresentation(item, milestone.id, "milestone");
    return item;
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
  private filterNodes(nodes: readonly GanttNode[], model: ProjectModel): GanttNode[] {
    if (this.searchTerm.length === 0) {
      return [...nodes];
    }
    const matchingIds = filterProjectItemIds(model, this.searchTerm);
    return nodes.filter((node) => {
      const entityId = entityRefOf(node)?.id;
      if (entityId !== undefined && matchingIds.has(entityId)) {
        return true;
      }
      return node.kind === "group" && hasMatchingDescendant(model, node.item.id, matchingIds);
    });
  }
}

function hasMatchingDescendant(
  model: ProjectModel,
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
      return { kind: "task", id: candidate.item.id };
    case "milestone":
      return { kind: "milestone", id: candidate.item.id };
    case "group":
      return { kind: "group", id: candidate.item.id };
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
