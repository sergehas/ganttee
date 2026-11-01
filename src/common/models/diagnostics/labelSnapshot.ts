import { DEPENDENCY_TYPES, DependencyType, ProjectContent } from "@common/documents";
import {
  DependencyLabelEntry,
  LabelEntry,
  LabelSnapshot,
} from "@common/models/diagnostics/gantteeFinding";

/**
 * Captures the presentation labels of a project revision, draft, or proposal.
 *
 * The snapshot keeps authored names, authored collection indices, and owning
 * groups so findings can be labeled even after the source document changes.
 *
 * @param content The project content to capture.
 * @returns A serializable label context.
 */
export function labelSnapshotOf(content: Partial<ProjectContent>): LabelSnapshot {
  const items: LabelEntry[] = [
    ...(content.tasks ?? []).map((task, index): LabelEntry => ({
      kind: "task",
      id: task.id,
      name: task.name,
      index,
      groupId: task.groupId,
    })),
    ...(content.milestones ?? []).map((milestone, index): LabelEntry => ({
      kind: "milestone",
      id: milestone.id,
      name: milestone.name,
      index,
      groupId: milestone.groupId,
    })),
    ...(content.groups ?? []).map((group, index): LabelEntry => ({
      kind: "group",
      id: group.id,
      name: group.name,
      index,
      groupId: group.groupId,
    })),
    ...(content.settings?.statuses ?? []).map((status, index): LabelEntry => ({
      kind: "status",
      id: status.id,
      name: status.name,
      index,
    })),
  ];
  const dependencies = (content.dependencies ?? []).map(
    (dependency, index): DependencyLabelEntry => ({
      id: dependency.id,
      sourceId: dependency.sourceId,
      targetId: dependency.targetId,
      type: dependency.type,
      index,
    }),
  );
  return { items, dependencies };
}

/**
 * Captures labels from an unvalidated, migrated payload. Records that are not
 * objects are skipped; malformed ids and names are omitted so subjects fall
 * back to index lookup and unnamed descriptors instead of raw values.
 *
 * @param raw The migrated JSON payload.
 * @returns A serializable label context with authored indices.
 */
export function labelSnapshotOfRaw(raw: unknown): LabelSnapshot {
  if (!isRecord(raw)) {
    return { items: [], dependencies: [] };
  }
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const items: LabelEntry[] = [
    ...rawItems(raw.tasks, "task"),
    ...rawItems(raw.milestones, "milestone"),
    ...rawItems(raw.groups, "group"),
    ...rawItems(settings.statuses, "status"),
  ];
  const dependencies: DependencyLabelEntry[] = [];
  recordsOf(raw.dependencies).forEach(([entry, index]) => {
    dependencies.push({
      id: textOf(entry.id) ?? "",
      sourceId: textOf(entry.sourceId) ?? "",
      targetId: textOf(entry.targetId) ?? "",
      type: (DEPENDENCY_TYPES as readonly unknown[]).includes(entry.type)
        ? (entry.type as DependencyType)
        : undefined,
      index,
    });
  });
  return { items, dependencies };
}

/** Reads label entries of one raw collection. */
function rawItems(value: unknown, kind: LabelEntry["kind"]): LabelEntry[] {
  return recordsOf(value).map(([entry, index]) => ({
    kind,
    id: textOf(entry.id) ?? "",
    name: textOf(entry.name),
    index,
    groupId: kind === "status" ? undefined : textOf(entry.groupId),
  }));
}

/** Returns the object records of a raw array with their authored indices. */
function recordsOf(value: unknown): [Record<string, unknown>, number][] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index): [Record<string, unknown>, number][] =>
    isRecord(entry) ? [[entry, index]] : [],
  );
}

/** Returns a value when it is a non-empty string. */
function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Returns whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges label contexts; entries from `primary` win when the same kind and id
 * appear in both, so draft labels override backing document labels.
 *
 * @param primary Preferred labels (for example a draft or proposal).
 * @param fallback Labels used for subjects absent from `primary`.
 * @returns The merged label context.
 */
export function mergeLabelSnapshots(
  primary: LabelSnapshot,
  fallback: LabelSnapshot,
): LabelSnapshot {
  const itemKeys = new Set(primary.items.map((item) => `${item.kind}:${item.id}`));
  const dependencyIds = new Set(primary.dependencies.map((dependency) => dependency.id));
  return {
    items: [
      ...primary.items,
      ...fallback.items.filter((item) => !itemKeys.has(`${item.kind}:${item.id}`)),
    ],
    dependencies: [
      ...primary.dependencies,
      ...fallback.dependencies.filter((dependency) => !dependencyIds.has(dependency.id)),
    ],
  };
}
