/** A named chart entity. */
interface NamedEntity {
  /** Stable identifier. */
  readonly id: string;
  /** Row label. */
  readonly name: string;
}

/** Project shape needed to order chart rows. */
export interface ChartRowSource {
  /** Tasks shown as rows. */
  readonly tasks: readonly NamedEntity[];
  /** Milestones shown as rows. */
  readonly milestones: readonly NamedEntity[];
  /** Groups shown as rows, with their own child sequence. */
  readonly groups: readonly (NamedEntity & { readonly sequence?: readonly string[] })[];
  /** Root-level row order. */
  readonly sequence?: readonly string[];
}

/** One chart row. */
export interface ChartRow {
  /** Entity identifier. */
  readonly id: string;
  /** Label shown on the Y axis or next to the item. */
  readonly label: string;
}

/**
 * Flattens the authored sequence (root, then each group's own sequence) into row order and
 * omits the descendants of collapsed groups.
 * @param project Project entities and sequences.
 * @param collapsedGroupIds Groups whose descendants are hidden.
 * @returns The visible rows in display order.
 */
export function buildChartRows(
  project: ChartRowSource,
  collapsedGroupIds: ReadonlySet<string>,
): ChartRow[] {
  const byId = new Map<string, ChartRow>(
    [...project.tasks, ...project.milestones, ...project.groups].map((entity) => [
      entity.id,
      { id: entity.id, label: entity.name },
    ]),
  );
  const groupsById = new Map(project.groups.map((group) => [group.id, group]));
  const rows: ChartRow[] = [];
  const visit = (sequence: readonly string[]) => {
    for (const id of sequence) {
      const row = byId.get(id);
      if (row) {
        rows.push(row);
      }
      const group = groupsById.get(id);
      if (group && !collapsedGroupIds.has(id)) {
        visit(group.sequence ?? []);
      }
    }
  };
  visit(project.sequence ?? []);
  return rows;
}

/**
 * Toggles one group's collapse state without mutating the input.
 * @param collapsedGroupIds Currently collapsed groups.
 * @param groupId Group to toggle.
 * @returns The next collapsed groups.
 */
export function toggleCollapsedGroup(
  collapsedGroupIds: ReadonlySet<string>,
  groupId: string,
): ReadonlySet<string> {
  const next = new Set(collapsedGroupIds);
  if (!next.delete(groupId)) {
    next.add(groupId);
  }
  return next;
}
