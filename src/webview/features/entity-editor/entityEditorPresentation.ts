import { Dependency, DependencyType, ProjectDocument, TaskStatus } from "@common/documents";
import { formatShortDate } from "@common/datePresentation";
import { parseIsoDate } from "@common/dates";
import { EditableEntityKind } from "@common/protocol";
import {
  validateMilestoneConstraints,
  validateTaskConstraints,
} from "@services/schedule/scheduleConstraintService";

/** Resolves English source messages for form presentation. */
type WebviewTranslator = (source: string, ...values: unknown[]) => string;

/** Selectable status values for the task status dropdown. */
export const STATUS_OPTIONS: readonly TaskStatus[] = ["todo", "inProgress", "done"];

/** Selectable dependency type values for the dependency type dropdown. */
export const DEPENDENCY_OPTIONS: readonly DependencyType[] = ["startAfter", "startWith", "endWith"];

/** Resolves a task status to its localization source message. */
export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "inProgress":
      return "In Progress";
    case "done":
      return "Done";
  }
}

/** Resolves a dependency type to its localization source message. */
export function dependencyTypeLabel(type: DependencyType): string {
  switch (type) {
    case "startAfter":
      return "Start After";
    case "startWith":
      return "Start With";
    case "endWith":
      return "End With";
    default:
      return type;
  }
}

/** Resolves an owned entity kind to its localization source message. */
export function entityKindLabel(kind: "task" | "milestone" | "group"): string {
  switch (kind) {
    case "task":
      return "Task";
    case "milestone":
      return "Milestone";
    case "group":
      return "Group";
  }
}

/** Formats an optional group schedule ISO date for display. */
export function displayGroupDate(date: string | undefined, locale: string): string {
  return date === undefined ? "" : formatShortDate(parseIsoDate(date), locale);
}

/** Describes one validation message before localization. */
export interface EntityEditorValidationMessage {
  /** Visual severity for the message. */
  readonly severity: "warning" | "error";
  /** Localization source message. */
  readonly source: string;
  /** Values interpolated into the localized message. */
  readonly values?: readonly unknown[];
}

/** Builds localized-message inputs for task constraint validation. */
export function taskValidationMessages(
  validation: ReturnType<typeof validateTaskConstraints>,
): readonly EntityEditorValidationMessage[] {
  const messages: EntityEditorValidationMessage[] = [];
  if (validation.blocking) {
    messages.push({
      severity: "error",
      source: "Task has {0} constraint(s); exactly 2 are needed to schedule.",
      values: [validation.count],
    });
  }
  if (validation.duplicateStart || validation.duplicateEnd) {
    messages.push({
      severity: "warning",
      source:
        validation.duplicateStart && validation.duplicateEnd
          ? "Task has duplicate start and end constraints."
          : validation.duplicateStart
            ? "Task has duplicate start constraints."
            : "Task has duplicate end constraints.",
    });
  }
  return messages;
}

/** Builds localized-message inputs for milestone constraint validation. */
export function milestoneValidationMessages(
  validation: ReturnType<typeof validateMilestoneConstraints>,
): readonly EntityEditorValidationMessage[] {
  const messages: EntityEditorValidationMessage[] = [];
  if (validation.blocking) {
    messages.push({
      severity: "error",
      source: "Milestone needs a date or an outgoing dependency.",
    });
  }
  if (validation.overConstrained) {
    messages.push({
      severity: "warning",
      source: "Milestone has a duplicate date constraint.",
    });
  }
  return messages;
}

/** Maps an entity kind to the corresponding form heading text. */
export function titleOf(kind: EditableEntityKind, t: WebviewTranslator): string {
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
  document: ProjectDocument,
  t: WebviewTranslator,
): string {
  const source = findEntityName(document, dep.sourceId, t);
  const target = findEntityName(document, dep.targetId, t);
  const label = t(dependencyTypeLabel(dep.type));
  return t("{0} → {1} → {2}", source, label, target);
}

/** Resolves a task or milestone ID to its display name, returning "?" when not found. */
export function findEntityName(
  document: ProjectDocument,
  id: string,
  t: WebviewTranslator,
): string {
  return findEntityRefById(document, id)?.name ?? t("?");
}

/**
 * Finds a task or milestone by ID and returns a typed ref with its name.
 *
 * @returns `undefined` when no matching entity exists.
 */
export function findEntityRefById(
  document: ProjectDocument,
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
