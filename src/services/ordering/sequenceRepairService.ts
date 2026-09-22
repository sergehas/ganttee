/**
 * Load-time repair of root and group `sequence` arrays, run before shape and
 * relation validation.
 *
 * Root and group sequences persist one mixed-kind direct-child order. Older
 * or hand-edited documents can have a missing, stale, duplicate, or
 * incomplete sequence; this pass derives a valid one from ownership
 * (`groupId`) so the document self-heals without a schema version bump.
 * Ownership itself is never changed here — a missing parent or a group cycle
 * is still rejected by relation validation afterward.
 */

/**
 * Repairs the root sequence and every group's sequence in a raw, migrated
 * document record. Idempotent: repairing an already-valid document returns
 * the same order.
 *
 * @param raw The migrated but not yet shape-validated document record.
 */
export function repairSequences(raw: Record<string, unknown>): Record<string, unknown> {
  const groups = asRecordArray(raw.groups);
  const tasks = asRecordArray(raw.tasks);
  const milestones = asRecordArray(raw.milestones);
  const groupIds = groups.map((group) => group.id).filter(isString);

  const childrenByOwner = new Map<string | undefined, string[]>();
  for (const ownerId of [undefined, ...groupIds]) {
    childrenByOwner.set(ownerId, fallbackChildren(ownerId, groups, tasks, milestones));
  }

  const repairedGroups = groups.map((group) => {
    if (!isString(group.id)) {
      return group;
    }
    return {
      ...group,
      sequence: repairOneSequence(group.sequence, childrenByOwner.get(group.id) ?? []),
    };
  });

  return {
    ...raw,
    groups: repairedGroups,
    sequence: repairOneSequence(raw.sequence, childrenByOwner.get(undefined) ?? []),
  };
}

/** Direct children of one owner, in groups-then-tasks-then-milestones fallback order. */
function fallbackChildren(
  ownerId: string | undefined,
  groups: readonly Record<string, unknown>[],
  tasks: readonly Record<string, unknown>[],
  milestones: readonly Record<string, unknown>[],
): string[] {
  const owned = (entries: readonly Record<string, unknown>[]): string[] =>
    entries
      .filter((entry) => normalizedOwner(entry.groupId) === ownerId)
      .map((entry) => entry.id)
      .filter(isString);
  return [...owned(groups), ...owned(tasks), ...owned(milestones)];
}

function normalizedOwner(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

/**
 * Repairs one owner's sequence: keeps the first valid occurrence of each
 * stored id in its stored relative order, drops ids that are not a direct
 * child (foreign, nested, dangling) or a repeat, then appends any direct
 * child missing from the stored sequence using the fallback order.
 */
function repairOneSequence(existing: unknown, directChildren: readonly string[]): string[] {
  const validChildren = new Set(directChildren);
  const seen = new Set<string>();
  const kept: string[] = [];
  if (Array.isArray(existing)) {
    for (const entry of existing) {
      if (typeof entry === "string" && validChildren.has(entry) && !seen.has(entry)) {
        kept.push(entry);
        seen.add(entry);
      }
    }
  }
  for (const id of directChildren) {
    if (!seen.has(id)) {
      kept.push(id);
      seen.add(id);
    }
  }
  return kept;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
