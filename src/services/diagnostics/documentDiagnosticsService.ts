/**
 * Evaluates `.ganttee` text into every structured finding it produces.
 *
 * The evaluator runs the same pipeline as the editor (JSON, migration, shape,
 * relations, graph, semantic diagnostics, scheduling) but collects every
 * independently detectable problem instead of stopping at the first one.
 * Locations are resolved to offsets in the original text only when the
 * authored value at a path is the value that was validated; migrated or
 * ambiguous values fall back to a zero-width range at the document start.
 */

import { ProjectDocument } from "@common/documents";
import {
  EMPTY_LABEL_SNAPSHOT,
  FindingLocation,
  GantteeFinding,
  labelSnapshotOfRaw,
  LabelSnapshot,
  RelatedFindingLocation,
  ScheduleDiagnostic,
  SchedulingError,
  SourcePath,
  SubjectRef,
} from "@common/models";
import { migrateDocument } from "@services/document/documentMigrationService";
import { collectDocumentRelations } from "@services/document/documentRelationValidationService";
import {
  AuthoredIndexMap,
  collectDocumentShape,
} from "@services/document/documentShapeValidationService";
import {
  JsonSourceNode,
  nodeAt,
  positionAt,
  scanJson,
} from "@services/document/jsonSourceMapService";
import { hydrateDocument } from "@services/model/projectModelService";
import { createProjectSnapshot } from "@services/model/projectSnapshotService";
import { evaluateScheduleDiagnostics } from "@services/schedule/scheduleGraphValidationService";

/** Result of evaluating one document revision. */
export interface DocumentEvaluation {
  /** Every finding, with locations resolved against the evaluated text. */
  readonly findings: readonly GantteeFinding[];
  /** Labels of the evaluated revision, including records that failed validation. */
  readonly labels: LabelSnapshot;
  /** The validated document, when the text has no error findings before scheduling. */
  readonly document?: ProjectDocument;
}

/** Collections of a validated document that carry subjects. */
type RecordSource = Pick<ProjectDocument, "tasks" | "milestones" | "groups" | "dependencies">;

/** A subject together with its authored record path. */
interface RecordRef {
  /** The subject. */
  readonly subject: SubjectRef;
  /** Path of the authored record. */
  readonly path: SourcePath;
}

/**
 * Evaluates one document text.
 *
 * @param text The untrimmed TextDocument text.
 * @returns The findings and labels of this revision.
 */
export function evaluateDocumentText(text: string): DocumentEvaluation {
  if (text.trim().length === 0) {
    return { findings: [], labels: EMPTY_LABEL_SNAPSHOT };
  }
  const scan = scanJson(text);
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return {
      findings: [invalidJsonFinding(text, scan.ok ? undefined : scan.errorOffset)],
      labels: EMPTY_LABEL_SNAPSHOT,
    };
  }
  if (!scan.ok) {
    return { findings: [invalidJsonFinding(text, undefined)], labels: EMPTY_LABEL_SNAPSHOT };
  }

  const migrated = migrateDocument(raw);
  const labels = labelSnapshotOfRaw(migrated);
  const shape = collectDocumentShape(migrated);
  const findings: GantteeFinding[] = [...shape.findings];
  let document: ProjectDocument | undefined;
  if (shape.document !== undefined) {
    findings.push(
      ...collectDocumentRelations(shape.document, {
        authoredIndex: shape.authoredIndex,
        incomplete: shape.incomplete,
      }),
    );
    if (!findings.some((finding) => finding.severity === "error")) {
      document = shape.document;
      findings.push(...evaluateSemantics(shape.document, shape.authoredIndex));
    }
  }
  return {
    findings: findings.map((finding) => resolveFinding(finding, scan.root, text, migrated)),
    labels,
    document,
  };
}

/** Authored index map of a document whose records are in authored order. */
const IDENTITY_INDEX: AuthoredIndexMap = {
  tasks: [],
  groups: [],
  milestones: [],
  dependencies: [],
  statuses: [],
  holidays: [],
};

/**
 * Maps semantic diagnostics of a validated model to label-safe findings.
 * Locations are authored paths only; they are not resolved to offsets.
 *
 * @param document The validated document the diagnostics describe.
 * @param diagnostics The diagnostics to map.
 * @returns One finding per diagnostic, in the same order.
 */
export function scheduleDiagnosticFindings(
  document: RecordSource,
  diagnostics: readonly ScheduleDiagnostic[],
): GantteeFinding[] {
  const refs = new RecordRefs(document, IDENTITY_INDEX);
  return diagnostics.map((diagnostic) => semanticFinding(diagnostic, refs));
}

/**
 * Explains why a proposed document text is rejected: its error findings,
 * marked as rejected-edit feedback and labeled with the proposal itself.
 *
 * @param text The serialized proposal.
 * @returns The rejection findings and the proposal labels.
 */
export function proposalRejection(text: string): {
  readonly findings: readonly GantteeFinding[];
  readonly labels: LabelSnapshot;
} {
  const evaluation = evaluateDocumentText(text);
  return {
    findings: evaluation.findings
      .filter((finding) => finding.severity === "error")
      .map((finding) => ({ ...finding, origin: "rejectedEdit", location: undefined })),
    labels: evaluation.labels,
  };
}

/** Builds the invalid JSON finding, positioned at the syntax error when known. */
function invalidJsonFinding(text: string, offset: number | undefined): GantteeFinding {
  if (offset === undefined) {
    return {
      category: "invalidJson",
      severity: "error",
      origin: "document",
      subjects: [],
      location: { start: 0, end: 0 },
    };
  }
  const { line, column } = positionAt(text, offset);
  return {
    category: "invalidJson",
    severity: "error",
    origin: "document",
    subjects: [],
    args: { line, column },
    location: { start: offset, end: Math.min(text.length, offset + 1) },
  };
}

/** Evaluates semantic diagnostics and, when they allow it, scheduling. */
function evaluateSemantics(
  document: ProjectDocument,
  authoredIndex: AuthoredIndexMap,
): GantteeFinding[] {
  const refs = new RecordRefs(document, authoredIndex);
  const diagnostics = evaluateScheduleDiagnostics(document);
  const findings = diagnostics.map((diagnostic) => semanticFinding(diagnostic, refs));
  if (findings.some((finding) => finding.severity === "error")) {
    return findings;
  }
  const failure = schedulingFailure(document, diagnostics);
  if (failure !== undefined) {
    const ref = failure.subjectIds.length > 0 ? refs.entity(failure.subjectIds[0]) : undefined;
    findings.push({
      category: "schedulingFailed",
      severity: "error",
      origin: "document",
      subjects: ref === undefined ? [] : [ref.subject],
      args: failure.reason === undefined ? undefined : { reason: failure.reason },
      location: ref === undefined ? undefined : { path: ref.path },
    });
  }
  return findings;
}

/** Runs the scheduler and returns its recoverable failure, if any. */
function schedulingFailure(
  document: ProjectDocument,
  diagnostics: readonly ScheduleDiagnostic[],
): SchedulingError | undefined {
  try {
    return createProjectSnapshot(hydrateDocument(document), diagnostics).schedulingError;
  } catch (error) {
    if (error instanceof Error) {
      return new SchedulingError(error.message);
    }
    throw error;
  }
}

/** Looks up authored subjects and record paths by id. */
class RecordRefs {
  /** Entities by id (first occurrence). */
  private readonly entities = new Map<string, RecordRef>();
  /** Dependencies by id (first occurrence). */
  private readonly dependencies = new Map<string, RecordRef>();

  /**
   * @param document The validated document.
   * @param authoredIndex Authored index of each kept record.
   */
  constructor(document: RecordSource, authoredIndex: AuthoredIndexMap) {
    const kinds = { tasks: "task", milestones: "milestone", groups: "group" } as const;
    for (const name of ["tasks", "milestones", "groups"] as const) {
      document[name].forEach((item, index) => {
        const authored = authoredIndex[name][index] ?? index;
        if (!this.entities.has(item.id)) {
          this.entities.set(item.id, {
            subject: { kind: kinds[name], id: item.id, index: authored },
            path: [name, authored],
          });
        }
      });
    }
    document.dependencies.forEach((dependency, index) => {
      const authored = authoredIndex.dependencies[index] ?? index;
      if (!this.dependencies.has(dependency.id)) {
        this.dependencies.set(dependency.id, {
          subject: { kind: "dependency", id: dependency.id, index: authored },
          path: ["dependencies", authored],
        });
      }
    });
  }

  /** Returns an entity reference; unknown ids become a missing-item subject. */
  entity(id: string): RecordRef | undefined {
    return this.entities.get(id);
  }

  /** Returns an entity subject; unknown ids become a missing-item subject. */
  entitySubject(id: string): SubjectRef {
    return this.entities.get(id)?.subject ?? { kind: "item", id };
  }

  /** Returns a dependency reference. */
  dependency(id: string): RecordRef | undefined {
    return this.dependencies.get(id);
  }
}

/** Maps one semantic diagnostic to a finding. */
function semanticFinding(diagnostic: ScheduleDiagnostic, refs: RecordRefs): GantteeFinding {
  const severity = diagnostic.severity === "blocking" ? "error" : "warning";
  switch (diagnostic.kind) {
    case "underConstrained":
    case "overConstrained": {
      const ref = refs.entity(diagnostic.entityId);
      return {
        category: diagnostic.kind,
        severity,
        origin: "document",
        subjects: [refs.entitySubject(diagnostic.entityId)],
        args:
          diagnostic.kind === "overConstrained"
            ? { count: diagnostic.count, duplicateEndpoints: diagnostic.duplicateEndpoints }
            : { count: diagnostic.count },
        location: ref === undefined ? undefined : { path: ref.path },
      };
    }
    case "danglingDependency":
    case "groupDependency":
      return endpointFinding(diagnostic, refs, severity);
    case "unanchoredComponent": {
      const [primary, ...others] = diagnostic.entityIds;
      const primaryRef = primary === undefined ? undefined : refs.entity(primary);
      return {
        category: "unanchoredComponent",
        severity,
        origin: "document",
        subjects: diagnostic.entityIds.map((id) => refs.entitySubject(id)),
        location: primaryRef === undefined ? undefined : { path: primaryRef.path },
        related: relatedRefs(others.map((id) => refs.entity(id))),
      };
    }
    case "invalidWorkingCalendar":
      return {
        category: "invalidWorkingCalendar",
        severity,
        origin: "document",
        subjects: [{ kind: "project" }],
        location: { path: ["settings"] },
      };
  }
}

/** Maps a dangling or group dependency diagnostic, targeting the offending endpoint field. */
function endpointFinding(
  diagnostic: Extract<ScheduleDiagnostic, { kind: "danglingDependency" | "groupDependency" }>,
  refs: RecordRefs,
  severity: GantteeFinding["severity"],
): GantteeFinding {
  const ref = refs.dependency(diagnostic.dependencyId);
  const source = refs.entity(diagnostic.sourceId);
  const target = refs.entity(diagnostic.targetId);
  const offending =
    diagnostic.kind === "danglingDependency"
      ? source === undefined
        ? "sourceId"
        : "targetId"
      : source?.subject.kind === "group"
        ? "sourceId"
        : "targetId";
  return {
    category: diagnostic.kind,
    severity,
    origin: "document",
    subjects: [ref?.subject ?? { kind: "dependency", id: diagnostic.dependencyId }],
    location: ref === undefined ? undefined : { path: [...ref.path, offending] },
    related: relatedRefs([source, target]),
  };
}

/** Builds related locations from the references that exist. */
function relatedRefs(
  refs: readonly (RecordRef | undefined)[],
): RelatedFindingLocation[] | undefined {
  const related = refs
    .filter((ref): ref is RecordRef => ref !== undefined)
    .map((ref) => ({ subject: ref.subject, location: { path: ref.path } }));
  return related.length > 0 ? related : undefined;
}

/** Resolves the primary and related locations of a finding. */
function resolveFinding(
  finding: GantteeFinding,
  root: JsonSourceNode | undefined,
  text: string,
  migrated: unknown,
): GantteeFinding {
  return {
    ...finding,
    location: resolveLocation(finding.location, root, text, migrated),
    related: finding.related?.map((related) => ({
      ...related,
      location: resolveLocation(related.location, root, text, migrated),
    })),
  };
}

/**
 * Resolves a path to the span of the nearest authored value that equals the
 * validated value at the same path. Falls back to a zero-width range at the
 * document start when no such value exists.
 *
 * @param location The location to resolve.
 * @param root The scanned source map.
 * @param text The original text.
 * @param migrated The migrated payload that was validated.
 */
export function resolveLocation(
  location: FindingLocation | undefined,
  root: JsonSourceNode | undefined,
  text: string,
  migrated: unknown,
): FindingLocation {
  if (location?.start !== undefined && location.end !== undefined) {
    return location;
  }
  const path = location?.path;
  if (path !== undefined && root !== undefined) {
    for (let length = path.length; length > 0; length -= 1) {
      const prefix = path.slice(0, length);
      const node = nodeAt(root, prefix);
      const value = valueAt(migrated, prefix);
      if (node !== undefined && value.found && deepEqual(authoredValue(text, node), value.value)) {
        return { path, start: node.start, end: node.end };
      }
    }
  }
  return { path, start: 0, end: 0 };
}

/** Reads the authored value of a scanned node. */
function authoredValue(text: string, node: JsonSourceNode): unknown {
  return JSON.parse(text.slice(node.start, node.end)) as unknown;
}

/** Reads the value at a path of a plain JSON value. */
function valueAt(value: unknown, path: SourcePath): { found: boolean; value?: unknown } {
  let current: unknown = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment >= current.length) {
        return { found: false };
      }
      current = current[segment];
    } else {
      if (
        typeof current !== "object" ||
        current === null ||
        Array.isArray(current) ||
        !Object.hasOwn(current, segment)
      ) {
        return { found: false };
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }
  return { found: true, value: current };
}

/** Structural equality for plain JSON values; object key order is ignored. */
function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => deepEqual(entry, right[index]))
    );
  }
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => deepEqual(leftRecord[key], rightRecord[key]))
  );
}
