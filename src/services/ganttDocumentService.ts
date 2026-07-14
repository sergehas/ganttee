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

/** Raised when a `.ganttee` document cannot be parsed or is structurally invalid. */
export class GanttParseError extends Error {}

const TASK_STATUSES: readonly TaskStatus[] = ["todo", "inProgress", "done"];
const DEPENDENCY_TYPES: readonly DependencyType[] = [
  "startAfter",
  "startWith",
  "finishAfter",
  "finishWith",
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

  return migrate(validate(raw));
}

/** Serializes a document to pretty-printed JSON suitable for on-disk storage. */
export function serializeDocument(document: GanttDocument): string {
  return `${JSON.stringify(document, undefined, 2)}\n`;
}

function migrate(document: GanttDocument): GanttDocument {
  // Only v1 exists today. Future versions transform older shapes here before
  // stamping the current version.
  return { ...document, version: CURRENT_DOCUMENT_VERSION };
}

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

function validateTask(raw: unknown, index: number): Task {
  if (!isRecord(raw)) {
    throw new GanttParseError(`tasks[${index}] must be an object.`);
  }
  const task: Task = {
    id: requireString(raw.id, `tasks[${index}].id`),
    title: requireString(raw.title, `tasks[${index}].title`),
    start: requireDate(raw.start, `tasks[${index}].start`),
    end: requireDate(raw.end, `tasks[${index}].end`),
  };
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

function validateGroup(raw: unknown, index: number): Group {
  if (!isRecord(raw)) {
    throw new GanttParseError(`groups[${index}] must be an object.`);
  }
  const group: Group = {
    id: requireString(raw.id, `groups[${index}].id`),
    name: requireString(raw.name, `groups[${index}].name`),
  };
  if (raw.parentId !== undefined) {
    group.parentId = requireString(raw.parentId, `groups[${index}].parentId`);
  }
  if (typeof raw.collapsed === "boolean") {
    group.collapsed = raw.collapsed;
  }
  return group;
}

function validateMilestone(raw: unknown, index: number): Milestone {
  if (!isRecord(raw)) {
    throw new GanttParseError(`milestones[${index}] must be an object.`);
  }
  const milestone: Milestone = {
    id: requireString(raw.id, `milestones[${index}].id`),
    title: requireString(raw.title, `milestones[${index}].title`),
    date: requireDate(raw.date, `milestones[${index}].date`),
  };
  if (raw.groupId !== undefined) {
    milestone.groupId = requireString(
      raw.groupId,
      `milestones[${index}].groupId`,
    );
  }
  return milestone;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, field: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new GanttParseError(`${field} must be an array.`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new GanttParseError(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireDate(value: unknown, field: string): string {
  const date = requireString(value, field);
  if (!ISO_DATE.test(date)) {
    throw new GanttParseError(`${field} must be an ISO date (YYYY-MM-DD).`);
  }
  return date;
}

function clampProgress(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus)
  );
}

function isDependencyType(value: unknown): value is DependencyType {
  return (
    typeof value === "string" &&
    DEPENDENCY_TYPES.includes(value as DependencyType)
  );
}
