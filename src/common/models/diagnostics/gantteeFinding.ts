/**
 * Structured, localization-free description of one Ganttee error or warning.
 *
 * Findings are produced by pure services (document validation, semantic
 * evaluation, scheduling, cleanup), by the webview (draft feedback), and by the
 * host (rejected edits, operations). They carry typed subject references and
 * authored source paths but never user-facing text; presentation resolves
 * labels and localized templates. Internal ids stay inside subjects for
 * identity and lookup only and must never be rendered.
 */

import { DependencyType } from "@common/documents/project/dependency";

/** Presentation severity of a finding; blocking policy is decided elsewhere. */
export type GantteeFindingSeverity = "error" | "warning";

/** The context a finding describes. */
export type GantteeFindingOrigin = "document" | "draft" | "rejectedEdit" | "operation";

/** Stable finding categories. These are the native diagnostic codes; never ids. */
export const GANTTEE_FINDING_CATEGORIES = [
  // Parsing and shape.
  "invalidJson",
  "invalidRoot",
  "invalidField",
  "unsupportedField",
  // Relations.
  "duplicateEntityId",
  "duplicateDependencyId",
  "duplicateStatusId",
  "invalidTaskDateRange",
  "invalidHolidayRange",
  "groupSelfParent",
  "unknownParentGroup",
  "groupParentCycle",
  "unknownItemGroup",
  "sequenceMismatch",
  // Warning-producing normalization.
  "unknownStatus",
  "invalidViewValue",
  // Structural graph.
  "selfLoopDependency",
  "parallelDependency",
  "dependencyCycle",
  // Semantic (mirrors ScheduleDiagnostic kinds).
  "underConstrained",
  "overConstrained",
  "danglingDependency",
  "groupDependency",
  "unanchoredComponent",
  "invalidWorkingCalendar",
  // Scheduling.
  "schedulingFailed",
  // Cleanup.
  "cleanupRemoved",
  "cleanupFailed",
  // Draft-local form validation.
  "invalidDuration",
  "blankStatusName",
  "invalidInput",
  // Operations and rejected edits.
  "exportFailed",
  "dependencyCycleRejected",
  "sortUnavailable",
  "unknownItem",
  "editRejected",
] as const;

/** A stable finding category. */
export type GantteeFindingCategory = (typeof GANTTEE_FINDING_CATEGORIES)[number];

/** Kinds of things a finding can refer to. `item` is an entity of unknown kind. */
export type SubjectKind =
  "task" | "milestone" | "group" | "item" | "status" | "dependency" | "holiday" | "project";

/** A typed reference to an affected subject. */
export interface SubjectRef {
  /** Subject kind. */
  readonly kind: SubjectKind;
  /** Internal identity used for label lookup only; never rendered. */
  readonly id?: string;
  /**
   * Zero-based position of the subject inside its authored collection. Used to
   * resolve labels for duplicate ids and to number unnamed occurrences.
   */
  readonly index?: number;
}

/** Path into the authored JSON (object keys and array indices). */
export type SourcePath = readonly (string | number)[];

/** Optional authored location of a finding, as a path or resolved offsets. */
export interface FindingLocation {
  /** Path into the authored JSON whose value the finding targets. */
  readonly path?: SourcePath;
  /** Resolved start offset in the untrimmed original text (UTF-16 units). */
  readonly start?: number;
  /** Resolved end offset in the untrimmed original text (UTF-16 units). */
  readonly end?: number;
}

/** An additional affected location, labeled by its subject. */
export interface RelatedFindingLocation {
  /** The subject at this location. */
  readonly subject: SubjectRef;
  /** The location of the subject. */
  readonly location: FindingLocation;
}

/** Why the scheduling engine could not compute a schedule. */
export type SchedulingFailureReason =
  | "unknownEntity"
  | "graphOmission"
  | "invalidWorkingTime"
  | "unscheduledTarget"
  | "startAfterEnd"
  | "underConstrained"
  | "invalidDuration";

/** Expected shape for an invalid field. */
export type FieldExpectation =
  | "object"
  | "array"
  | "stringArray"
  | "nonEmptyString"
  | "isoDate"
  | "nonNegativeNumber"
  | "inRange"
  | "isoWeekday"
  | "itemState"
  | "dependencyType"
  | "zeroDuration"
  | "dateOrder";

/** Problem found in an owner sequence. */
export type SequenceProblem = "notDirectChild" | "duplicate" | "missing";

/** Structured message arguments. Only the fields relevant to a category are set. */
export interface FindingArgs {
  /** Authored property name (schema vocabulary, not an id). */
  readonly field?: string;
  /** Expected value shape for `invalidField` and `invalidInput`. */
  readonly expectation?: FieldExpectation;
  /** Constraint count for determinacy findings. */
  readonly count?: number;
  /** Duplicated endpoints for `overConstrained`. */
  readonly duplicateEndpoints?: readonly ("start" | "end")[];
  /** Scheduling failure reason. */
  readonly reason?: SchedulingFailureReason;
  /** Sequence problem. */
  readonly sequenceProblem?: SequenceProblem;
  /** JSON text of a substituted default value for `invalidViewValue`. */
  readonly defaultValue?: string;
  /** One-based line for `invalidJson`, when known. */
  readonly line?: number;
  /** One-based column for `invalidJson`, when known. */
  readonly column?: number;
}

/** One structured error or warning. */
export interface GantteeFinding {
  /** Stable category; the native diagnostic code. */
  readonly category: GantteeFindingCategory;
  /** Presentation severity. */
  readonly severity: GantteeFindingSeverity;
  /** Context the finding describes. */
  readonly origin: GantteeFindingOrigin;
  /** Affected subjects; the first is the primary subject. */
  readonly subjects: readonly SubjectRef[];
  /** Structured message arguments. */
  readonly args?: FindingArgs;
  /** Primary authored location. */
  readonly location?: FindingLocation;
  /** Additional affected authored locations. */
  readonly related?: readonly RelatedFindingLocation[];
}

/** Presentation data for one labelable item at a given revision, draft, or proposal. */
export interface LabelEntry {
  /** Item kind. */
  readonly kind: "task" | "milestone" | "group" | "status";
  /** Internal id used for lookup only. */
  readonly id: string;
  /** Authored name; may be blank or absent. */
  readonly name?: string;
  /** Zero-based index inside the authored collection. */
  readonly index: number;
  /** Id of the containing group, used to disambiguate duplicate labels. */
  readonly groupId?: string;
}

/** Presentation data for one dependency. */
export interface DependencyLabelEntry {
  /** Internal id used for lookup only. */
  readonly id: string;
  /** Source item id. */
  readonly sourceId: string;
  /** Target item id. */
  readonly targetId: string;
  /** Dependency type, when valid. */
  readonly type?: DependencyType;
  /** Zero-based index inside the authored collection. */
  readonly index: number;
}

/**
 * Revision-, draft-, or proposal-specific label context. Serializable so the
 * webview can send draft labels and cleanup can capture pre-cleanup labels.
 */
export interface LabelSnapshot {
  /** Tasks, milestones, groups, and statuses. */
  readonly items: readonly LabelEntry[];
  /** Dependencies. */
  readonly dependencies: readonly DependencyLabelEntry[];
}

/** An empty label context. */
export const EMPTY_LABEL_SNAPSHOT: LabelSnapshot = { items: [], dependencies: [] };

/** Returns whether a value is a known finding category. */
export function isGantteeFindingCategory(value: unknown): value is GantteeFindingCategory {
  return (
    typeof value === "string" && (GANTTEE_FINDING_CATEGORIES as readonly string[]).includes(value)
  );
}
