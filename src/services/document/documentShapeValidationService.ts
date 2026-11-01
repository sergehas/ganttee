/**
 * Coercion of untrusted JSON into the typed document shape.
 *
 * Everything here works on `unknown` because the input is whatever was on
 * disk. Cross-entity rules that need the whole document live in
 * `documentRelationValidationService`.
 *
 * Validation runs in one of two modes. The throwing mode stops at the first
 * problem, as the editor requires before it builds a model. The collecting
 * mode records every independently detectable problem as a structured
 * {@link GantteeFinding}, drops each invalid record, and keeps going, so the
 * Problems view can list them all.
 */

import { DateRange, parseIsoDate } from "@common/dates";
import {
  CURRENT_DOCUMENT_VERSION,
  DEFAULT_PROJECT_VIEW,
  Dependency,
  DEPENDENCY_TYPES,
  DependencyType,
  Group,
  Milestone,
  PROJECT_ITEM_STATES,
  PROJECT_STYLES,
  ProjectDocument,
  ProjectItem,
  ProjectItemState,
  ProjectSettings,
  ProjectStatus,
  ProjectView,
  resolveProjectSettings,
  resolveProjectView,
  Task,
  WorkingCalendar,
  ZOOM_LEVELS,
} from "@common/documents";
import {
  FieldExpectation,
  GantteeFinding,
  SourcePath,
  SubjectRef,
} from "@common/models/diagnostics";

/** Raised when a `.ganttee` document cannot be parsed or is structurally invalid. */
export class GanttParseError extends Error {
  /**
   * @param message English diagnostic text for logs; never shown to users.
   * @param findings Structured findings describing the problem.
   */
  constructor(
    message: string,
    readonly findings: readonly GantteeFinding[] = [],
  ) {
    super(message);
  }
}

/** A recognized view field whose invalid value was replaced by its default. */
export interface ViewDefaultWarning {
  /** The `view` property that held an invalid value. */
  readonly field: keyof ProjectView;
  /** The default value used instead. */
  readonly defaultValue: ProjectView[keyof ProjectView];
}

/** Receives a warning each time a view value is replaced by its default. */
export type ViewDefaultWarningListener = (warning: ViewDefaultWarning) => void;

/** Authored collections whose records are validated one by one. */
export type ShapeCollectionName =
  "tasks" | "groups" | "milestones" | "dependencies" | "statuses" | "holidays";

/** Areas that may be incomplete after collecting validation. */
export type ShapeArea = ShapeCollectionName | "sequence";

/** For each collection, the authored index of every kept record, in kept order. */
export type AuthoredIndexMap = Readonly<Record<ShapeCollectionName, readonly number[]>>;

/** Result of collecting shape validation. */
export interface DocumentShapeCollection {
  /** The coerced document without invalid records; absent when the root is invalid. */
  readonly document?: ProjectDocument;
  /** Every shape finding, in authored order. */
  readonly findings: readonly GantteeFinding[];
  /** Authored index of each kept record. */
  readonly authoredIndex: AuthoredIndexMap;
  /** Areas from which at least one value was dropped. */
  readonly incomplete: ReadonlySet<ShapeArea>;
}

/** Where a value lives and which subject owns it. */
interface FieldAt {
  /** Path into the migrated JSON. */
  readonly path: SourcePath;
  /** Subject the value belongs to. */
  readonly subject: SubjectRef;
}

/** Value checks for every recognized view property. */
const VIEW_FIELD_VALIDATORS: { readonly [K in keyof ProjectView]: (value: unknown) => boolean } = {
  zoomLevel: (value) => (ZOOM_LEVELS as readonly unknown[]).includes(value),
  showDependencies: isBoolean,
  showOffDays: isBoolean,
  showHolidays: isBoolean,
  showCriticalPath: isBoolean,
  style: (value) => (PROJECT_STYLES as readonly unknown[]).includes(value),
  theme: (value) => typeof value === "string" && value.trim().length > 0,
  showItemLabels: isBoolean,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PROJECT: SubjectRef = { kind: "project" };

/**
 * Coerces a parsed JSON payload into a document, normalizing optional
 * collections and dropping unknown settings keys.
 *
 * @param raw The payload read from disk.
 * @param onWarning Receives each view value replaced by its default.
 * @returns The typed document.
 * @throws {GanttParseError} When a field has the wrong shape.
 */
export function validateDocumentShape(
  raw: unknown,
  onWarning: ViewDefaultWarningListener = () => undefined,
): ProjectDocument {
  return new ShapeValidator(false, onWarning).document(raw);
}

/**
 * Coerces a parsed JSON payload into a document, recording every shape
 * problem as a finding and dropping each invalid record instead of stopping.
 *
 * @param raw The migrated payload.
 * @returns The coerced document, the findings, and what was dropped.
 */
export function collectDocumentShape(raw: unknown): DocumentShapeCollection {
  const validator = new ShapeValidator(true, () => undefined);
  if (!isRecord(raw)) {
    return {
      findings: [
        {
          category: "invalidRoot",
          severity: "error",
          origin: "document",
          subjects: [PROJECT],
          location: { path: [] },
        },
      ],
      authoredIndex: validator.authoredIndex,
      incomplete: validator.incomplete,
    };
  }
  const document = validator.document(raw);
  return {
    document,
    findings: validator.findings,
    authoredIndex: validator.authoredIndex,
    incomplete: validator.incomplete,
  };
}

/** Shape validation in throwing or collecting mode. */
class ShapeValidator {
  /** Findings recorded in collecting mode, plus view warnings. */
  readonly findings: GantteeFinding[] = [];
  /** Authored index of each kept record. */
  readonly authoredIndex: Record<ShapeCollectionName, number[]> = {
    tasks: [],
    groups: [],
    milestones: [],
    dependencies: [],
    statuses: [],
    holidays: [],
  };
  /** Areas from which a value was dropped. */
  readonly incomplete = new Set<ShapeArea>();

  /**
   * @param collecting Whether to record problems instead of throwing.
   * @param onWarning Receives each view value replaced by its default.
   */
  constructor(
    private readonly collecting: boolean,
    private readonly onWarning: ViewDefaultWarningListener,
  ) {}

  /** Validates the whole document. */
  document(raw: unknown): ProjectDocument {
    if (!isRecord(raw)) {
      throw new GanttParseError("Document root must be an object.");
    }
    return {
      version: typeof raw.version === "number" ? raw.version : CURRENT_DOCUMENT_VERSION,
      tasks: this.collection(raw.tasks, "tasks", ["tasks"], validateTask) ?? [],
      groups: this.collection(raw.groups, "groups", ["groups"], validateGroup) ?? [],
      milestones:
        this.collection(raw.milestones, "milestones", ["milestones"], validateMilestone) ?? [],
      dependencies:
        this.collection(raw.dependencies, "dependencies", ["dependencies"], validateDependency) ??
        [],
      sequence: this.attempt(
        () => [],
        () => requireStringArray(raw.sequence, { path: ["sequence"], subject: PROJECT }),
        "sequence",
      ),
      settings: this.settings(raw.settings),
      view: this.view(raw.view),
    };
  }

  /**
   * Runs a check; in collecting mode a parse error is recorded and the
   * fallback is returned instead.
   */
  private attempt<T>(fallback: () => T, run: () => T, area?: ShapeArea): T {
    if (!this.collecting) {
      return run();
    }
    try {
      return run();
    } catch (error) {
      if (!(error instanceof GanttParseError)) {
        throw error;
      }
      this.findings.push(...error.findings);
      if (area !== undefined) {
        this.incomplete.add(area);
      }
      return fallback();
    }
  }

  /**
   * Validates every record of a collection, keeping the valid ones. Returns
   * `undefined` when the value is present but is not an array (collecting mode).
   */
  private collection<T>(
    value: unknown,
    name: ShapeCollectionName,
    path: SourcePath,
    validate: (entry: unknown, at: FieldAt, index: number) => T,
  ): T[] | undefined {
    const entries = this.attempt<unknown[] | undefined>(
      () => undefined,
      () => asArray(value, { path, subject: PROJECT }),
      name,
    );
    if (entries === undefined) {
      return undefined;
    }
    const kept: T[] = [];
    entries.forEach((entry, index) => {
      const at: FieldAt = { path: [...path, index], subject: subjectOf(name, entry, index) };
      const record = this.attempt<T | undefined>(
        () => undefined,
        () => validate(entry, at, index),
        name,
      );
      if (record !== undefined) {
        kept.push(record);
        this.authoredIndex[name].push(index);
      }
    });
    return kept;
  }

  /** Validates and resolves project settings while dropping unknown keys. */
  private settings(raw: unknown): ProjectSettings {
    if (!isRecord(raw)) {
      return resolveProjectSettings();
    }
    const settings: Partial<ProjectSettings> = {};
    if (isRecord(raw.workingCalendar)) {
      const calendar = raw.workingCalendar;
      settings.workingCalendar = this.attempt(
        () => resolveProjectSettings().workingCalendar,
        () => validateWorkingCalendar(calendar),
      );
    }
    if (raw.workingDayHours !== undefined) {
      const hours = raw.workingDayHours;
      const value = this.attempt<number | undefined>(
        () => undefined,
        () => requireNumberInRange(hours, settingsAt("workingDayHours"), 0, 24, false, true),
      );
      if (value !== undefined) {
        settings.workingDayHours = value;
      }
    }
    if (raw.workingDayStart !== undefined) {
      const start = raw.workingDayStart;
      const value = this.attempt<number | undefined>(
        () => undefined,
        () => requireNumberInRange(start, settingsAt("workingDayStart"), 0, 24, true, false),
      );
      if (value !== undefined) {
        settings.workingDayStart = value;
      }
    }
    if (raw.holidays !== undefined) {
      const holidays = this.collection(
        raw.holidays,
        "holidays",
        ["settings", "holidays"],
        (entry, at) => validateDateRange(entry, at),
      );
      if (holidays !== undefined) {
        settings.holidays = holidays;
      }
    }
    if (raw.statuses !== undefined) {
      const statuses = this.collection(
        raw.statuses,
        "statuses",
        ["settings", "statuses"],
        (entry, at) => validateStatus(entry, at),
      );
      if (statuses !== undefined) {
        settings.statuses = statuses;
      }
    }
    return resolveProjectSettings(settings);
  }

  /**
   * Validates an optional view section. Recognized properties with invalid values fall back to
   * their defaults and are reported; unknown properties are rejected.
   */
  private view(raw: unknown): ProjectView {
    if (raw === undefined) {
      return resolveProjectView();
    }
    if (!isRecord(raw)) {
      return this.attempt(resolveProjectView, () => {
        throw fieldError({ path: ["view"], subject: PROJECT }, "object", "view must be an object.");
      });
    }
    for (const key of Object.keys(raw)) {
      if (!Object.hasOwn(VIEW_FIELD_VALIDATORS, key)) {
        this.attempt(
          () => undefined,
          () => {
            throw unsupportedError(
              { path: ["view", key], subject: PROJECT },
              `view.${key}`,
              `view.${key} is not supported.`,
            );
          },
        );
      }
    }
    const view: Record<string, unknown> = {};
    for (const field of Object.keys(VIEW_FIELD_VALIDATORS) as (keyof ProjectView)[]) {
      const value = raw[field];
      if (value === undefined) {
        continue;
      }
      if (VIEW_FIELD_VALIDATORS[field](value)) {
        view[field] = value;
      } else {
        const defaultValue = DEFAULT_PROJECT_VIEW[field];
        this.onWarning({ field, defaultValue });
        this.findings.push({
          category: "invalidViewValue",
          severity: "warning",
          origin: "document",
          subjects: [PROJECT],
          args: { field, defaultValue: JSON.stringify(defaultValue) },
          location: { path: ["view", field] },
        });
      }
    }
    return resolveProjectView(view as Partial<ProjectView>);
  }
}

/** Builds the subject of one authored record. */
function subjectOf(name: ShapeCollectionName, entry: unknown, index: number): SubjectRef {
  const id =
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 ? entry.id : undefined;
  switch (name) {
    case "tasks":
      return { kind: "task", id, index };
    case "groups":
      return { kind: "group", id, index };
    case "milestones":
      return { kind: "milestone", id, index };
    case "dependencies":
      return { kind: "dependency", id, index };
    case "statuses":
      return { kind: "status", id, index };
    case "holidays":
      return { kind: "holiday", index };
  }
}

/** Location of a project setting. */
function settingsAt(field: string): FieldAt {
  return { path: ["settings", field], subject: PROJECT };
}

/** Extends a location with nested keys or indices, keeping its subject. */
function child(at: FieldAt, ...segments: (string | number)[]): FieldAt {
  return { path: [...at.path, ...segments], subject: at.subject };
}

/** Renders a path in the `tasks[0].start` form used by log messages. */
function formatPath(path: SourcePath): string {
  return path
    .map((segment, index) =>
      typeof segment === "number" ? `[${segment}]` : index === 0 ? segment : `.${segment}`,
    )
    .join("");
}

/** Returns the last property name of a path. */
function fieldNameOf(path: SourcePath): string {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const segment = path[index];
    if (typeof segment === "string") {
      return segment;
    }
  }
  return "";
}

/** Builds a parse error carrying one `invalidField` finding. */
function fieldError(at: FieldAt, expectation: FieldExpectation, message: string): GanttParseError {
  return new GanttParseError(message, [
    {
      category: "invalidField",
      severity: "error",
      origin: "document",
      subjects: [at.subject],
      args: { field: fieldNameOf(at.path), expectation },
      location: { path: at.path },
    },
  ]);
}

/** Builds a parse error carrying one `unsupportedField` finding. */
function unsupportedError(at: FieldAt, field: string, message: string): GanttParseError {
  return new GanttParseError(message, [
    {
      category: "unsupportedField",
      severity: "error",
      origin: "document",
      subjects: [at.subject],
      args: { field },
      location: { path: at.path },
    },
  ]);
}

/** Builds the error for a record that is not an object. */
function recordError(at: FieldAt): GanttParseError {
  return fieldError(
    { path: at.path, subject: PROJECT },
    "object",
    `${formatPath(at.path)} must be an object.`,
  );
}

/** Validates a configured project status entry. */
function validateStatus(raw: unknown, at: FieldAt): ProjectStatus {
  if (!isRecord(raw)) {
    throw recordError(at);
  }
  const status: ProjectStatus = {
    id: requireString(raw.id, child(at, "id")),
    name: requireString(raw.name, child(at, "name")),
    color: requireString(raw.color, child(at, "color")),
  };
  if (raw.state !== undefined) {
    if (!isProjectItemState(raw.state)) {
      const field = child(at, "state");
      throw fieldError(field, "itemState", `${formatPath(field.path)} must be "open" or "closed".`);
    }
    status.state = raw.state;
  }
  return status;
}

/** Returns whether a value is a boolean. */
function isBoolean(value: unknown): boolean {
  return typeof value === "boolean";
}

/** Validates an inclusive date-only range. */
function validateDateRange(raw: unknown, at: FieldAt): DateRange {
  const field = formatPath(at.path);
  if (!isRecord(raw)) {
    throw recordError(at);
  }
  const unsupported = Object.keys(raw).find((key) => key !== "start" && key !== "end");
  if (unsupported !== undefined) {
    throw unsupportedError(
      child(at, unsupported),
      unsupported,
      `${field} contains an unsupported property.`,
    );
  }
  const start = requireDate(raw.start, child(at, "start"));
  const end = requireDate(raw.end, child(at, "end"));
  if (parseIsoDate(end).getTime() < parseIsoDate(start).getTime()) {
    throw new GanttParseError(`${field}.end must not precede ${field}.start.`, [
      {
        category: "invalidHolidayRange",
        severity: "error",
        origin: "document",
        subjects: [at.subject],
        location: { path: [...at.path, "end"] },
      },
    ]);
  }
  return { start, end };
}

/**
 * Validates and normalizes the reserved working calendar, dropping unknown keys.
 */
function validateWorkingCalendar(raw: Record<string, unknown>): WorkingCalendar {
  const calendar = resolveProjectSettings().workingCalendar;
  if (Array.isArray(raw.daysOff)) {
    calendar.daysOff = raw.daysOff.map((day, index) =>
      requireIsoWeekday(day, {
        path: ["settings", "workingCalendar", "daysOff", index],
        subject: PROJECT,
      }),
    );
  }
  return calendar;
}

/**
 * Validates and normalizes a task entry.
 */
function validateTask(raw: unknown, at: FieldAt): Task {
  if (!isRecord(raw)) {
    throw recordError(at);
  }
  const task: Task = {
    ...validateProjectItem(raw, at),
  };
  if (raw.start !== undefined) {
    task.start = requireDate(raw.start, child(at, "start"));
  }
  if (raw.end !== undefined) {
    task.end = requireDate(raw.end, child(at, "end"));
  }
  if (raw.duration !== undefined) {
    task.duration = requireNonNegativeNumber(raw.duration, child(at, "duration"));
  }
  if (raw.progress !== undefined) {
    task.progress = clampProgress(raw.progress);
  }
  return task;
}

/**
 * Validates and normalizes a group entry.
 */
function validateGroup(raw: unknown, at: FieldAt): Group {
  if (!isRecord(raw)) {
    throw recordError(at);
  }
  return {
    ...validateProjectItem(raw, at),
    sequence: requireStringArray(raw.sequence, child(at, "sequence")),
  };
}

/**
 * Validates and normalizes a milestone entry.
 */
function validateMilestone(raw: unknown, at: FieldAt, index: number): Milestone {
  if (!isRecord(raw)) {
    throw recordError(at);
  }
  const milestone: Milestone = {
    ...validateProjectItem(raw, at),
  };
  if (raw.date !== undefined) {
    milestone.date = requireDate(raw.date, child(at, "date"));
  }
  if (raw.duration !== undefined && raw.duration !== 0) {
    throw fieldError(
      child(at, "duration"),
      "zeroDuration",
      `milestones[${index}].duration must be 0; milestones are zero-duration.`,
    );
  }
  return milestone;
}

/**
 * Validates and normalizes fields inherited by every persisted project item.
 */
function validateProjectItem(raw: Record<string, unknown>, at: FieldAt): ProjectItem {
  const projectItem: ProjectItem = {
    id: requireString(raw.id, child(at, "id")),
    name: requireString(raw.name, child(at, "name")),
  };
  if (raw.description !== undefined) {
    projectItem.description = requireString(raw.description, child(at, "description"));
  }
  if (raw.groupId !== undefined) {
    projectItem.groupId = requireString(raw.groupId, child(at, "groupId"));
  }
  if (raw.state !== undefined && isProjectItemState(raw.state)) {
    projectItem.state = raw.state;
  }
  if (raw.status !== undefined) {
    projectItem.status = requireString(raw.status, child(at, "status"));
  }
  return projectItem;
}

/**
 * Validates and normalizes a dependency entry.
 */
function validateDependency(raw: unknown, at: FieldAt, index: number): Dependency {
  if (!isRecord(raw)) {
    throw recordError(at);
  }
  const type = raw.type;
  if (!isDependencyType(type)) {
    throw fieldError(
      child(at, "type"),
      "dependencyType",
      `dependencies[${index}].type is invalid.`,
    );
  }
  return {
    id: requireString(raw.id, child(at, "id")),
    sourceId: requireString(raw.sourceId, child(at, "sourceId")),
    targetId: requireString(raw.targetId, child(at, "targetId")),
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
function asArray(value: unknown, at: FieldAt): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw fieldError(at, "array", `${formatPath(at.path)} must be an array.`);
  }
  return value;
}

/**
 * Requires a non-empty string field.
 */
function requireString(value: unknown, at: FieldAt): string {
  if (typeof value !== "string" || value.length === 0) {
    throw fieldError(at, "nonEmptyString", `${formatPath(at.path)} must be a non-empty string.`);
  }
  return value;
}

/**
 * Requires an array of strings, defaulting to an empty array when the field
 * is absent (sequence repair normally fills it before this runs).
 */
function requireStringArray(value: unknown, at: FieldAt): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw fieldError(at, "stringArray", `${formatPath(at.path)} must be an array of strings.`);
  }
  return value;
}

/**
 * Requires an ISO date string in YYYY-MM-DD form.
 */
function requireDate(value: unknown, at: FieldAt): string {
  const message = `${formatPath(at.path)} must be an ISO date (YYYY-MM-DD).`;
  if (typeof value !== "string" || value.length === 0) {
    throw fieldError(at, "isoDate", `${formatPath(at.path)} must be a non-empty string.`);
  }
  const parsed = parseIsoDate(value);
  if (
    !ISO_DATE.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw fieldError(at, "isoDate", message);
  }
  return value;
}

/**
 * Requires a finite, non-negative number field.
 */
function requireNonNegativeNumber(value: unknown, at: FieldAt): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw fieldError(
      at,
      "nonNegativeNumber",
      `${formatPath(at.path)} must be a non-negative number.`,
    );
  }
  return value;
}

/** Requires a finite number inside the configured lower and upper bounds. */
function requireNumberInRange(
  value: unknown,
  at: FieldAt,
  minimum: number,
  maximum: number,
  includeMinimum: boolean,
  includeMaximum: boolean,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (includeMinimum ? value < minimum : value <= minimum) ||
    (includeMaximum ? value > maximum : value >= maximum)
  ) {
    throw fieldError(at, "inRange", `${formatPath(at.path)} is outside its supported range.`);
  }
  return value;
}

/** Requires an ISO weekday integer from Monday 1 through Sunday 7. */
function requireIsoWeekday(value: unknown, at: FieldAt): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 7) {
    throw fieldError(
      at,
      "isoWeekday",
      `${formatPath(at.path)} must be an ISO weekday from 1 to 7.`,
    );
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

/** Returns whether the value is a supported task state. */
function isProjectItemState(value: unknown): value is ProjectItemState {
  return typeof value === "string" && PROJECT_ITEM_STATES.includes(value as ProjectItemState);
}

/**
 * Returns whether the value is a supported dependency type.
 */
function isDependencyType(value: unknown): value is DependencyType {
  return typeof value === "string" && DEPENDENCY_TYPES.includes(value as DependencyType);
}
