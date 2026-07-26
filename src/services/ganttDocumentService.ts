import {
  createEmptyDocument,
  CURRENT_DOCUMENT_VERSION,
  Dependency,
  DependencyType,
  GanttDocument,
  Group,
  Milestone,
  Task,
  TaskStatus,
} from "../common/models";
import { migrateDocument } from "./ganttDocumentMigrationService";

/** Raised when a `.ganttee` document cannot be parsed or is structurally invalid. */
export class GanttParseError extends Error {}

const TASK_STATUSES: readonly TaskStatus[] = ["todo", "inProgress", "done"];
const DEPENDENCY_TYPES: readonly DependencyType[] = [
  "startAfter",
  "startWith",
  "endWith",
  "endBefore",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses raw file text into a validated {@link GanttDocument}, applying schema
 * migrations for older versions. Empty input yields an empty document.
 */
export function parseDocument(text: string): GanttDocument {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return createEmptyDocument();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    throw new GanttParseError(
      `Invalid JSON in .ganttee file: ${(error as Error).message}`,
    );
  }

  return validate(migrateDocument(raw));
}

/** Serializes a document to pretty-printed JSON suitable for on-disk storage. */
export function serializeDocument(document: GanttDocument): string {
  return `${JSON.stringify(document, undefined, 2)}\n`;
}

/**
 * Validates a parsed document payload and normalizes optional collections.
 */
function validate(raw: unknown): GanttDocument {
  if (!isRecord(raw)) {
    throw new GanttParseError("Document root must be an object.");
  }

  return {
    version:
      typeof raw.version === "number" ? raw.version : CURRENT_DOCUMENT_VERSION,
    tasks: asArray(raw.tasks, "tasks").map(validateTask),
    groups: asArray(raw.groups, "groups").map(validateGroup),
    milestones: asArray(raw.milestones, "milestones").map(validateMilestone),
    dependencies: asArray(raw.dependencies, "dependencies").map(
      validateDependency,
    ),
  };
}

/**
 * Validates and normalizes a task entry.
 */
function validateTask(raw: unknown, index: number): Task {
  if (!isRecord(raw)) {
    throw new GanttParseError(`tasks[${index}] must be an object.`);
  }
  const task: Task = {
    id: requireString(raw.id, `tasks[${index}].id`),
    name: requireString(raw.name, `tasks[${index}].name`),
  };
  if (raw.start !== undefined) {
    task.start = requireDate(raw.start, `tasks[${index}].start`);
  }
  if (raw.end !== undefined) {
    task.end = requireDate(raw.end, `tasks[${index}].end`);
  }
  if (raw.duration !== undefined) {
    task.duration = requireNonNegativeNumber(
      raw.duration,
      `tasks[${index}].duration`,
    );
  }
  if (raw.description !== undefined) {
    task.description = requireString(
      raw.description,
      `tasks[${index}].description`,
    );
  }
  if (raw.progress !== undefined) {
    task.progress = clampProgress(raw.progress);
  }
  if (raw.status !== undefined && isTaskStatus(raw.status)) {
    task.status = raw.status;
  }
  if (raw.groupId !== undefined) {
    task.groupId = requireString(raw.groupId, `tasks[${index}].groupId`);
  }
  return task;
}

/**
 * Validates and normalizes a group entry.
 */
function validateGroup(raw: unknown, index: number): Group {
  if (!isRecord(raw)) {
    throw new GanttParseError(`groups[${index}] must be an object.`);
  }
  const group: Group = {
    id: requireString(raw.id, `groups[${index}].id`),
    name: requireString(raw.name, `groups[${index}].name`),
  };
  if (raw.groupId !== undefined) {
    group.groupId = requireString(raw.groupId, `groups[${index}].groupId`);
  }
  if (typeof raw.collapsed === "boolean") {
    group.collapsed = raw.collapsed;
  }
  return group;
}

/**
 * Validates and normalizes a milestone entry.
 */
function validateMilestone(raw: unknown, index: number): Milestone {
  if (!isRecord(raw)) {
    throw new GanttParseError(`milestones[${index}] must be an object.`);
  }
  const milestone: Milestone = {
    id: requireString(raw.id, `milestones[${index}].id`),
    name: requireString(raw.name, `milestones[${index}].name`),
    date: requireDate(raw.date, `milestones[${index}].date`),
  };
  if (raw.duration !== undefined && raw.duration !== 0) {
    throw new GanttParseError(
      `milestones[${index}].duration must be 0; milestones are zero-duration.`,
    );
  }
  if (raw.groupId !== undefined) {
    milestone.groupId = requireString(
      raw.groupId,
      `milestones[${index}].groupId`,
    );
  }
  return milestone;
}

/**
 * Validates and normalizes a dependency entry.
 */
function validateDependency(raw: unknown, index: number): Dependency {
  if (!isRecord(raw)) {
    throw new GanttParseError(`dependencies[${index}] must be an object.`);
  }
  const type = raw.type;
  if (!isDependencyType(type)) {
    throw new GanttParseError(`dependencies[${index}].type is invalid.`);
  }
  return {
    id: requireString(raw.id, `dependencies[${index}].id`),
    sourceId: requireString(raw.sourceId, `dependencies[${index}].sourceId`),
    targetId: requireString(raw.targetId, `dependencies[${index}].targetId`),
    type,
  };
}

/**
 * Returns whether the input is a plain object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the input as an array or throws for invalid collection fields.
 */
function asArray(value: unknown, field: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new GanttParseError(`${field} must be an array.`);
  }
  return value;
}

/**
 * Requires a non-empty string field.
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new GanttParseError(`${field} must be a non-empty string.`);
  }
  return value;
}

/**
 * Requires an ISO date string in YYYY-MM-DD form.
 */
function requireDate(value: unknown, field: string): string {
  const date = requireString(value, field);
  if (!ISO_DATE.test(date)) {
    throw new GanttParseError(`${field} must be an ISO date (YYYY-MM-DD).`);
  }
  return date;
}

/**
 * Requires a finite, non-negative number field.
 */
function requireNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new GanttParseError(`${field} must be a non-negative number.`);
  }
  return value;
}

/**
 * Clamps task progress into the supported inclusive range.
 */
function clampProgress(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Returns whether the value is a supported task status.
 */
function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus)
  );
}

/**
 * Returns whether the value is a supported dependency type.
 */
function isDependencyType(value: unknown): value is DependencyType {
  return (
    typeof value === "string" &&
    DEPENDENCY_TYPES.includes(value as DependencyType)
  );
}
