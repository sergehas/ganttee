import {
  Dependency,
  DependencyType,
  GanttDocument,
  TaskStatus,
} from "../../../common/models";
import { EditableEntityKind } from "../../../common/protocol";

/** Resolves English source messages for form presentation. */
type WebviewTranslator = (source: string, ...values: unknown[]) => string;

/** Selectable status values for the task status dropdown. */
export const STATUS_OPTIONS: readonly TaskStatus[] = [
  "todo",
  "inProgress",
  "done",
];

/** Selectable dependency type values for the dependency type dropdown. */
export const DEPENDENCY_OPTIONS: readonly DependencyType[] = [
  "startAfter",
  "startWith",
  "endWith",
];

/** Maps an entity kind to the corresponding form heading text. */
export function titleOf(
  kind: EditableEntityKind,
  t: WebviewTranslator,
): string {
  switch (kind) {
    case "task":
      return t("Edit Task");
    case "milestone":
      return t("Edit Milestone");
    case "group":
      return t("Edit Group");
  }
}

/** Returns a human-readable dependency label in the form "Source → Type → Target". */
export function describeDependency(
  dep: Dependency,
  document: GanttDocument,
  t: WebviewTranslator,
): string {
  const source = findEntityName(document, dep.sourceId, t);
  const target = findEntityName(document, dep.targetId, t);
  const label = dependencyTypeLabel(dep.type, t);
  return t("{0} → {1} → {2}", source, label, target);
}

/** Resolves a task or milestone ID to its display name, returning "?" when not found. */
export function findEntityName(
  document: GanttDocument,
  id: string,
  t: WebviewTranslator,
): string {
  return findEntityRefById(document, id)?.name ?? t("?");
}

/** Resolves a dependency type to its localized display label. */
function dependencyTypeLabel(
  type: DependencyType,
  t: WebviewTranslator,
): string {
  switch (type) {
    case "startAfter":
      return t("Start After");
    case "startWith":
      return t("Start With");
    case "endWith":
      return t("End With");
    default:
      return type;
  }
}

/**
 * Finds a task or milestone by ID and returns a typed ref with its name.
 *
 * @returns `undefined` when no matching entity exists.
 */
export function findEntityRefById(
  document: GanttDocument,
  id: string,
): { id: string; kind: "task" | "milestone"; name: string } | undefined {
  const task = document.tasks.find((item) => item.id === id);
  if (task) {
    return { id: task.id, kind: "task", name: task.name };
  }
  const milestone = document.milestones.find((item) => item.id === id);
  if (milestone) {
    return { id: milestone.id, kind: "milestone", name: milestone.name };
  }
  return undefined;
}
