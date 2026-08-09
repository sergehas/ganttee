import {
  Dependency,
  DependencyType,
  GanttDocument,
  TaskStatus,
} from "../../../common/models";
import { EditableEntityKind } from "../../../common/protocol";

/** Selectable status values for the task status dropdown. */
export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "inProgress", label: "In Progress" },
  { value: "done", label: "Done" },
];

/** Selectable dependency type values for the dependency type dropdown. */
export const DEPENDENCY_OPTIONS: { value: DependencyType; label: string }[] = [
  { value: "startAfter", label: "Start After" },
  { value: "startWith", label: "Start With" },
  { value: "endBefore", label: "End Before" },
  { value: "endWith", label: "End With" },
];

/** Maps an entity kind to the corresponding form heading text. */
export function titleOf(kind: EditableEntityKind): string {
  switch (kind) {
    case "task":
      return "Edit Task";
    case "milestone":
      return "Edit Milestone";
    case "group":
      return "Edit Group";
  }
}

/** Returns a human-readable dependency label in the form "Source -> Type -> Target". */
export function describeDependency(
  dep: Dependency,
  document: GanttDocument,
): string {
  const source = findEntityName(document, dep.sourceId);
  const target = findEntityName(document, dep.targetId);
  const label = DEPENDENCY_OPTIONS.find(
    (option) => option.value === dep.type,
  )?.label;
  return `${source} -> ${label ?? dep.type} -> ${target}`;
}

/** Resolves a task or milestone ID to its display name, returning "?" when not found. */
export function findEntityName(document: GanttDocument, id: string): string {
  return findEntityRefById(document, id)?.name ?? "?";
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
