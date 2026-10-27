import { formatShortDate, parseIsoDate } from "@common/dates";
import {
  DEPENDENCY_TYPES,
  DependencyType,
  PROJECT_ITEM_STATES,
  ProjectContent,
  ProjectItemState,
  ProjectItemType,
} from "@common/documents";
import { DeterminacyDiagnostic } from "@common/models";
import { EditableEntityKind } from "@common/protocol";

/** Resolves English source messages for form presentation. */
type WebviewTranslator = (source: string, ...values: unknown[]) => string;

/** Selectable lifecycle states for the task state dropdown. */
export const STATE_OPTIONS: readonly ProjectItemState[] = PROJECT_ITEM_STATES;

/** Selectable dependency type values for the dependency type dropdown. */
export const DEPENDENCY_OPTIONS: readonly DependencyType[] = DEPENDENCY_TYPES;

/** Resolves a task state to its localization source message. */
export function ProjectItemStateLabel(status: ProjectItemState): string {
  switch (status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
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

/** Resolves an owned entity kind to the codicon used for it in the host treeview. */
export function entityKindIcon(kind: ProjectItemType): string {
  switch (kind) {
    case "task":
      return "checklist";
    case "milestone":
      return "milestone";
    case "group":
      return "folder";
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
  diagnostic: DeterminacyDiagnostic | undefined,
): readonly EntityEditorValidationMessage[] {
  if (diagnostic === undefined) {
    return [];
  }
  const messages: EntityEditorValidationMessage[] = [];
  if (diagnostic.severity === "blocking") {
    messages.push({
      severity: "error",
      source: "Task has {0} constraint(s); exactly 2 are needed to schedule.",
      values: [diagnostic.count],
    });
  }
  if (diagnostic.kind === "overConstrained" && diagnostic.duplicateEndpoints.length > 0) {
    const hasStart = diagnostic.duplicateEndpoints.includes("start");
    const hasEnd = diagnostic.duplicateEndpoints.includes("end");
    messages.push({
      severity: "warning",
      source:
        hasStart && hasEnd
          ? "Task has duplicate start and end constraints."
          : hasStart
            ? "Task has duplicate start constraints."
            : "Task has duplicate end constraints.",
    });
  }
  return messages;
}

/** Builds localized-message inputs for milestone constraint validation. */
export function milestoneValidationMessages(
  diagnostic: DeterminacyDiagnostic | undefined,
): readonly EntityEditorValidationMessage[] {
  if (diagnostic === undefined) {
    return [];
  }
  const messages: EntityEditorValidationMessage[] = [];
  if (diagnostic.severity === "blocking") {
    messages.push({
      severity: "error",
      source: "Milestone needs a date or an outgoing dependency.",
    });
  }
  if (diagnostic.kind === "overConstrained") {
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

/** Resolves a task or milestone ID to its display name, returning "?" when not found. */
export function findEntityName(
  projectDoc: ProjectContent,
  id: string,
  t: WebviewTranslator,
): string {
  return findEntityRefById(projectDoc, id)?.name ?? t("?");
}

/**
 * Finds a task or milestone by ID and returns a typed ref with its name.
 *
 * @returns `undefined` when no matching entity exists.
 */
export function findEntityRefById(
  projectDoc: ProjectContent,
  id: string,
): { id: string; kind: Exclude<ProjectItemType, "group">; name: string } | undefined {
  const task = projectDoc.tasks.find((item) => item.id === id);
  if (task) {
    return { id: task.id, kind: "task", name: task.name };
  }
  const milestone = projectDoc.milestones.find((item) => item.id === id);
  if (milestone) {
    return { id: milestone.id, kind: "milestone", name: milestone.name };
  }
  return undefined;
}
