/**
 * Validation of untrusted browser `reportFeedback` payloads.
 *
 * The webview is treated as untrusted input: malformed messages, unknown
 * categories, origins that do not match their context, and oversized payloads
 * are rejected as a whole so ignored input cannot create recursive findings.
 */

import { DEPENDENCY_TYPES, DependencyType } from "@common/documents/project/dependency";
import {
  DependencyLabelEntry,
  FieldExpectation,
  FindingArgs,
  FindingLocation,
  GantteeFinding,
  GantteeFindingOrigin,
  isGantteeFindingCategory,
  LabelEntry,
  LabelSnapshot,
  RelatedFindingLocation,
  SchedulingFailureReason,
  SequenceProblem,
  SubjectKind,
  SubjectRef,
} from "@common/models/diagnostics";
import { FeedbackContext, ReportFeedbackMessage } from "@common/protocol";

/** Upper bounds that keep one feedback message cheap to process. */
export const FEEDBACK_LIMITS = {
  findings: 200,
  subjects: 50,
  related: 50,
  pathLength: 32,
  labelItems: 10_000,
  labelDependencies: 10_000,
  text: 1_000,
} as const;

const CONTEXTS: readonly FeedbackContext[] = ["entityDraft", "settingsDraft", "operation"];
const SUBJECT_KINDS: readonly SubjectKind[] = [
  "task",
  "milestone",
  "group",
  "item",
  "status",
  "dependency",
  "holiday",
  "project",
];
const LABEL_KINDS: readonly LabelEntry["kind"][] = ["task", "milestone", "group", "status"];
const EXPECTATIONS: readonly FieldExpectation[] = [
  "object",
  "array",
  "stringArray",
  "nonEmptyString",
  "isoDate",
  "nonNegativeNumber",
  "inRange",
  "isoWeekday",
  "itemState",
  "dependencyType",
  "zeroDuration",
  "dateOrder",
];
const REASONS: readonly SchedulingFailureReason[] = [
  "unknownEntity",
  "graphOmission",
  "invalidWorkingTime",
  "unscheduledTarget",
  "startAfterEnd",
  "underConstrained",
  "invalidDuration",
];
const SEQUENCE_PROBLEMS: readonly SequenceProblem[] = ["notDirectChild", "duplicate", "missing"];
const OPERATION_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Thrown internally to abort validation of a malformed payload. */
class InvalidPayload extends Error {}

/** Asserts a condition about untrusted input. */
function check(condition: boolean): asserts condition {
  if (!condition) {
    throw new InvalidPayload();
  }
}

/** Returns whether a value is a plain (non-array) object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns whether a value is a non-negative safe integer. */
function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Returns whether a value is a bounded string. */
function isText(value: unknown): value is string {
  return typeof value === "string" && value.length <= FEEDBACK_LIMITS.text;
}

/** Returns whether a value is one of the allowed members. */
function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/** Returns a bounded string or aborts. */
function asText(value: unknown): string {
  check(isText(value));
  return value;
}

/** Returns a non-negative integer or aborts. */
function asIndex(value: unknown): number {
  check(isIndex(value));
  return value;
}

/** Returns a member of an allowed set or aborts. */
function asOneOf<T extends string>(allowed: readonly T[], value: unknown): T {
  check(isOneOf(allowed, value));
  return value;
}

/** Validates a bounded array and maps its items. */
function arrayOf<T>(value: unknown, limit: number, map: (item: unknown) => T): T[] {
  check(Array.isArray(value) && value.length <= limit);
  return value.map(map);
}

/** Validates an optional field, mapping it only when present. */
function optional<T>(value: unknown, map: (item: unknown) => T): T | undefined {
  return value === undefined ? undefined : map(value);
}

/** Validates a subject reference. */
function parseSubject(value: unknown): SubjectRef {
  check(isRecord(value) && isOneOf(SUBJECT_KINDS, value.kind));
  return {
    kind: value.kind,
    id: optional(value.id, asText),
    index: optional(value.index, asIndex),
  };
}

/** Validates a source location. */
function parseLocation(value: unknown): FindingLocation {
  check(isRecord(value));
  return {
    path: optional(value.path, (path) =>
      arrayOf(path, FEEDBACK_LIMITS.pathLength, (segment) => {
        check(isText(segment) || isIndex(segment));
        return segment;
      }),
    ),
    start: optional(value.start, asIndex),
    end: optional(value.end, asIndex),
  };
}

/** Validates a related location. */
function parseRelated(value: unknown): RelatedFindingLocation {
  check(isRecord(value));
  return { subject: parseSubject(value.subject), location: parseLocation(value.location) };
}

/** Validates structured finding arguments. */
function parseArgs(value: unknown): FindingArgs {
  check(isRecord(value));
  return {
    field: optional(value.field, asText),
    expectation: optional(value.expectation, (item) => asOneOf(EXPECTATIONS, item)),
    count: optional(value.count, asIndex),
    duplicateEndpoints: optional(value.duplicateEndpoints, (endpoints) =>
      arrayOf(endpoints, 2, (endpoint) => asOneOf(["start", "end"] as const, endpoint)),
    ),
    reason: optional(value.reason, (item) => asOneOf(REASONS, item)),
    sequenceProblem: optional(value.sequenceProblem, (item) => {
      check(isOneOf(SEQUENCE_PROBLEMS, item));
      return item;
    }),
    defaultValue: optional(value.defaultValue, asText),
    line: optional(value.line, asIndex),
    column: optional(value.column, asIndex),
  };
}

/** Validates one finding, requiring the origin implied by its context. */
function parseFinding(value: unknown, origin: GantteeFindingOrigin): GantteeFinding {
  check(isRecord(value));
  check(isGantteeFindingCategory(value.category));
  check(value.severity === "error" || value.severity === "warning");
  check(value.origin === origin);
  return {
    category: value.category,
    severity: value.severity,
    origin,
    subjects: arrayOf(value.subjects, FEEDBACK_LIMITS.subjects, parseSubject),
    args: optional(value.args, parseArgs),
    location: optional(value.location, parseLocation),
    related: optional(value.related, (related) =>
      arrayOf(related, FEEDBACK_LIMITS.related, parseRelated),
    ),
  };
}

/** Validates one item label entry. */
function parseLabelEntry(value: unknown): LabelEntry {
  check(isRecord(value) && isOneOf(LABEL_KINDS, value.kind));
  check(isText(value.id) && isIndex(value.index));
  return {
    kind: value.kind,
    id: value.id,
    index: value.index,
    name: optional(value.name, asText),
    groupId: optional(value.groupId, asText),
  };
}

/** Validates one dependency label entry. */
function parseDependencyLabel(value: unknown): DependencyLabelEntry {
  check(isRecord(value) && isText(value.id) && isIndex(value.index));
  check(isText(value.sourceId) && isText(value.targetId));
  return {
    id: value.id,
    sourceId: value.sourceId,
    targetId: value.targetId,
    index: value.index,
    type: optional(value.type, (type): DependencyType => {
      check(isOneOf(DEPENDENCY_TYPES, type));
      return type;
    }),
  };
}

/** Validates a label snapshot. */
function parseLabels(value: unknown): LabelSnapshot {
  check(isRecord(value));
  return {
    items: arrayOf(value.items, FEEDBACK_LIMITS.labelItems, parseLabelEntry),
    dependencies: arrayOf(
      value.dependencies,
      FEEDBACK_LIMITS.labelDependencies,
      parseDependencyLabel,
    ),
  };
}

/**
 * Validates an untrusted `reportFeedback` payload.
 *
 * @param value The received message.
 * @returns A normalized copy containing only known fields, or `undefined` when
 * any part of the payload is malformed.
 */
export function parseReportFeedback(value: unknown): ReportFeedbackMessage | undefined {
  try {
    check(isRecord(value) && value.type === "reportFeedback");
    check(isOneOf(CONTEXTS, value.context));
    check(isIndex(value.generation) && isIndex(value.baseRevision));
    const context = value.context;
    const origin: GantteeFindingOrigin = context === "operation" ? "operation" : "draft";
    const message: ReportFeedbackMessage = {
      type: "reportFeedback",
      context,
      generation: value.generation,
      baseRevision: value.baseRevision,
      findings: arrayOf(value.findings, FEEDBACK_LIMITS.findings, (finding) =>
        parseFinding(finding, origin),
      ),
      labels: parseLabels(value.labels),
    };
    if (context === "operation") {
      check(typeof value.operationKey === "string");
      check(OPERATION_KEY_PATTERN.test(value.operationKey));
      check(isIndex(value.attempt) && value.attempt > 0);
      return { ...message, operationKey: value.operationKey, attempt: value.attempt };
    }
    return message;
  } catch (error) {
    if (error instanceof InvalidPayload) {
      return undefined;
    }
    throw error;
  }
}
