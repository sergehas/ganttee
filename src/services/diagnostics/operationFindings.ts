/**
 * Builders for findings that describe host operations and rejected edits
 * rather than document text. They carry structured subjects only; wording and
 * labels are resolved by the finding presenter.
 */

import { GantteeFinding, GantteeFindingOrigin, SchedulingError, SubjectKind } from "@common/models";

/** Items removed by automatic scheduling cleanup. */
export interface CleanupRemoval {
  /** Removed task, milestone, or group ids. */
  readonly removedEntityIds: readonly string[];
  /** Removed dependency ids. */
  readonly removedDependencyIds: readonly string[];
}

/**
 * Describes items removed by automatic cleanup. Label it with the pre-cleanup labels.
 *
 * @param removal The removed items.
 */
export function cleanupRemovedFinding(removal: CleanupRemoval): GantteeFinding {
  return {
    category: "cleanupRemoved",
    severity: "warning",
    origin: "operation",
    subjects: [
      ...removal.removedEntityIds.map((id) => ({ kind: "item" as const, id })),
      ...removal.removedDependencyIds.map((id) => ({ kind: "dependency" as const, id })),
    ],
  };
}

/** Describes an automatic cleanup edit that VS Code rejected. */
export function cleanupFailedFinding(): GantteeFinding {
  return { category: "cleanupFailed", severity: "error", origin: "operation", subjects: [] };
}

/**
 * Describes an update or delete that targets an item that no longer exists.
 *
 * @param kind The targeted kind.
 * @param id The targeted id, used only for label lookup.
 * @param origin Rejected edit of a form, or a host operation.
 */
export function unknownItemFinding(
  kind: SubjectKind,
  id: string,
  origin: Extract<GantteeFindingOrigin, "rejectedEdit" | "operation">,
): GantteeFinding {
  return { category: "unknownItem", severity: "warning", origin, subjects: [{ kind, id }] };
}

/**
 * Describes a dependency that was rejected because it would create a cycle.
 * Label it with labels that include the proposed dependency.
 *
 * @param dependencyId The proposed dependency id.
 */
export function dependencyCycleRejectedFinding(dependencyId: string): GantteeFinding {
  return {
    category: "dependencyCycleRejected",
    severity: "error",
    origin: "operation",
    subjects: [{ kind: "dependency", id: dependencyId }],
  };
}

/** Describes a sort request made while no schedule is available. */
export function sortUnavailableFinding(): GantteeFinding {
  return { category: "sortUnavailable", severity: "warning", origin: "operation", subjects: [] };
}

/**
 * Describes a rejected proposal that has no more specific explanation.
 *
 * @param kind The edited subject kind.
 * @param id The edited subject id, when one exists.
 */
export function editRejectedFinding(kind: SubjectKind, id?: string): GantteeFinding {
  return {
    category: "editRejected",
    severity: "error",
    origin: "rejectedEdit",
    subjects: [id === undefined ? { kind } : { kind, id }],
  };
}

/**
 * Describes a recoverable scheduling failure without its raw exception text.
 *
 * @param error The scheduling failure.
 */
export function schedulingFailedFinding(error: SchedulingError): GantteeFinding {
  const subject = error.subjectIds[0];
  return {
    category: "schedulingFailed",
    severity: "error",
    origin: "document",
    subjects: subject === undefined ? [] : [{ kind: "item", id: subject }],
    args: error.reason === undefined ? undefined : { reason: error.reason },
  };
}
